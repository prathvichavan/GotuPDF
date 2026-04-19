/**
 * PDF Protection Module – QPDF CLI Implementation
 *
 * Uses qpdf command-line tool for robust AES-256 encryption.
 * No OpenSSL crypto issues, fully compatible with Node 18+ and Windows.
 *
 * Features:
 * - AES 256-bit encryption (PDF 1.7 extension level 3)
 * - Owner password + User password support
 * - Granular permissions (print, copy, modify, annotate)
 * - Clean temporary file handling
 * - Proper error handling for all failure cases
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const execFileAsync = promisify(execFile);

/* ------------------------------------------------------------------ */
/*  Error class                                                        */
/* ------------------------------------------------------------------ */

export class ProtectPdfError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 500, code?: string) {
        super(message);
        this.name = "ProtectPdfError";
        this.status = status;
        this.code = code;
    }
}

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface TempFileResult {
    tempDir: string;
    filePath: string;
    cleanup: () => Promise<void>;
}

export interface ProtectionResult {
    pdfBytes: Buffer;
    fileName: string;
    contentType: string;
}

export interface PdfPermissions {
    print: boolean;
    copy: boolean;
    modify: boolean;
    annotate: boolean;
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

export function sanitizeBaseName(name: string): string {
    const base = name.replace(/\.[^/.]+$/, "");
    const safe = base.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 80) || "protected";
}

export async function saveFileToTemp(file: File, prefix = "protect-pdf"): Promise<TempFileResult> {
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
            try {
                await fsp.rm(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        },
    };
}

export async function assertPdfHeader(filePath: string): Promise<void> {
    const fd = await fsp.open(filePath, "r");
    try {
        const buf = Buffer.alloc(5);
        const { bytesRead } = await fd.read(buf, 0, 5, 0);
        if (bytesRead < 5 || buf.toString("utf8") !== "%PDF-") {
            throw new ProtectPdfError("Invalid PDF file. Please upload a valid PDF.", 400, "invalid_pdf");
        }
    } finally {
        await fd.close();
    }
}

export async function detectEncryptedPdf(filePath: string): Promise<void> {
    const fd = await fsp.open(filePath, "r");
    try {
        const max = 2 * 1024 * 1024;
        const stat = await fd.stat();
        const head = Buffer.alloc(Math.min(max, stat.size));
        await fd.read(head, 0, head.length, 0);
        if (head.includes("/Encrypt")) {
            throw new ProtectPdfError(
                "This PDF is already password-protected. Please unlock it first.",
                400,
                "encrypted_pdf",
            );
        }
        if (stat.size > max) {
            const tail = Buffer.alloc(max);
            await fd.read(tail, 0, tail.length, Math.max(0, stat.size - max));
            if (tail.includes("/Encrypt")) {
                throw new ProtectPdfError(
                    "This PDF is already password-protected. Please unlock it first.",
                    400,
                    "encrypted_pdf",
                );
            }
        }
    } finally {
        await fd.close();
    }
}

/* ------------------------------------------------------------------ */
/*  Password validation                                                */
/* ------------------------------------------------------------------ */

function validatePassword(password: string, label: "user" | "owner"): void {
    if (!password) return;
    if (/[\r\n\0]/.test(password)) {
        throw new ProtectPdfError(
            `${label === "user" ? "User" : "Owner"} password contains invalid characters.`,
            400,
            "invalid_password",
        );
    }
    if (password.length > 127) {
        throw new ProtectPdfError(
            `${label === "user" ? "User" : "Owner"} password is too long (max 127 characters).`,
            400,
            "invalid_password",
        );
    }
}

/* ------------------------------------------------------------------ */
/*  QPDF path detection                                                */
/* ------------------------------------------------------------------ */

let qpdfPath: string | null = null;

async function findQpdf(): Promise<string> {
    if (qpdfPath) return qpdfPath;

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

    throw new ProtectPdfError(
        "QPDF is not installed. Please install qpdf to enable PDF protection.",
        500,
        "qpdf_not_found",
    );
}

/* ------------------------------------------------------------------ */
/*  Build QPDF permissions string                                      */
/* ------------------------------------------------------------------ */

function buildPermissionsArgs(permissions: PdfPermissions): string[] {
    const args: string[] = [];

    // Start with restrictive defaults, then allow specific permissions
    if (permissions.print) {
        args.push("--print=full");
    } else {
        args.push("--print=none");
    }

    if (permissions.modify) {
        args.push("--modify=all");
    } else {
        args.push("--modify=none");
    }

    if (permissions.copy) {
        args.push("--extract=y");
    } else {
        args.push("--extract=n");
    }

    if (permissions.annotate) {
        args.push("--annotate=y");
    } else {
        args.push("--annotate=n");
    }

    // Always allow accessibility and form filling
    args.push("--accessibility=y");
    args.push("--cleartext-metadata");

    return args;
}

