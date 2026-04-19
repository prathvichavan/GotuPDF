import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

export class UnlockPdfError extends Error {
    status: number;
    code?: string;

    /** Create a typed unlock error with an HTTP status. */
    constructor(message: string, status = 500, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export interface TempFileResult {
    tempDir: string;
    filePath: string;
    cleanup: () => Promise<void>;
}

export interface UnlockResult {
    stream: ReadableStream<Uint8Array>;
    fileName: string;
    contentType: string;
    contentLength?: number;
}

/** Sanitize a filename base for safe output naming. */
export function sanitizeBaseName(name: string) {
    const base = name.replace(/\.[^/.]+$/, "");
    const safe = base.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 80) || "unlocked";
}

/** Persist an uploaded file into a temporary directory on disk. */
export async function saveFileToTemp(file: File, prefix = "unlock-pdf"): Promise<TempFileResult> {
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
    const extension = path.extname(file.name || ".pdf") || ".pdf";
    const fileName = `${prefix}-${crypto.randomUUID()}${extension}`;
    const filePath = path.join(tempDir, fileName);

    const nodeStream = Readable.fromWeb(file.stream() as any);
    await pipeline(nodeStream, fs.createWriteStream(filePath));

    return {
        tempDir,
        filePath,
        cleanup: async () => {
            await fsp.rm(tempDir, { recursive: true, force: true });
        },
    };
}

/** Validate that the uploaded file is a PDF by checking its header. */
export async function assertPdfHeader(filePath: string) {
    const fd = await fsp.open(filePath, "r");
    try {
        const buffer = Buffer.alloc(5);
        const { bytesRead } = await fd.read(buffer, 0, 5, 0);
        if (bytesRead < 5 || buffer.toString("utf8") !== "%PDF-") {
            throw new UnlockPdfError("Invalid PDF file. Please upload a valid PDF.", 400, "invalid_pdf");
        }
    } finally {
        await fd.close();
    }
}

/** Detect encrypted PDFs by scanning for encryption markers. */
export async function detectEncryptedPdf(filePath: string) {
    const fd = await fsp.open(filePath, "r");
    try {
        const maxBytes = 2 * 1024 * 1024;
        const stat = await fd.stat();

        const headBuffer = Buffer.alloc(Math.min(maxBytes, stat.size));
        const headRead = await fd.read(headBuffer, 0, headBuffer.length, 0);
        const headChunk = headBuffer.subarray(0, headRead.bytesRead);

        if (headChunk.includes("/Encrypt")) {
            return true;
        }

        if (stat.size > maxBytes) {
            const tailBuffer = Buffer.alloc(maxBytes);
            const start = Math.max(0, stat.size - maxBytes);
            const tailRead = await fd.read(tailBuffer, 0, tailBuffer.length, start);
            const tailChunk = tailBuffer.subarray(0, tailRead.bytesRead);
            if (tailChunk.includes("/Encrypt")) {
                return true;
            }
        }

        return false;
    } finally {
        await fd.close();
    }
}

/* ------------------------------------------------------------------ */
/*  QPDF path detection                                                */
/* ------------------------------------------------------------------ */

let qpdfPath: string | null = null;

async function findQpdf(): Promise<string> {
    if (qpdfPath) return qpdfPath;

    // Check environment variable first
    if (process.env.QPDF_PATH) {
        try {
            await execFileAsync(process.env.QPDF_PATH, ["--version"], { timeout: 5000 });
            qpdfPath = process.env.QPDF_PATH;
            console.log(`[QPDF] Found at env QPDF_PATH: ${qpdfPath}`);
            return qpdfPath;
        } catch {
            // Continue to other candidates
        }
    }

    // Check common locations
    const candidates = [
        "qpdf", // In PATH
        "C:\\Program Files\\qpdf 12.3.2\\bin\\qpdf.exe",
        "C:\\Program Files\\qpdf\\bin\\qpdf.exe",
        "C:\\Program Files (x86)\\qpdf\\bin\\qpdf.exe",
        "/usr/bin/qpdf",
        "/usr/local/bin/qpdf",
        "/opt/homebrew/bin/qpdf",
    ];

    for (const candidate of candidates) {
        try {
            await execFileAsync(candidate, ["--version"], { timeout: 5000 });
            qpdfPath = candidate;
            console.log(`[QPDF] Found at: ${candidate}`);
            return candidate;
        } catch {
            // Continue to next candidate
        }
    }

    throw new UnlockPdfError(
        "qpdf was not found. Please install qpdf for PDF unlock functionality.",
        500,
        "qpdf_not_found",
    );
}

/** Unlock (decrypt) a PDF with qpdf and return a streaming response. */
export async function unlockPdfWithQpdf(options: {
    inputPath: string;
    outputBaseName: string;
    password: string;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<UnlockResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const qpdfExe = await findQpdf();
    const outputDir = await fsp.mkdtemp(path.join(os.tmpdir(), "unlock-pdf-out-"));
    const outputPath = path.join(outputDir, `${options.outputBaseName}_unlocked.pdf`);

    validatePassword(options.password);

    const args = [
        `--password=${options.password}`,
        "--decrypt",
        "--",
        options.inputPath,
        outputPath,
    ];

    let abortHandler: (() => void) | null = null;

    try {
        await new Promise<void>((resolve, reject) => {
            let settled = false;
            let stderr = "";

            const finish = (error?: Error) => {
                if (settled) return;
                settled = true;
                if (abortHandler && options.signal) {
                    options.signal.removeEventListener("abort", abortHandler);
                }
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            };

            const processHandle = spawn(qpdfExe, args, { stdio: ["ignore", "ignore", "pipe"] });

            const timeoutId = setTimeout(() => {
                processHandle.kill("SIGKILL");
                finish(new UnlockPdfError("Unlocking timed out. Please try again.", 504, "qpdf_timeout"));
            }, timeoutMs);

            abortHandler = () => {
                processHandle.kill("SIGKILL");
                clearTimeout(timeoutId);
                finish(new UnlockPdfError("Unlock cancelled.", 400, "unlock_cancelled"));
            };

            if (options.signal) {
                if (options.signal.aborted) {
                    abortHandler();
                    return;
                }
                options.signal.addEventListener("abort", abortHandler, { once: true });
            }

            processHandle.stderr?.on("data", (chunk) => {
                stderr += chunk.toString();
            });

            processHandle.on("error", (err: NodeJS.ErrnoException) => {
                clearTimeout(timeoutId);
                if (err.code === "ENOENT") {
                    finish(
                        new UnlockPdfError(
                            "qpdf was not found. Install qpdf and set QPDF_PATH if needed.",
                            500,
                            "qpdf_missing"
                        )
                    );
                    return;
                }
                finish(err);
            });

            processHandle.on("exit", (code) => {
                clearTimeout(timeoutId);
                if (code === 0) {
                    finish();
                    return;
                }

                const lower = stderr.toLowerCase();
                if (lower.includes("invalid password") || lower.includes("incorrect password")) {
                    finish(new UnlockPdfError("Incorrect password. Please try again.", 400, "invalid_password"));
                    return;
                }
                if (lower.includes("file is not encrypted")) {
                    finish(new UnlockPdfError("This PDF is not password-protected.", 400, "not_encrypted"));
                    return;
                }
                finish(new UnlockPdfError("Failed to unlock PDF. Please verify the password.", 400, "qpdf_failed"));
            });
        });

        const stat = await fsp.stat(outputPath);
        const nodeStream = fs.createReadStream(outputPath);
        nodeStream.on("close", async () => {
            await fsp.rm(outputDir, { recursive: true, force: true });
        });

        return {
            stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
            fileName: path.basename(outputPath),
            contentType: "application/pdf",
            contentLength: stat.size,
        };
    } catch (error) {
        await fsp.rm(outputDir, { recursive: true, force: true });
        if (error instanceof UnlockPdfError) throw error;
        throw new UnlockPdfError(
            `Failed to unlock PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
            500,
            "qpdf_error"
        );
    }
}

/** Validate passwords for qpdf CLI safety. */
function validatePassword(password: string) {
    if (!password.trim()) {
        throw new UnlockPdfError("Please enter the PDF password.", 400, "missing_password");
    }
    if (password.startsWith("-")) {
        throw new UnlockPdfError(
            "Password cannot start with '-'. Please choose another password.",
            400,
            "invalid_password"
        );
    }
    if (/[\r\n]/.test(password)) {
        throw new UnlockPdfError("Password contains invalid characters.", 400, "invalid_password");
    }
}
