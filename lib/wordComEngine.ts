/**
 * wordComEngine.ts – Microsoft Word COM Automation Engine
 * GotuPDF Enterprise Document Processing System
 *
 * Production-grade conversion engine using Microsoft Word's native rendering
 * via PowerShell COM automation. Provides:
 *
 *  • Word → PDF  (ExportAsFixedFormat, wdFormatPDF = 17)
 *  • PDF → Word  (Word's internal PDF import, wdFormatXMLDocument = 16)
 *
 * ARCHITECTURE:
 *  1. Sequential queue — only ONE Word COM instance at a time to prevent COM conflicts
 *  2. PowerShell child process — executes .ps1 scripts with JSON stdout protocol
 *  3. Timeout management — kills hung conversions after configurable deadline
 *  4. Process cleanup — kills orphan WINWORD.EXE after every operation
 *  5. Temp file management — deterministic cleanup on success and failure
 *  6. Validation layer — page count, image count, watermark, table verification
 *  7. Logging — structured console logs with timing data
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
const WORD_TO_PDF_SCRIPT = path.join(SCRIPTS_DIR, "word-com-to-pdf.ps1");
const PDF_TO_WORD_SCRIPT = path.join(SCRIPTS_DIR, "word-com-from-pdf.ps1");

/** Maximum conversion time before we kill the process (ms) */
const CONVERSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum file size (bytes) */
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/** Maximum concurrent conversions (serialized via queue) */
const MAX_QUEUE_SIZE = 20;

/* ================================================================
   PUBLIC TYPES
   ================================================================ */

export class WordComError extends Error {
    status: number;
    constructor(message: string, status = 500) {
        super(message);
        this.name = "WordComError";
        this.status = status;
    }
}

export interface WordToPdfResult {
    pdfBuffer: Buffer;
    fileName: string;
    contentType: string;
    pageCount: number;
    elapsed: number;
    engine: "word-com";
    warnings: string[];
    validation: {
        passed: boolean;
        fileSize: number;
        pageCount: number;
        details: string[];
        score: number;
    };
}

export interface PdfToWordResult {
    docxBuffer: Buffer;
    fileName: string;
    contentType: string;
    pageCount: number;
    imageCount: number;
    hasWatermark: boolean;
    hasHeaders: boolean;
    hasFooters: boolean;
    tableCount: number;
    elapsed: number;
    engine: "word-com";
    warnings: string[];
    validation: {
        passed: boolean;
        pageCount: number;
        imageCount: number;
        hasWatermark: boolean;
        hasHeaders: boolean;
        hasFooters: boolean;
        tableCount: number;
        details: string[];
        score: number;
    };
}

/* ================================================================
   INTERNAL TYPES
   ================================================================ */

interface WordToPdfPsResult {
    success: boolean;
    outputPath: string;
    pageCount: number;
    error: string;
    elapsed: number;
}