/* ------------------------------------------------------------------ */
/*  Main protection function using QPDF                                */
/* ------------------------------------------------------------------ */

export async function protectPdfWithQpdf(options: {
    inputPath: string;
    outputBaseName: string;
    userPassword: string;
    ownerPassword?: string;
    permissions: PdfPermissions;
}): Promise<ProtectionResult> {
    validatePassword(options.userPassword, "user");
    if (options.ownerPassword) validatePassword(options.ownerPassword, "owner");

    const qpdf = await findQpdf();

    // Generate owner password if not provided
    const ownerPass = options.ownerPassword?.trim()
        ? options.ownerPassword
        : crypto.randomBytes(16).toString("hex");

    // Create output file path
    const tempDir = path.dirname(options.inputPath);
    const outputPath = path.join(tempDir, `${options.outputBaseName}_protected.pdf`);

    // Build qpdf arguments
    // Order: --encrypt user owner bits [options] -- input output
    const args: string[] = [
        "--encrypt",
        options.userPassword,
        ownerPass,
        "256", // AES-256 encryption
        ...buildPermissionsArgs(options.permissions),
        "--", // End of encryption options
        options.inputPath,
        outputPath,
    ];

    try {
        console.log(`[QPDF] Encrypting PDF with AES-256...`);
        const startTime = Date.now();

        await execFileAsync(qpdf, args, {
            timeout: 120000, // 2 minute timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        const elapsed = Date.now() - startTime;
        console.log(`[QPDF] Encryption completed in ${elapsed}ms`);

        // Read the encrypted output
        const pdfBytes = await fsp.readFile(outputPath);

        // Verify the output is valid
        if (pdfBytes.length < 100) {
            throw new ProtectPdfError("Output file is too small. Encryption may have failed.", 500, "encryption_failed");
        }

        // Check for %PDF- header
        const header = pdfBytes.subarray(0, 5).toString("utf8");
        if (header !== "%PDF-") {
            throw new ProtectPdfError("Invalid output file. Encryption may have failed.", 500, "encryption_failed");
        }

        // Verify encryption metadata exists
        if (!pdfBytes.includes("/Encrypt")) {
            throw new ProtectPdfError("Encryption metadata not found in output.", 500, "encryption_failed");
        }

        return {
            pdfBytes: Buffer.from(pdfBytes),
            fileName: `${options.outputBaseName}_protected.pdf`,
            contentType: "application/pdf",
        };
    } catch (error) {
        if (error instanceof ProtectPdfError) throw error;

        const err = error as any;
        const stderr = err.stderr || "";
        const message = err.message || "Unknown error";

        // Parse common qpdf errors
        if (stderr.includes("invalid password") || message.includes("invalid password")) {
            throw new ProtectPdfError("Invalid password format.", 400, "invalid_password");
        }
        if (stderr.includes("not a PDF file") || message.includes("not a PDF")) {
            throw new ProtectPdfError("Invalid or corrupt PDF file.", 400, "invalid_pdf");
        }
        if (stderr.includes("encrypted") || message.includes("encrypted")) {
            throw new ProtectPdfError("PDF is already encrypted. Please decrypt it first.", 400, "encrypted_pdf");
        }

        console.error(`[QPDF] Error: ${message}`, stderr);
        throw new ProtectPdfError(
            `Failed to protect PDF: ${message}`,
            500,
            "qpdf_error",
        );
    }
}

/* ------------------------------------------------------------------ */
/*  Convenience wrapper that handles File input                        */
/* ------------------------------------------------------------------ */

export async function protectPdf(options: {
    pdfBytes: Buffer;
    outputBaseName: string;
    userPassword: string;
    ownerPassword?: string;
    permissions: PdfPermissions;
}): Promise<ProtectionResult> {
    // Create temp directory and files
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "qpdf-protect-"));
    const inputPath = path.join(tempDir, "input.pdf");

    try {
        // Write input file
        await fsp.writeFile(inputPath, options.pdfBytes);

        // Validate PDF
        await assertPdfHeader(inputPath);
        await detectEncryptedPdf(inputPath);

        // Protect
        const result = await protectPdfWithQpdf({
            inputPath,
            outputBaseName: options.outputBaseName,
            userPassword: options.userPassword,
            ownerPassword: options.ownerPassword,
            permissions: options.permissions,
        });

        return result;
    } finally {
        // Cleanup temp directory
        try {
            await fsp.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}
