/**
 * pptComEngine.ts – Microsoft PowerPoint COM Automation Engine v2
 * GotuPDF Enterprise Document Processing System
 *
 * Production-grade PDF → PPTX conversion engine using PowerPoint's native
 * PDF import via PowerShell COM automation.
 *
 * ARCHITECTURE:
 *  1. Sequential queue — only ONE PowerPoint COM instance at a time
 *  2. PowerShell child process — executes .ps1 script with JSON stdout protocol
 *  3. Timeout management — kills hung conversions after deadline
 *  4. Process cleanup — kills orphan POWERPNT.EXE after every operation
 *  5. Temp file management — deterministic cleanup on success and failure
 *  6. Validation layer — slide count, backgrounds, shapes, images, fonts
 *  7. Retry with fallback — retries once on failure before reporting error
 *  8. Font reporting — detects missing fonts, preserves bold/italic/underline
 *  9. Logging — structured console logs with timing data
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

/* ================================================================
   CONSTANTS
   ================================================================ */

const SCRIPTS_DIR = path.join(process.cwd(), "scripts");
const PDF_TO_PPT_SCRIPT = path.join(SCRIPTS_DIR, "ppt-com-from-pdf.ps1");

/** Maximum conversion time before we kill the process (ms) */
const CONVERSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum file size (bytes) */
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/** Maximum concurrent conversions (serialized via queue) */
const MAX_QUEUE_SIZE = 20;

/** Retry once on transient failures */
const MAX_RETRIES = 1;

/* ================================================================
   PUBLIC TYPES
   ================================================================ */

export class PptComError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 500, code?: string) {
        super(message);
        this.name = "PptComError";
        this.status = status;
        this.code = code;
    }
}

export interface PdfToPptxResult {
    pptxBuffer: Buffer;
    fileName: string;
    contentType: string;
    slideCount: number;
    hasImages: boolean;
    hasBackgrounds: boolean;
    shapesCount: number;
    textBoxCount: number;
    tableCount: number;
    blankSlideCount: number;
    imageCount: number;
    hasWatermark: boolean;
    fontsUsed: string[];
    fontsMissing: string[];
    hasBoldText: boolean;
    hasItalicText: boolean;
    hasUnderlineText: boolean;
    elapsed: number;
    engine: "ppt-com";
    retryUsed: boolean;
    warnings: string[];
    validation: {
        passed: boolean;
        slideCount: number;
        hasImages: boolean;
        hasBackgrounds: boolean;
        shapesCount: number;
        textBoxCount: number;
        tableCount: number;
        blankSlideCount: number;
        imageCount: number;
        hasWatermark: boolean;
        fontsUsed: string[];
        fontsMissing: string[];
        details: string[];
        score: number;
    };
}

/* ================================================================
   INTERNAL TYPES
   ================================================================ */

interface PdfToPptxPsResult {
    success: boolean;
    outputPath: string;
    slideCount: number;
    hasImages: boolean;
    hasBackgrounds: boolean;
    shapesCount: number;
    textBoxCount: number;
    tableCount: number;
    blankSlideCount: number;
    fontsUsed: string[];
    fontsMissing: string[];
    hasWatermark: boolean;
    hasBoldText: boolean;
    hasItalicText: boolean;
    hasUnderlineText: boolean;
    imageCount: number;
    error: string;
    elapsed: number;
}

interface QueueItem {
    execute: () => Promise<void>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
}

/* ================================================================
   CONVERSION QUEUE (serialized COM access)
   ================================================================ */

class ConversionQueue {
    private queue: QueueItem[] = [];
    private running = false;

    async enqueue<T>(fn: () => Promise<T>): Promise<T> {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            throw new PptComError(
                "Server is busy. Too many conversions in queue. Please try again later.",
                503,
            );
        }

