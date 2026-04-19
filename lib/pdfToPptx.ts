/**
 * Pure JavaScript PDF → PPTX conversion engine
 *
 * Uses:
 *  • pdfjs-dist  – text extraction with positions from PDF pages
 *  • pptxgenjs   – PPTX creation with positioned text blocks
 *
 * No external binaries, no API keys, no ConvertAPI, no LibreOffice.
 */

import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/* ------------------------------------------------------------------ */
/*  Error class                                                        */
/* ------------------------------------------------------------------ */

export class PdfToPptxError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 500, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TempFileResult {
    tempDir: string;
    filePath: string;
    cleanup: () => Promise<void>;
}

export interface ConversionResult {
    pptxBuffer: Buffer;
    fileName: string;
    contentType: string;
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

export function sanitizeBaseName(name: string) {
    const base = name.replace(/\.[^/.]+$/, "");
    const safe = base.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 80) || "converted";
}

export async function saveFileToTemp(file: File, prefix = "pdf-to-ppt"): Promise<TempFileResult> {
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
    const extension = path.extname(file.name || ".pdf") || ".pdf";
    const fileName = `${prefix}-${crypto.randomUUID()}${extension}`;
    const filePath = path.join(tempDir, fileName);
    const nodeStream = Readable.fromWeb(file.stream() as any);
    await pipeline(nodeStream, fs.createWriteStream(filePath));
    return { tempDir, filePath, cleanup: async () => fsp.rm(tempDir, { recursive: true, force: true }) };
}

export async function assertPdfHeader(filePath: string) {
    const fd = await fsp.open(filePath, "r");
    try {
        const buf = Buffer.alloc(5);
        await fd.read(buf, 0, 5, 0);
        if (buf.toString("utf8") !== "%PDF-") {
            throw new PdfToPptxError("Invalid PDF file.", 400, "invalid_pdf");
        }
    } finally {
        await fd.close();
    }
}

export async function detectEncryptedPdf(filePath: string) {
    const fd = await fsp.open(filePath, "r");
    try {
        const max = 2 * 1024 * 1024;
        const buf = Buffer.alloc(max);
        const { bytesRead } = await fd.read(buf, 0, max, 0);
        if (buf.subarray(0, bytesRead).includes("/Encrypt")) {
            throw new PdfToPptxError(
                "This PDF is encrypted. Please unlock it first.",
                400,
                "encrypted_pdf",
            );
        }
    } finally {
        await fd.close();
    }
}

/* ------------------------------------------------------------------ */
/*  Text item grouping helpers                                         */
/* ------------------------------------------------------------------ */

interface ExtractedText {
    text: string;
    x: number; // PDF points, from left
    y: number; // PDF points, from bottom
    fontSize: number;
    fontFamily: string;
    isBold: boolean;
    isItalic: boolean;
    width: number;
    color: string; // hex "RRGGBB"
}

interface TextLine {
    items: ExtractedText[];
    y: number;
    x: number;
    endX: number;
}

/**
 * Group text items on the same y-level into lines (within tolerance).
 */
function groupIntoLines(items: ExtractedText[], tolerance = 3): TextLine[] {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: TextLine[] = [];
    let current: TextLine = { items: [sorted[0]], y: sorted[0].y, x: sorted[0].x, endX: sorted[0].x + sorted[0].width };

    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i];
        if (Math.abs(item.y - current.y) <= tolerance) {
            current.items.push(item);
            current.endX = Math.max(current.endX, item.x + item.width);
            current.x = Math.min(current.x, item.x);
        } else {
            lines.push(current);
            current = { items: [item], y: item.y, x: item.x, endX: item.x + item.width };
        }
    }
    lines.push(current);
    return lines;
}

/* ------------------------------------------------------------------ */
/*  Core conversion                                                    */
/* ------------------------------------------------------------------ */