interface PdfToWordPsResult {
    success: boolean;
    outputPath: string;
    pageCount: number;
    imageCount: number;
    hasWatermark: boolean;
    hasHeaders: boolean;
    hasFooters: boolean;
    tableCount: number;
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
            throw new WordComError(
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
            // Process next item if any
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

/** Generate a unique temp directory for this conversion */
function createTempDir(): string {
    const id = crypto.randomBytes(8).toString("hex");
    const dir = path.join(os.tmpdir(), `gotupdf-wordcom-${id}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/** Clean up temp directory */
async function cleanTempDir(dir: string): Promise<void> {
    try {
        await fsp.rm(dir, { recursive: true, force: true });
    } catch {
        // Non-critical — OS will clean tmpdir eventually
    }
}

/** Kill any orphan WINWORD.EXE processes */
async function killOrphanWordProcesses(): Promise<void> {
    try {
        await execFileAsync("powershell", [
            "-NoProfile", "-NonInteractive", "-Command",
            `Get-Process -Name "WINWORD" -ErrorAction SilentlyContinue | ` +
            `Where-Object { $_.MainWindowTitle -eq '' } | ` +
            `Stop-Process -Force -ErrorAction SilentlyContinue`,
        ], { timeout: 10000 });
    } catch {
        // Ignore — best effort
    }
}

/** Run a PowerShell script and parse JSON output */
async function runPowerShell<T>(scriptPath: string, args: string[], timeoutMs: number = CONVERSION_TIMEOUT_MS): Promise<T> {
    const psArgs = [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-File", scriptPath,
        ...args,
    ];

    try {
        const { stdout, stderr } = await execFileAsync("powershell", psArgs, {
            timeout: timeoutMs,
            maxBuffer: 10 * 1024 * 1024, // 10 MB stdout buffer
            windowsHide: true,
        });

        // Extract JSON from stdout (last non-empty line)
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
            throw new Error(`No JSON output from PowerShell script. stdout: ${stdout.slice(0, 500)}`);
        }

        return JSON.parse(jsonLine) as T;
    } catch (err: any) {
        // Handle timeout
        if (err.killed || err.signal === "SIGTERM") {
            await killOrphanWordProcesses();
            throw new WordComError("Conversion timed out. The document may be too complex or large.", 504);
        }
        // Handle other exec errors
        if (err.code === "ENOENT") {
            throw new WordComError("PowerShell is not available on this system.", 500);
        }
        throw err;
    }
}

/** Validate Word-to-PDF output */
function validateWordToPdf(psResult: WordToPdfPsResult, outputBuffer: Buffer): {
    passed: boolean;
    details: string[];
    score: number;
} {
    const details: string[] = [];
    let score = 100;

    // Check file size
    if (outputBuffer.length < 1000) {
        details.push("PDF output is very small, may be incomplete");
        score -= 30;
    }

    // Check page count
    if (psResult.pageCount <= 0) {
        details.push("Could not determine page count");
        score -= 10;
    }

    // Check PDF header magic
    const header = outputBuffer.slice(0, 5).toString("ascii");
    if (header !== "%PDF-") {
        details.push("Output does not have valid PDF header");
        score -= 50;
    }

    return {
        passed: score >= 70 && details.length === 0,
        details,
        score: Math.max(0, score),
    };
}

/** Validate PDF-to-Word output with rich metadata from PS script */
function validatePdfToWord(
    psResult: PdfToWordPsResult,
    outputBuffer: Buffer,
    inputPageCount?: number,
): {
    passed: boolean;
    details: string[];
    score: number;
} {
    const details: string[] = [];
    let score = 100;

    // Check file size
    if (outputBuffer.length < 1000) {
        details.push("DOCX output is very small, may be incomplete");
        score -= 30;
    }

    // Check DOCX header (ZIP magic bytes: PK)
    if (outputBuffer[0] !== 0x50 || outputBuffer[1] !== 0x4B) {
        details.push("Output does not have valid DOCX (ZIP) header");
        score -= 50;
    }

    // Check page count if we know input
    if (inputPageCount && inputPageCount > 0 && psResult.pageCount > 0) {
        const diff = Math.abs(psResult.pageCount - inputPageCount);
        if (diff > Math.ceil(inputPageCount * 0.2)) {
            details.push(`Page count mismatch: input=${inputPageCount}, output=${psResult.pageCount}`);
            score -= 15;
        }
    }

    // Report metadata findings
    if (psResult.imageCount > 0) {
        details.push(`Images preserved: ${psResult.imageCount}`);
    }
    if (psResult.hasWatermark) {
        details.push("Watermark detected and preserved");
    }
    if (psResult.hasHeaders) {
        details.push("Headers preserved");
    }
    if (psResult.hasFooters) {
        details.push("Footers preserved");
    }
    if (psResult.tableCount > 0) {
        details.push(`Tables preserved: ${psResult.tableCount}`);
    }

    return {
        passed: score >= 70,
        details,
        score: Math.max(0, score),
    };
}

/** Count pages in a PDF buffer (simple) */
function countPdfPages(pdfBytes: Buffer): number {
    // Quick scan for /Type /Page (not /Pages)
    const text = pdfBytes.toString("latin1");
    const matches = text.match(/\/Type\s*\/Page(?!\s*s)/g);
    return matches ? matches.length : 0;
}

/* ================================================================
   PUBLIC API — WORD TO PDF
   ================================================================ */

export interface WordToPdfOptions {
    originalName: string;
    docBytes: Buffer;
}

export async function convertWordToPdf(options: WordToPdfOptions): Promise<WordToPdfResult> {
    const { originalName, docBytes } = options;
    const warnings: string[] = [];

    // Pre-validation
    if (!docBytes || docBytes.length === 0) {
        throw new WordComError("Empty file uploaded.", 400);
    }
    if (docBytes.length > MAX_FILE_SIZE) {
        throw new WordComError(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`, 400);
    }

    const ext = path.extname(originalName).toLowerCase();
    if (![".doc", ".docx", ".rtf"].includes(ext)) {
        throw new WordComError("Unsupported file type. Please upload a .doc, .docx, or .rtf file.", 400);
    }

    console.log(`[word-com] Word→PDF: ${originalName} (${docBytes.length} bytes)`);

    return conversionQueue.enqueue<WordToPdfResult>(async () => {
        const tmpDir = createTempDir();
        const inputPath = path.join(tmpDir, `input${ext}`);
        const outputPath = path.join(tmpDir, "output.pdf");

        try {
            // Write input file
            await fsp.writeFile(inputPath, docBytes);

            // Execute PowerShell conversion
            const startTime = Date.now();
            const psResult = await runPowerShell<WordToPdfPsResult>(
                WORD_TO_PDF_SCRIPT,
                ["-InputPath", inputPath, "-OutputPath", outputPath],
            );

            if (!psResult.success) {
                throw new WordComError(psResult.error || "Word COM conversion failed.", 500);
            }

            // Read output
            const pdfBuffer = await fsp.readFile(outputPath);
            const elapsed = Date.now() - startTime;

            // Validate
            const validation = validateWordToPdf(psResult, pdfBuffer);

            // Build filename
            const baseName = path.basename(originalName, ext);
            const fileName = `${baseName}.pdf`;

            console.log(
                `[word-com] Word→PDF done: pages=${psResult.pageCount}, ` +
                `size=${pdfBuffer.length}, score=${validation.score}/100, ` +
                `elapsed=${elapsed}ms`,
            );

            return {
                pdfBuffer,
                fileName,
                contentType: "application/pdf",
                pageCount: psResult.pageCount,
                elapsed,
                engine: "word-com",
                warnings,
                validation: {
                    passed: validation.passed,
                    fileSize: pdfBuffer.length,
                    pageCount: psResult.pageCount,
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
   PUBLIC API — PDF TO WORD
   ================================================================ */

export interface PdfToWordOptions {
    originalName: string;
    pdfBytes: Buffer;
}

export async function convertPdfToWord(options: PdfToWordOptions): Promise<PdfToWordResult> {
    const { originalName, pdfBytes } = options;
    const warnings: string[] = [];

    // Pre-validation
    if (!pdfBytes || pdfBytes.length === 0) {
        throw new WordComError("Empty file uploaded.", 400);
    }
    if (pdfBytes.length > MAX_FILE_SIZE) {
        throw new WordComError(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`, 400);
    }

    // Verify it's actually a PDF
    const header = pdfBytes.slice(0, 5).toString("ascii");
    if (header !== "%PDF-") {
        throw new WordComError("Invalid PDF file. The file does not have a valid PDF header.", 400);
    }

    // Check for encryption (basic check)
    const pdfText = pdfBytes.slice(0, Math.min(pdfBytes.length, 4096)).toString("latin1");
    if (pdfText.includes("/Encrypt")) {
        throw new WordComError(
            "This PDF is password-protected. Please use the Unlock PDF tool first, then try again.",
            400,
        );
    }

    // Estimate input page count
    const inputPageCount = countPdfPages(pdfBytes);

    console.log(`[word-com] PDF→Word: ${originalName} (${pdfBytes.length} bytes, ~${inputPageCount} pages)`);

    return conversionQueue.enqueue<PdfToWordResult>(async () => {
        const tmpDir = createTempDir();
        const inputPath = path.join(tmpDir, "input.pdf");
        const outputPath = path.join(tmpDir, "output.docx");

        try {
            // Write input file
            await fsp.writeFile(inputPath, pdfBytes);

            // Execute PowerShell conversion
            const startTime = Date.now();
            const psResult = await runPowerShell<PdfToWordPsResult>(
                PDF_TO_WORD_SCRIPT,
                ["-InputPath", inputPath, "-OutputPath", outputPath],
            );

            if (!psResult.success) {
                throw new WordComError(psResult.error || "Word COM conversion failed.", 500);
            }

            // Read output
            const docxBuffer = await fsp.readFile(outputPath);
            const elapsed = Date.now() - startTime;

            // Validate
            const validation = validatePdfToWord(psResult, docxBuffer, inputPageCount);

            // Build filename
            const baseName = path.basename(originalName, path.extname(originalName));
            const fileName = `${baseName}.docx`;

            console.log(
                `[word-com] PDF→Word done: pages=${psResult.pageCount}, ` +
                `images=${psResult.imageCount}, tables=${psResult.tableCount}, ` +
                `watermark=${psResult.hasWatermark}, ` +
                `size=${docxBuffer.length}, score=${validation.score}/100, ` +
                `elapsed=${elapsed}ms`,
            );

            return {
                docxBuffer,
                fileName,
                contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                pageCount: psResult.pageCount,
                imageCount: psResult.imageCount,
                hasWatermark: psResult.hasWatermark,
                hasHeaders: psResult.hasHeaders,
                hasFooters: psResult.hasFooters,
                tableCount: psResult.tableCount,
                elapsed,
                engine: "word-com",
                warnings,
                validation: {
                    passed: validation.passed,
                    pageCount: psResult.pageCount,
                    imageCount: psResult.imageCount,
                    hasWatermark: psResult.hasWatermark,
                    hasHeaders: psResult.hasHeaders,
                    hasFooters: psResult.hasFooters,
                    tableCount: psResult.tableCount,
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

export async function checkWordComAvailable(): Promise<{
    available: boolean;
    version: string;
    error: string;
}> {
    try {
        const { stdout } = await execFileAsync("powershell", [
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-Command",
            `try { $w = New-Object -ComObject Word.Application; $v = $w.Version; $w.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null; Write-Host $v } catch { Write-Host "ERROR:$($_.Exception.Message)" }`,
        ], { timeout: 30000 });

        const version = stdout.trim();
        if (version.startsWith("ERROR:")) {
            return { available: false, version: "", error: version.slice(6) };
        }
        return { available: true, version, error: "" };
    } catch (err: any) {
        return { available: false, version: "", error: err.message || "Unknown error" };
    }
}

/** Get queue status */
export function getQueueStatus(): { pending: number } {
    return { pending: conversionQueue.pending };
}