        return new Promise<T>((resolve, reject) => {
            this.queue.push({
                execute: fn as () => Promise<void>,
                resolve,
                reject,
            });
            this.processNext();
        });
    }

    private async processNext(): Promise<void> {
        if (this.running || this.queue.length === 0) return;
        this.running = true;

        const item = this.queue.shift()!;
        try {
            const result = await item.execute();
            item.resolve(result);
        } catch (err) {
            item.reject(err);
        } finally {
            this.running = false;
            if (this.queue.length > 0) {
                this.processNext();
            }
        }
    }

    get pending(): number {
        return this.queue.length;
    }
}

// Singleton queue instance
const conversionQueue = new ConversionQueue();

/* ================================================================
   UTILITY HELPERS
   ================================================================ */

/** Generate a unique temp directory */
function createTempDir(prefix = "gotupdf-pptcom"): string {
    const id = crypto.randomBytes(8).toString("hex");
    const dir = path.join(os.tmpdir(), `${prefix}-${id}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/** Clean up temp directory */
async function cleanTempDir(dir: string): Promise<void> {
    try {
        await fsp.rm(dir, { recursive: true, force: true });
    } catch {
        // Non-critical
    }
}

/** Kill any orphan POWERPNT.EXE processes (headless/no-window) */
async function killOrphanPptProcesses(): Promise<void> {
    try {
        await execFileAsync("powershell", [
            "-NoProfile", "-NonInteractive", "-Command",
            `Get-Process -Name "POWERPNT" -ErrorAction SilentlyContinue | ` +
            `Where-Object { $_.MainWindowTitle -eq '' } | ` +
            `Stop-Process -Force -ErrorAction SilentlyContinue`,
        ], { timeout: 10000 });
    } catch {
        // Ignore — best effort
    }
}

/** Run a PowerShell script and parse JSON output */
async function runPowerShell<T>(
    scriptPath: string,
    args: string[],
    timeoutMs: number = CONVERSION_TIMEOUT_MS,
): Promise<T> {
    const psArgs = [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-File", scriptPath,
        ...args,
    ];

    try {
        const { stdout } = await execFileAsync("powershell", psArgs, {
            timeout: timeoutMs,
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
        });

        // Extract JSON from stdout (last non-empty line starting with '{')
        const lines = stdout.trim().split("\n");
        let jsonLine = "";
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith("{")) {
                jsonLine = line;
                break;
            }
        }

        if (!jsonLine) {
            throw new Error(
                `No JSON output from PowerShell. stdout: ${stdout.slice(0, 500)}`,
            );
        }

        return JSON.parse(jsonLine) as T;
    } catch (err: any) {
        if (err.killed || err.signal === "SIGTERM") {
            await killOrphanPptProcesses();
            throw new PptComError(
                "Conversion timed out. The document may be too complex or large.",
                504,
                "TIMEOUT",
            );
        }
        if (err.code === "ENOENT") {
            throw new PptComError("PowerShell is not available on this system.", 500);
        }
        throw err;
    }
}

/** Count pages in a PDF buffer (quick regex scan) */
function countPdfPages(pdfBytes: Buffer): number {
    const text = pdfBytes.toString("latin1");
    const matches = text.match(/\/Type\s*\/Page(?!\s*s)/g);
    return matches ? matches.length : 0;
}

/** Determine if an error is transient and worth retrying */
function isTransientError(error: any): boolean {
    const msg = (error?.message || error?.error || "").toLowerCase();
    // COM RPC failures, DCOM timeouts, and spurious file locks are transient
    return (
        msg.includes("rpc") ||
        msg.includes("dcom") ||
        msg.includes("server") ||
        msg.includes("busy") ||
        msg.includes("lock") ||
        msg.includes("automation") ||
        msg.includes("timed out")
    );
}

/* ================================================================
   VALIDATION
   ================================================================ */

function validatePdfToPptx(
    psResult: PdfToPptxPsResult,
    outputBuffer: Buffer,
    inputPageCount?: number,
): {
    passed: boolean;
    details: string[];
    score: number;
} {
    const details: string[] = [];
    let score = 100;

    // ── File integrity ─────────────────────────────────────
    if (outputBuffer.length < 1000) {
        details.push("PPTX output is very small, may be incomplete");
        score -= 30;
    }

    // PPTX = ZIP (PK magic bytes)
    if (outputBuffer[0] !== 0x50 || outputBuffer[1] !== 0x4b) {
        details.push("Output does not have valid PPTX (ZIP) header");
        score -= 50;
    }

    // ── Slide count ────────────────────────────────────────
    if (psResult.slideCount <= 0) {
        details.push("No slides in output — conversion may have failed");
        score -= 40;
    }

    if (inputPageCount && inputPageCount > 0 && psResult.slideCount > 0) {
        if (psResult.slideCount !== inputPageCount) {
            const diff = Math.abs(psResult.slideCount - inputPageCount);
            if (diff > Math.ceil(inputPageCount * 0.2)) {
                details.push(
                    `Slide count mismatch: input=${inputPageCount}, output=${psResult.slideCount}`,
                );
                score -= 15;
            } else {
                details.push(
                    `Minor slide variance: input=${inputPageCount}, output=${psResult.slideCount}`,
                );
                score -= 5;
            }
        }
    }

    // ── Blank slides ───────────────────────────────────────
    if (psResult.blankSlideCount > 0) {
        const blankRatio = psResult.slideCount > 0
            ? psResult.blankSlideCount / psResult.slideCount
            : 1;
        if (blankRatio > 0.5) {
            details.push(
                `Majority blank slides: ${psResult.blankSlideCount}/${psResult.slideCount}`,
            );
            score -= 25;
        } else if (psResult.blankSlideCount > 0) {
            details.push(
                `Some blank slides: ${psResult.blankSlideCount}/${psResult.slideCount}`,
            );
            score -= 10;
        }
    }

    // ── Content completeness ───────────────────────────────
    if (
        psResult.slideCount > 0 &&
        psResult.shapesCount === 0 &&
        psResult.textBoxCount === 0
    ) {
        details.push("All slides appear blank — no shapes or text detected");
        score -= 25;
    }

    // ── Font coverage ──────────────────────────────────────
    if (psResult.fontsMissing && psResult.fontsMissing.length > 0) {
        details.push(
            `Missing fonts: ${psResult.fontsMissing.join(", ")}`,
        );
        score -= Math.min(10, psResult.fontsMissing.length * 2);
    }

    // ── Informational metadata (no score penalty) ──────────
    if (psResult.hasImages) {
        details.push(`Images preserved: ${psResult.imageCount}`);
    }
    if (psResult.hasBackgrounds) {
        details.push("Backgrounds preserved");
    }
    if (psResult.hasWatermark) {
        details.push("Watermark detected and preserved");
    }
    if (psResult.tableCount > 0) {
        details.push(`Tables: ${psResult.tableCount}`);
    }
    if (psResult.shapesCount > 0) {
        details.push(`Total shapes: ${psResult.shapesCount}`);
    }
    if (psResult.textBoxCount > 0) {
        details.push(`Text boxes: ${psResult.textBoxCount}`);
    }
    if (psResult.fontsUsed && psResult.fontsUsed.length > 0) {
        details.push(`Fonts used: ${psResult.fontsUsed.length}`);
    }

    // ── Formatting preservation ────────────────────────────
    const formatting: string[] = [];
    if (psResult.hasBoldText) formatting.push("bold");
    if (psResult.hasItalicText) formatting.push("italic");
    if (psResult.hasUnderlineText) formatting.push("underline");
    if (formatting.length > 0) {
        details.push(`Text formatting preserved: ${formatting.join(", ")}`);
    }

    return {
        passed: score >= 70,
        details,
        score: Math.max(0, score),
    };
}

/* ================================================================
   CORE CONVERSION — SINGLE ATTEMPT
   ================================================================ */

async function attemptConversion(
    inputPath: string,
    outputPath: string,
): Promise<PdfToPptxPsResult> {
    const psResult = await runPowerShell<PdfToPptxPsResult>(
        PDF_TO_PPT_SCRIPT,
        ["-InputPath", inputPath, "-OutputPath", outputPath],
    );

    if (!psResult.success) {
        throw new PptComError(
            psResult.error || "PowerPoint COM conversion failed.",
            500,
        );
    }

    return psResult;
}

/* ================================================================
   PUBLIC API — PDF TO PPTX
   ================================================================ */

export interface PdfToPptxOptions {
    originalName: string;
    pdfBytes: Buffer;
}

export async function convertPdfToPptx(
    options: PdfToPptxOptions,
): Promise<PdfToPptxResult> {
    const { originalName, pdfBytes } = options;
    const warnings: string[] = [];

    // ── Pre-validation ─────────────────────────────────────
    if (!pdfBytes || pdfBytes.length === 0) {
        throw new PptComError("Empty file uploaded.", 400);
    }
    if (pdfBytes.length > MAX_FILE_SIZE) {
        throw new PptComError(
            `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`,
            400,
        );
    }

    // Verify PDF header
    const header = pdfBytes.slice(0, 5).toString("ascii");
    if (header !== "%PDF-") {
        throw new PptComError(
            "Invalid PDF file. The file does not have a valid PDF header.",
            400,
        );
    }

    // Check for encryption (basic header scan)
    const pdfHead = pdfBytes
        .slice(0, Math.min(pdfBytes.length, 4096))
        .toString("latin1");
    if (pdfHead.includes("/Encrypt")) {
        throw new PptComError(
            "This PDF is password-protected. Please use the Unlock PDF tool first, then try again.",
            400,
            "ENCRYPTED",
        );
    }

    // Estimate input page count
    const inputPageCount = countPdfPages(pdfBytes);

    console.log(
        `[ppt-com] PDF→PPTX: ${originalName} (${pdfBytes.length} bytes, ~${inputPageCount} pages)`,
    );

    return conversionQueue.enqueue<PdfToPptxResult>(async () => {
        const tmpDir = createTempDir();
        const inputPath = path.join(tmpDir, "input.pdf");
        const outputPath = path.join(tmpDir, "output.pptx");

        try {
            await fsp.writeFile(inputPath, pdfBytes);

            let psResult: PdfToPptxPsResult | null = null;
            let retryUsed = false;
            let lastError: any = null;

            // ── Attempt with retry ─────────────────────────
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (attempt > 0) {
                        console.log(
                            `[ppt-com] Retry attempt ${attempt} for ${originalName}`,
                        );
                        retryUsed = true;
                        // Kill any leftover processes between retries
                        await killOrphanPptProcesses();
                        // Clean output from failed attempt
                        try {
                            await fsp.unlink(outputPath);
                        } catch {}
                        try {
                            await fsp.unlink(`${outputPath}.pptx`);
                        } catch {}
                        // Brief pause before retry
                        await new Promise((r) => setTimeout(r, 2000));
                    }

                    psResult = await attemptConversion(inputPath, outputPath);
                    lastError = null;
                    break; // success
                } catch (err: any) {
                    lastError = err;
                    // Only retry transient errors
                    if (attempt < MAX_RETRIES && isTransientError(err)) {
                        warnings.push(
                            `Attempt ${attempt + 1} failed: ${err.message || "unknown"}. Retrying...`,
                        );
                        continue;
                    }
                    throw err; // non-transient or out of retries
                }
            }

            if (!psResult) {
                throw lastError || new PptComError("Conversion produced no result.", 500);
            }

            // ── Locate output file ─────────────────────────
            let actualOutput = outputPath;
            if (!fs.existsSync(actualOutput) && fs.existsSync(`${outputPath}.pptx`)) {
                actualOutput = `${outputPath}.pptx`;
            }
            if (
                !fs.existsSync(actualOutput) &&
                psResult.outputPath &&
                fs.existsSync(psResult.outputPath)
            ) {
                actualOutput = psResult.outputPath;
            }

            if (!fs.existsSync(actualOutput)) {
                throw new PptComError(
                    "PPTX output file was not created by PowerPoint.",
                    500,
                );
            }

            // ── Read & validate ────────────────────────────
            const pptxBuffer = await fsp.readFile(actualOutput);
            const elapsed = Date.now() - (Date.now() - Math.round(psResult.elapsed));

            const validation = validatePdfToPptx(
                psResult,
                pptxBuffer,
                inputPageCount,
            );

            // Add retry warning if used
            if (retryUsed) {
                warnings.push("Conversion required a retry attempt.");
            }

            // Add font warnings
            if (psResult.fontsMissing && psResult.fontsMissing.length > 0) {
                warnings.push(
                    `Missing system fonts: ${psResult.fontsMissing.join(", ")}. Font substitution may have occurred.`,
                );
            }

            // Build filename
            const baseName = path.basename(originalName, path.extname(originalName));
            const fileName = `${baseName}.pptx`;

            console.log(
                `[ppt-com] PDF→PPTX done: slides=${psResult.slideCount}, ` +
                `shapes=${psResult.shapesCount}, images=${psResult.imageCount}, ` +
                `backgrounds=${psResult.hasBackgrounds}, tables=${psResult.tableCount}, ` +
                `blank=${psResult.blankSlideCount}, watermark=${psResult.hasWatermark}, ` +
                `fonts=${(psResult.fontsUsed || []).length} (${(psResult.fontsMissing || []).length} missing), ` +
                `size=${pptxBuffer.length}, score=${validation.score}/100, ` +
                `retry=${retryUsed}, elapsed=${Math.round(psResult.elapsed)}ms`,
            );

            return {
                pptxBuffer,
                fileName,
                contentType:
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                slideCount: psResult.slideCount,
                hasImages: psResult.hasImages,
                hasBackgrounds: psResult.hasBackgrounds,
                shapesCount: psResult.shapesCount,
                textBoxCount: psResult.textBoxCount,
                tableCount: psResult.tableCount,
                blankSlideCount: psResult.blankSlideCount,
                imageCount: psResult.imageCount,
                hasWatermark: psResult.hasWatermark,
                fontsUsed: psResult.fontsUsed || [],
                fontsMissing: psResult.fontsMissing || [],
                hasBoldText: psResult.hasBoldText,
                hasItalicText: psResult.hasItalicText,
                hasUnderlineText: psResult.hasUnderlineText,
                elapsed: Math.round(psResult.elapsed),
                engine: "ppt-com",
                retryUsed,
                warnings,
                validation: {
                    passed: validation.passed,
                    slideCount: psResult.slideCount,
                    hasImages: psResult.hasImages,
                    hasBackgrounds: psResult.hasBackgrounds,
                    shapesCount: psResult.shapesCount,
                    textBoxCount: psResult.textBoxCount,
                    tableCount: psResult.tableCount,
                    blankSlideCount: psResult.blankSlideCount,
                    imageCount: psResult.imageCount,
                    hasWatermark: psResult.hasWatermark,
                    fontsUsed: psResult.fontsUsed || [],
                    fontsMissing: psResult.fontsMissing || [],
                    details: validation.details,
                    score: validation.score,
                },
            };
        } finally {
            await cleanTempDir(tmpDir);
        }
    });
}

/* ================================================================
   HEALTH CHECK
   ================================================================ */

export async function checkPptComAvailable(): Promise<{
    available: boolean;
    version: string;
    error: string;
}> {
    try {
        const { stdout } = await execFileAsync("powershell", [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            `try { $p = New-Object -ComObject PowerPoint.Application; $v = $p.Version; $p.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($p) | Out-Null; Write-Host $v } catch { Write-Host "ERROR:$($_.Exception.Message)" }`,
        ], { timeout: 30000 });

        const version = stdout.trim();
        if (version.startsWith("ERROR:")) {
            return { available: false, version: "", error: version.slice(6) };
        }
        return { available: true, version, error: "" };
    } catch (err: any) {
        return {
            available: false,
            version: "",
            error: err.message || "Unknown error",
        };
    }
}

/** Get queue status */
export function getQueueStatus(): { pending: number } {
    return { pending: conversionQueue.pending };
}