export async function convertPdfToPptx(options: {
    filePath: string;
    originalName: string;
}): Promise<ConversionResult> {
    // Dynamic import (pdfjs-dist is server-external, pptxgenjs is bundled)
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "";

    const PptxGenJS = (await import("pptxgenjs")).default;

    const fileBytes = await fsp.readFile(options.filePath);
    const uint8 = new Uint8Array(fileBytes);

    const doc = await pdfjs.getDocument({
        data: uint8,
        disableWorker: true,
        isEvalSupported: false,
    } as any).promise;

    const numPages = doc.numPages;
    if (numPages === 0) {
        throw new PdfToPptxError("PDF has no pages.", 400, "empty_pdf");
    }

    // Determine page size from first page (used for presentation layout)
    const firstPage = await doc.getPage(1);
    const vp = firstPage.getViewport({ scale: 1 });
    const pageWidthIn = vp.width / 72;
    const pageHeightIn = vp.height / 72;

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "PDF", width: pageWidthIn, height: pageHeightIn });
    pptx.layout = "PDF";
    pptx.author = "GotuPDF";
    pptx.title = options.originalName.replace(/\.pdf$/i, "");

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const pH = viewport.height;
        const pW = viewport.width;
        const wIn = pW / 72;
        const hIn = pH / 72;

        const textContent = await page.getTextContent();
        const styles: Record<string, any> = (textContent as any).styles || {};

        // Extract text items with position info
        const extracted: ExtractedText[] = [];
        for (const item of textContent.items) {
            if (!("str" in item) || !(item as any).str) continue;
            const ti = item as any;
            const tx = ti.transform[4];
            const ty = ti.transform[5];
            const scaleX = Math.sqrt(ti.transform[0] ** 2 + ti.transform[1] ** 2);
            const fontSize = Math.max(Math.round(scaleX * 10) / 10, 4);
            const style = styles[ti.fontName] || {};
            const family = style.fontFamily || "Arial";
            const isBold = /bold/i.test(family) || /bold/i.test(ti.fontName || "");
            const isItalic = /italic|oblique/i.test(family) || /italic|oblique/i.test(ti.fontName || "");

            extracted.push({
                text: ti.str,
                x: tx,
                y: ty,
                fontSize,
                fontFamily: family.replace(/[,;]/g, "").split(/\s+/)[0] || "Arial",
                isBold,
                isItalic,
                width: ti.width || fontSize * ti.str.length * 0.5,
                color: "333333",
            });
        }

        const slide = pptx.addSlide();

        // Add a subtle white background
        slide.background = { color: "FFFFFF" };

        if (extracted.length === 0) {
            // Empty page – add placeholder note
            slide.addText(`Page ${pageNum}`, {
                x: 0.5,
                y: hIn / 2 - 0.25,
                w: wIn - 1,
                h: 0.5,
                fontSize: 14,
                color: "999999",
                align: "center",
            });
            continue;
        }

        // Group items into lines for better readability
        const lines = groupIntoLines(extracted);

        for (const line of lines) {
            // Sort items in line left-to-right
            line.items.sort((a, b) => a.x - b.x);

            // Build text runs for this line
            const textRuns: Array<{ text: string; options: any }> = [];
            for (const item of line.items) {
                textRuns.push({
                    text: item.text,
                    options: {
                        fontSize: Math.round(item.fontSize),
                        fontFace: sanitizeFontName(item.fontFamily),
                        bold: item.isBold,
                        italic: item.isItalic,
                        color: item.color,
                    },
                });
            }

            // Convert PDF coordinates to PPTX inches
            const xIn = Math.max(0, line.x / 72);
            const yIn = Math.max(0, (pH - line.y) / 72 - (line.items[0].fontSize / 72));
            const lineWidth = Math.max(0.5, (line.endX - line.x) / 72 + 0.3);

            // Clamp to slide bounds
            const clampX = Math.min(xIn, wIn - 0.2);
            const clampY = Math.min(yIn, hIn - 0.2);

            slide.addText(textRuns, {
                x: clampX,
                y: clampY,
                w: Math.min(lineWidth, wIn - clampX),
                h: Math.max(0.3, (line.items[0].fontSize * 1.4) / 72),
                valign: "top",
                shrinkText: true,
                autoFit: true,
            });
        }
    }

    // Generate PPTX buffer
    const pptxBuffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    const fileName = `${sanitizeBaseName(options.originalName)}.pptx`;

    return {
        pptxBuffer,
        fileName,
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
}

/* ------------------------------------------------------------------ */
/*  Font name cleanup                                                  */
/* ------------------------------------------------------------------ */

function sanitizeFontName(raw: string): string {
    // Map common PDF embedded font names to system-friendly names
    const lower = raw.toLowerCase();
    if (lower.includes("times") || lower.includes("serif")) return "Times New Roman";
    if (lower.includes("courier") || lower.includes("mono")) return "Courier New";
    if (lower.includes("arial") || lower.includes("helvet") || lower.includes("sans")) return "Arial";
    if (lower.includes("calibri")) return "Calibri";
    if (lower.includes("cambria")) return "Cambria";
    // Default fallback
    return "Arial";
}
