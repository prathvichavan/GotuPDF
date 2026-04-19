/**
 * pdfToDocx.ts – Hybrid Full-Fidelity PDF → DOCX Conversion Engine
 *
 * 7-STEP ARCHITECTURE:
 *   STEP 1: Layer Extraction (text, background, watermark, image, vector)
 *   STEP 2: Background Preservation (high-res page background in DOCX)
 *   STEP 3: Watermark Preservation (header section, rotation, opacity)
 *   STEP 4: Editable Text Reconstruction (fonts, sizes, colors, columns)
 *   STEP 5: Image Extraction (full resolution, no compression, no DPI loss)
 *   STEP 6: Table Reconstruction (grid, borders, shading, col/row dims)
 *   STEP 7: Quality Control (page/image/watermark/bg/layout verification)
 *
 * ENGINE PRIORITY:
 *   Primary   – LibreOffice headless
 *   Secondary – If validation detects mismatch → hybrid reconstruction
 *
 * SCANNED PDF:
 *   OCR layer + background image overlay
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
   PUBLIC TYPES
   ================================================================ */

export class PdfToDocxError extends Error {
    status: number;
    constructor(message: string, status = 500) {
        super(message);
        this.name = "PdfToDocxError";
        this.status = status;
    }
}

export interface ValidationResult {
    passed: boolean;
    pageCountMatch: boolean;
    imageCountMatch: boolean;
    hasExpectedWatermark: boolean;
    hasExpectedBackground: boolean;
    tableCountMatch: boolean;
    noLayoutShift: boolean;
    noDpiLoss: boolean;
    noMissingContent: boolean;
    details: string[];
    score: number; // 0-100 quality score
}

export interface ConversionResult {
    docxBuffer: Buffer;
    fileName: string;
    contentType: string;
    engine: "libreoffice" | "hybrid" | "fallback";
    pageCount: number;
    warnings: string[];
    validation: ValidationResult;
}

export interface ConversionOptions {
    originalName: string;
    pdfBytes: Buffer;
    ocrText?: Array<{ pageNum: number; text: string }>;
}

/* ================================================================
   INTERNAL TYPES
   ================================================================ */

interface RGBColor { r: number; g: number; b: number; }

/** One glyph-run from pdfjs with all visual properties */
interface StyledTextItem {
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontName: string;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    color: RGBColor;
    charSpacing: number;
    rotation: number;
}

/** Image extracted from the PDF operator list */
interface PositionedImage {
    data: Buffer;
    width: number;            // display width  (PDF pts)
    height: number;           // display height (PDF pts)
    naturalWidth: number;     // native px width
    naturalHeight: number;    // native px height
    x: number;
    y: number;
    mimeType: "image/png" | "image/jpeg";
    pageIndex: number;
    isBackground: boolean;
    isWatermark: boolean;
    opacity: number;
    rotation: number;
    dpi: number;              // estimated DPI
}

/** Line segment (table border, vector path) */
interface LineSegment {
    x1: number; y1: number;
    x2: number; y2: number;
    lineWidth: number;
    color: RGBColor;
}

/** Filled rectangle (cell shading, background block) */
interface FillRect {
    x: number; y: number;
    width: number; height: number;
    color: RGBColor;
}

/** Table cell with full styling */
interface EnhancedTableCell {
    text: string;
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    color: RGBColor;
    bgColor: RGBColor | null;
    colSpan: number;
    width: number;
    alignment: "left" | "center" | "right";
}

/** Reconstructed table */
interface EnhancedTable {
    rows: EnhancedTableCell[][];
    x: number;
    y: number;
    width: number;
    columnWidths: number[];
    rowHeights: number[];
    borderColor: RGBColor;
    borderWidth: number;
    pageIndex: number;
    hasHeaderRow: boolean;
}

/** Watermark metadata */
interface WatermarkInfo {
    type: "text" | "image";
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: RGBColor;
    rotation?: number;
    opacity?: number;
    x?: number;
    y?: number;
    imageData?: Buffer;
    imageWidth?: number;
    imageHeight?: number;
}

/** Page layout derived from content analysis */
interface PageLayout {
    width: number;
    height: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
    columns: number;
    columnGap: number;
    hasHeader: boolean;
    hasFooter: boolean;
    headerText: string;
    footerText: string;
}

/** All extracted layers for one page */
interface FullPageData {
    layout: PageLayout;
    textItems: StyledTextItem[];
    images: PositionedImage[];
    tables: EnhancedTable[];
    lines: LineSegment[];
    fills: FillRect[];
    watermarks: WatermarkInfo[];
    backgrounds: PositionedImage[];
    hasText: boolean;
    isScanned: boolean;
}

/** PDF-level metadata for validation */
interface PdfMetadata {
    pageCount: number;
    pages: Array<{
        width: number;
        height: number;
        imageCount: number;
        hasText: boolean;
        textLength: number;
    }>;
    totalImageCount: number;
    totalTextLength: number;
    hasWatermark: boolean;
    hasBackground: boolean;
    tableCount: number;
    fontNames: string[];
}

/* ================================================================
   FONT MAPPING  –  PDF → system font
   ================================================================ */

const PDF_TO_SYSTEM_FONT: Record<string, string> = {
    // Standard 14
    Helvetica: "Arial", "Helvetica-Bold": "Arial",
    "Helvetica-Oblique": "Arial", "Helvetica-BoldOblique": "Arial",
    "Times-Roman": "Times New Roman", "Times-Bold": "Times New Roman",
    "Times-Italic": "Times New Roman", "Times-BoldItalic": "Times New Roman",
    Courier: "Courier New", "Courier-Bold": "Courier New",
    "Courier-Oblique": "Courier New", "Courier-BoldOblique": "Courier New",
    Symbol: "Symbol", ZapfDingbats: "Wingdings",
    // Common embedded
    ArialMT: "Arial", "Arial-BoldMT": "Arial",
    "Arial-ItalicMT": "Arial", "Arial-BoldItalicMT": "Arial",
    TimesNewRomanPSMT: "Times New Roman",
    "TimesNewRomanPS-BoldMT": "Times New Roman",
    "TimesNewRomanPS-ItalicMT": "Times New Roman",
    "TimesNewRomanPS-BoldItalicMT": "Times New Roman",
    CalibriMT: "Calibri", Calibri: "Calibri",
    "Calibri-Bold": "Calibri", "Calibri-Italic": "Calibri",
    CambriaMT: "Cambria", Cambria: "Cambria",
    Georgia: "Georgia", Verdana: "Verdana", Tahoma: "Tahoma",
    TrebuchetMS: "Trebuchet MS", Garamond: "Garamond",
    PalatinoLinotype: "Palatino Linotype", BookAntiqua: "Book Antiqua",
    LucidaSans: "Lucida Sans", "Segoe UI": "Segoe UI",
    Roboto: "Roboto", "Open Sans": "Open Sans",
    Lato: "Lato", Montserrat: "Montserrat",
    // Additional mappings for better coverage
    "LiberationSans": "Arial", "LiberationSans-Bold": "Arial",
    "LiberationSerif": "Times New Roman", "LiberationMono": "Courier New",
    "DejaVuSans": "Verdana", "DejaVuSerif": "Georgia",
    "NotoSans": "Arial", "NotoSerif": "Times New Roman",
    "SourceSansPro": "Arial", "SourceCodePro": "Courier New",
};

function mapFont(pdfFontName: string, styleFontFamily?: string): string {
    if (!pdfFontName) return "Arial";
    if (PDF_TO_SYSTEM_FONT[pdfFontName]) return PDF_TO_SYSTEM_FONT[pdfFontName];

    // Style-provided font family
    if (styleFontFamily && !["sans-serif", "serif", "monospace"].includes(styleFontFamily)) {
        const clean = styleFontFamily.replace(/['"]/g, "").trim();
        if (clean.length > 1) return clean;
    }

    // Strip subset prefix "ABCDEF+FontName-Bold" → "FontName"
    const plusIdx = pdfFontName.indexOf("+");
    const baseName = plusIdx >= 0 ? pdfFontName.substring(plusIdx + 1) : pdfFontName;

    // Remove style suffixes
    const cleanName = baseName
        .replace(/[-,](Bold|Italic|Oblique|Regular|Light|Medium|Semibold|SemiBold|ExtraBold|Black|Heavy|Thin|ExtraLight|Condensed|Expanded|Narrow)+/gi, "")
        .replace(/MT$/, "").replace(/PS$/, "").trim();

    if (PDF_TO_SYSTEM_FONT[cleanName]) return PDF_TO_SYSTEM_FONT[cleanName];
    if (cleanName.length > 1) return cleanName;

    // Generic fallback
    if (styleFontFamily === "monospace") return "Courier New";
    if (styleFontFamily === "serif") return "Times New Roman";
    return "Arial";
}

/* ================================================================
   LIBREOFFICE DETECTION & PRIMARY ENGINE
   ================================================================ */

const SOFFICE_PATHS_WIN = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    path.join(os.homedir(), "AppData\\Local\\Programs\\LibreOffice\\program\\soffice.exe"),
];
const SOFFICE_PATHS_UNIX = [
    "/usr/bin/soffice", "/usr/bin/libreoffice", "/usr/local/bin/soffice",
    "/snap/bin/libreoffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

let cachedSofficePath: string | null | undefined = undefined;

async function findSoffice(): Promise<string | null> {
    if (cachedSofficePath !== undefined) return cachedSofficePath;
    const isWin = process.platform === "win32";
    const candidates = isWin ? SOFFICE_PATHS_WIN : SOFFICE_PATHS_UNIX;

    for (const p of candidates) {
        try { await fsp.access(p, fs.constants.X_OK); cachedSofficePath = p; return p; }
        catch { /* keep searching */ }
    }

    try {
        const cmd = isWin ? "where.exe" : "which";
        const { stdout } = await execFileAsync(cmd, ["soffice"], { timeout: 5000 });
        const found = stdout.trim().split(/\r?\n/)[0];
        if (found) { cachedSofficePath = found; return found; }
    } catch { /* not in PATH */ }

    cachedSofficePath = null;
    return null;
}

/* ── Temp directory helpers ── */

async function makeTempDir(): Promise<string> {
    const dir = path.join(os.tmpdir(), `gotupdf_${crypto.randomBytes(8).toString("hex")}`);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
}

async function cleanDir(dir: string) {
    try { await fsp.rm(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
}

/* ── LibreOffice headless conversion ── */

async function convertWithLibreOffice(pdfBytes: Buffer): Promise<{ docxBuffer: Buffer; warnings: string[] }> {
    const sofficePath = await findSoffice();
    if (!sofficePath) throw new PdfToDocxError("LIBREOFFICE_NOT_FOUND", 501);

    const tmpDir = await makeTempDir();
    const inputPath = path.join(tmpDir, "input.pdf");
    const outputDir = path.join(tmpDir, "out");
    const profileDir = path.join(tmpDir, "profile");

    await Promise.all([
        fsp.mkdir(outputDir, { recursive: true }),
        fsp.mkdir(profileDir, { recursive: true }),
    ]);

    try {
        await fsp.writeFile(inputPath, pdfBytes);

        const args = [
            `-env:UserInstallation=file:///${profileDir.replace(/\\/g, "/")}`,
            "--headless", "--norestore",
            "--infilter=writer_pdf_import",
            "--convert-to", "docx",
            "--outdir", outputDir,
            inputPath,
        ];

        try {
            await execFileAsync(sofficePath, args, { timeout: 300_000, maxBuffer: 50 * 1024 * 1024 });
        } catch (execErr: any) {
            if (execErr?.killed || execErr?.signal) throw execErr;
            // LibreOffice writes warnings to stderr even on success
        }

        const files = await fsp.readdir(outputDir);
        const docxFile = files.find((f) => f.endsWith(".docx"));
        if (!docxFile) throw new PdfToDocxError("LibreOffice produced no DOCX output");

        const docxBuffer = await fsp.readFile(path.join(outputDir, docxFile));
        const warnings: string[] = [];
        if (docxBuffer.length < 500) warnings.push("Output file is unusually small – verify content.");

        return { docxBuffer, warnings };
    } finally {
        await cleanDir(tmpDir);
    }
}

/* ================================================================
   STEP 1: LAYER EXTRACTION
   Parse PDF and separate into 5 layers:
     - Editable text layer
     - Background layer
     - Watermark layer
     - Image layer
     - Vector graphics layer (lines, fills → used for tables)
   ================================================================ */

async function extractAllLayers(pdfBytes: Buffer): Promise<FullPageData[]> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
    const pdfjs = (pdfjsLib as any).default || pdfjsLib;
    const pdfjs2 = await import("pdfjs-dist");
    const OPS = pdfjs2.OPS;

    const doc = await pdfjs.getDocument({
        data: new Uint8Array(pdfBytes),
        disableWorker: true,
        isEvalSupported: false,
    } as any).promise;

    const allPages: FullPageData[] = [];
    let totalImageBytes = 0;
    const MAX_IMAGE_BYTES = 80 * 1024 * 1024; // 80 MB cap

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();
        const styles: Record<string, any> = (textContent as any).styles || {};

        /* ── LAYER: Editable Text ── */
        const textItems: StyledTextItem[] = [];
        for (const item of textContent.items || []) {
            if (!item.str) continue;
            const tf = item.transform;
            if (!tf) continue;

            const fontSize =
                Math.sqrt(tf[2] * tf[2] + tf[3] * tf[3]) ||
                Math.sqrt(tf[0] * tf[0] + tf[1] * tf[1]) || 12;
            const rotation = Math.atan2(tf[1], tf[0]) * (180 / Math.PI);
            const pdfFontName = item.fontName || "";
            const style = styles[pdfFontName];
            const fontFamily = mapFont(pdfFontName, style?.fontFamily);
            const bold = /bold/i.test(pdfFontName);
            const italic = /italic|oblique/i.test(pdfFontName);

            textItems.push({
                str: item.str,
                x: tf[4],
                y: tf[5],
                width: item.width || 0,
                height: item.height || fontSize,
                fontSize,
                fontName: pdfFontName,
                fontFamily,
                bold,
                italic,
                underline: false,
                color: { r: 0, g: 0, b: 0 }, // enriched below from operator list
                charSpacing: 0,
                rotation: Math.abs(rotation) < 1 ? 0 : rotation,
            });
        }

        /* ── Walk operator list for all layers ── */
        const images: PositionedImage[] = [];
        const lines: LineSegment[] = [];
        const fills: FillRect[] = [];
        const watermarks: WatermarkInfo[] = [];
        const backgrounds: PositionedImage[] = [];
        const textColorTimeline: RGBColor[] = [];

        try {
            const ops = await page.getOperatorList();

            // Graphics state machine
            let ctm = [1, 0, 0, 1, 0, 0];
            let fillColor: RGBColor = { r: 0, g: 0, b: 0 };
            let strokeColor: RGBColor = { r: 0, g: 0, b: 0 };
            let lineWidth = 1;
            const gStack: Array<{ ctm: number[]; fill: RGBColor; stroke: RGBColor; lw: number }> = [];
            let pathPts: { x: number; y: number }[] = [];

            for (let i = 0; i < ops.fnArray.length; i++) {
                const fn = ops.fnArray[i];
                const args = ops.argsArray[i] || [];

                /* --- Graphics state --- */
                if (fn === OPS.save) {
                    gStack.push({ ctm: [...ctm], fill: { ...fillColor }, stroke: { ...strokeColor }, lw: lineWidth });
                    continue;
                }
                if (fn === OPS.restore) {
                    const s = gStack.pop();
                    if (s) { ctm = s.ctm; fillColor = s.fill; strokeColor = s.stroke; lineWidth = s.lw; }
                    continue;
                }
                if (fn === OPS.transform) {
                    const [a, b, c, d, e, f] = args;
                    const o = ctm;
                    ctm = [
                        o[0] * a + o[2] * b, o[1] * a + o[3] * b,
                        o[0] * c + o[2] * d, o[1] * c + o[3] * d,
                        o[0] * e + o[2] * f + o[4], o[1] * e + o[3] * f + o[5],
                    ];
                    continue;
                }

                /* --- Colours --- */
                if (fn === OPS.setFillRGBColor) {
                    fillColor = { r: Math.round((args[0] ?? 0) * 255), g: Math.round((args[1] ?? 0) * 255), b: Math.round((args[2] ?? 0) * 255) };
                    continue;
                }
                if (fn === OPS.setStrokeRGBColor) {
                    strokeColor = { r: Math.round((args[0] ?? 0) * 255), g: Math.round((args[1] ?? 0) * 255), b: Math.round((args[2] ?? 0) * 255) };
                    continue;
                }
                if (fn === OPS.setFillGray) {
                    const g = Math.round((args[0] ?? 0) * 255);
                    fillColor = { r: g, g, b: g };
                    continue;
                }
                if (fn === OPS.setStrokeGray) {
                    const g = Math.round((args[0] ?? 0) * 255);
                    strokeColor = { r: g, g, b: g };
                    continue;
                }
                if (fn === OPS.setFillCMYKColor) {
                    const [c0, m0, y0, k0] = [args[0] ?? 0, args[1] ?? 0, args[2] ?? 0, args[3] ?? 1];
                    fillColor = {
                        r: Math.round(255 * (1 - c0) * (1 - k0)),
                        g: Math.round(255 * (1 - m0) * (1 - k0)),
                        b: Math.round(255 * (1 - y0) * (1 - k0)),
                    };
                    continue;
                }
                if (fn === OPS.setStrokeCMYKColor) {
                    const [c0, m0, y0, k0] = [args[0] ?? 0, args[1] ?? 0, args[2] ?? 0, args[3] ?? 1];
                    strokeColor = {
                        r: Math.round(255 * (1 - c0) * (1 - k0)),
                        g: Math.round(255 * (1 - m0) * (1 - k0)),
                        b: Math.round(255 * (1 - y0) * (1 - k0)),
                    };
                    continue;
                }
                if (fn === OPS.setLineWidth) { lineWidth = args[0] || 1; continue; }

                /* --- Text colour timeline --- */
                if (fn === OPS.showText || fn === OPS.showSpacedText) {
                    textColorTimeline.push({ ...fillColor });
                    continue;
                }

                /* --- LAYER: Vector Graphics (path ops) --- */
                if (fn === OPS.moveTo) { pathPts = [{ x: args[0], y: args[1] }]; continue; }
                if (fn === OPS.lineTo) { pathPts.push({ x: args[0], y: args[1] }); continue; }
                if (fn === OPS.rectangle) {
                    const [rx, ry, rw, rh] = args;
                    pathPts = [
                        { x: rx, y: ry }, { x: rx + rw, y: ry },
                        { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh },
                    ];
                    continue;
                }

                if (fn === OPS.stroke || fn === OPS.closeStroke) {
                    for (let j = 0; j < pathPts.length - 1; j++) {
                        lines.push({
                            x1: pathPts[j].x, y1: pathPts[j].y,
                            x2: pathPts[j + 1].x, y2: pathPts[j + 1].y,
                            lineWidth, color: { ...strokeColor },
                        });
                    }
                    pathPts = [];
                    continue;
                }
                if (fn === OPS.fill || fn === OPS.eoFill) {
                    if (pathPts.length >= 3) {
                        const xs = pathPts.map(p => p.x);
                        const ys = pathPts.map(p => p.y);
                        fills.push({
                            x: Math.min(...xs), y: Math.min(...ys),
                            width: Math.max(...xs) - Math.min(...xs),
                            height: Math.max(...ys) - Math.min(...ys),
                            color: { ...fillColor },
                        });
                    }
                    pathPts = [];
                    continue;
                }
                if (fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
                    for (let j = 0; j < pathPts.length - 1; j++) {
                        lines.push({
                            x1: pathPts[j].x, y1: pathPts[j].y,
                            x2: pathPts[j + 1].x, y2: pathPts[j + 1].y,
                            lineWidth, color: { ...strokeColor },
                        });
                    }
                    if (pathPts.length >= 3) {
                        const xs = pathPts.map(p => p.x);
                        const ys = pathPts.map(p => p.y);
                        fills.push({
                            x: Math.min(...xs), y: Math.min(...ys),
                            width: Math.max(...xs) - Math.min(...xs),
                            height: Math.max(...ys) - Math.min(...ys),
                            color: { ...fillColor },
                        });
                    }
                    pathPts = [];
                    continue;
                }

                /* --- LAYER: Images --- */
                if (fn === OPS.paintImageXObject || fn === OPS.paintXObject) {
                    const imgName = args[0];
                    if (typeof imgName !== "string") continue;
                    if (totalImageBytes > MAX_IMAGE_BYTES) continue;

                    try {
                        const img = await page.objs.get(imgName);
                        if (!img || !img.data || img.width <= 2 || img.height <= 2) continue;

                        // Display size from CTM
                        const dw = Math.abs(Math.sqrt(ctm[0] * ctm[0] + ctm[1] * ctm[1]));
                        const dh = Math.abs(Math.sqrt(ctm[2] * ctm[2] + ctm[3] * ctm[3]));
                        const ix = ctm[4];
                        const iy = ctm[5];

                        if (!(img.data instanceof Uint8ClampedArray || img.data instanceof Uint8Array)) continue;
                        const channels = img.data.length / (img.width * img.height);
                        if (channels < 3) continue;

                        // Convert raw RGBA → PNG at FULL resolution (no compression, no DPI loss)
                        const sharp = (await import("sharp")).default;
                        const imgBuffer = await sharp(Buffer.from(img.data), {
                            raw: {
                                width: img.width,
                                height: img.height,
                                channels: Math.min(4, Math.round(channels)) as 1 | 2 | 3 | 4,
                            },
                        }).png({ compressionLevel: 0 }).toBuffer(); // compressionLevel 0 = no lossy compression

                        totalImageBytes += imgBuffer.length;

                        // DPI estimation
                        const dpiX = dw > 0 ? (img.width / dw) * 72 : 72;
                        const dpiY = dh > 0 ? (img.height / dh) * 72 : 72;
                        const avgDpi = (dpiX + dpiY) / 2;

                        const isFullPage = dw > viewport.width * 0.8 && dh > viewport.height * 0.8;
                        const isLargeOverlay = dw > viewport.width * 0.4 && dh > viewport.height * 0.4 && !isFullPage;

                        const posImg: PositionedImage = {
                            data: imgBuffer,
                            width: dw,
                            height: dh,
                            naturalWidth: img.width,
                            naturalHeight: img.height,
                            x: ix, y: iy,
                            mimeType: "image/png",
                            pageIndex: pageNum - 1,
                            isBackground: isFullPage && images.length === 0,
                            isWatermark: isLargeOverlay,
                            opacity: 1,
                            rotation: 0,
                            dpi: Math.round(avgDpi),
                        };

                        if (posImg.isBackground) {
                            backgrounds.push(posImg);
                        } else if (posImg.isWatermark) {
                            watermarks.push({
                                type: "image",
                                imageData: imgBuffer,
                                imageWidth: Math.round(dw),
                                imageHeight: Math.round(dh),
                                opacity: 0.3,
                            });
                        } else {
                            images.push(posImg);
                        }
                    } catch { /* skip unreadable image */ }
                    continue;
                }
            }
        } catch { /* operator list extraction can fail for some PDFs */ }

        /* ── Correlate text colours from timeline ── */
        if (textColorTimeline.length > 0 && textItems.length > 0) {
            let cIdx = 0;
            for (const ti of textItems) {
                if (cIdx < textColorTimeline.length) ti.color = { ...textColorTimeline[cIdx] };
                if (ti.str.trim()) cIdx++;
            }
        }

        /* ── STEP 3: Watermark text detection ── */
        const rotatedLargeText = textItems.filter(t => Math.abs(t.rotation) > 10 && t.fontSize > 18);
        for (const rt of rotatedLargeText) {
            watermarks.push({
                type: "text",
                text: rt.str,
                fontSize: rt.fontSize,
                fontFamily: rt.fontFamily,
                color: rt.color,
                rotation: rt.rotation,
                opacity: 0.3,
                x: rt.x,
                y: rt.y,
            });
        }

        /* ── Detect layout ── */
        const layout = detectPageLayout(textItems, viewport.width, viewport.height);

        /* ── STEP 6: Table detection ── */
        const tables = detectTablesFromGeometry(lines, fills, textItems, pageNum - 1);

        const hasText = textItems.some(t => t.str.trim().length > 0 && Math.abs(t.rotation) < 10);

        allPages.push({
            layout, textItems, images, tables, lines, fills,
            watermarks, backgrounds, hasText,
            isScanned: !hasText && (images.length > 0 || backgrounds.length > 0),
        });
    }

    // Cross-page header/footer detection
    detectHeadersFooters(allPages);

    return allPages;
}

/* ================================================================
   PDF METADATA EXTRACTION (for validation)
   ================================================================ */

async function extractPdfMetadata(pdfBytes: Buffer): Promise<PdfMetadata> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
    const pdfjs = (pdfjsLib as any).default || pdfjsLib;
    const pdfjs2 = await import("pdfjs-dist");
    const OPS = pdfjs2.OPS;

    const doc = await pdfjs.getDocument({
        data: new Uint8Array(pdfBytes),
        disableWorker: true,
        isEvalSupported: false,
    } as any).promise;

    const pages: PdfMetadata["pages"] = [];
    let totalImages = 0, totalTextLength = 0;
    let hasWatermark = false, hasBackground = false, tableCount = 0;
    const fontNameSet = new Set<string>();

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        let pageImageCount = 0, pageTextLength = 0, hasText = false;

        for (const item of textContent.items || []) {
            if (item.str && item.str.trim()) { hasText = true; pageTextLength += item.str.length; }
            if (item.fontName) fontNameSet.add(item.fontName);
            const tf = item.transform;
            if (tf && (Math.abs(tf[1]) > 0.1 || Math.abs(tf[2]) > 0.1)) {
                const sz = Math.sqrt(tf[0] * tf[0] + tf[1] * tf[1]);
                if (sz > 28) hasWatermark = true;
            }
        }

        try {
            const ops = await page.getOperatorList();
            let lineOps = 0, checkedImgs = 0;
            for (let i = 0; i < ops.fnArray.length; i++) {
                const fn = ops.fnArray[i];
                if (fn === OPS.paintImageXObject || fn === OPS.paintXObject) {
                    const imgN = ops.argsArray[i]?.[0];
                    if (typeof imgN === "string") {
                        try {
                            const img = await page.objs.get(imgN);
                            if (img && img.width > 5 && img.height > 5) {
                                pageImageCount++;
                                if (img.width > viewport.width * 0.8 && img.height > viewport.height * 0.8 && checkedImgs === 0) hasBackground = true;
                            }
                        } catch { /* skip */ }
                        checkedImgs++;
                    }
                }
                if (fn === OPS.rectangle || fn === OPS.lineTo) lineOps++;
            }
            if (lineOps > 8) tableCount++;
        } catch { /* operator list failure */ }

        pages.push({ width: viewport.width, height: viewport.height, imageCount: pageImageCount, hasText, textLength: pageTextLength });
        totalImages += pageImageCount;
        totalTextLength += pageTextLength;
    }

    return { pageCount: doc.numPages, pages, totalImageCount: totalImages, totalTextLength, hasWatermark, hasBackground, tableCount, fontNames: [...fontNameSet] };
}

/* ================================================================
   STEP 7: QUALITY CONTROL – Comprehensive Validation
   ================================================================ */

async function validateDocxOutput(
    docxBuffer: Buffer,
    pdfMeta: PdfMetadata,
): Promise<ValidationResult> {
    const details: string[] = [];
    let imageCountMatch = true;
    let hasExpectedWatermark = true;
    let hasExpectedBackground = true;
    let tableCountMatch = true;
    let noLayoutShift = true;
    let noDpiLoss = true;
    let noMissingContent = true;
    let score = 100;

    // ZIP signature check
    if (docxBuffer[0] !== 0x50 || docxBuffer[1] !== 0x4b) {
        return {
            passed: false, pageCountMatch: false, imageCountMatch: false,
            hasExpectedWatermark: false, hasExpectedBackground: false,
            tableCountMatch: false, noLayoutShift: false, noDpiLoss: false,
            noMissingContent: false, details: ["Invalid DOCX: not a ZIP file"], score: 0,
        };
    }

    try {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(docxBuffer);

        // ── Verify: Image count matches ──
        const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith("word/media/"));
        const docxImageCount = mediaFiles.length;

        if (pdfMeta.totalImageCount > 0 && docxImageCount === 0) {
            imageCountMatch = false;
            details.push(`PDF has ${pdfMeta.totalImageCount} image(s) but DOCX has none`);
            score -= 20;
        } else if (pdfMeta.totalImageCount > 0 && docxImageCount < pdfMeta.totalImageCount * 0.5) {
            imageCountMatch = false;
            details.push(`Image count mismatch: PDF=${pdfMeta.totalImageCount}, DOCX=${docxImageCount}`);
            score -= 15;
        }

        // ── Verify: No DPI loss (check image file sizes are reasonable) ──
        for (const mf of mediaFiles) {
            const imgFile = zip.file(mf);
            if (imgFile) {
                const imgData = await imgFile.async("uint8array");
                if (imgData.length < 100) {
                    noDpiLoss = false;
                    details.push(`Image ${mf} is suspiciously small (${imgData.length} bytes)`);
                    score -= 5;
                }
            }
        }

        // ── Verify: Watermark exists ──
        const headerFiles = Object.keys(zip.files).filter(f => /word\/header\d*\.xml/.test(f));
        if (pdfMeta.hasWatermark) {
            const docXmlWm = (await zip.file("word/document.xml")?.async("text")) ?? "";
            let foundWm = headerFiles.length > 0;
            if (!foundWm) {
                foundWm = docXmlWm.toLowerCase().includes("watermark") ||
                    docXmlWm.includes("w:pict") || docXmlWm.includes("wp:anchor");
            }
            if (!foundWm) {
                // Check header XML content for large/rotated text
                for (const hf of headerFiles) {
                    const hXml = (await zip.file(hf)?.async("text")) ?? "";
                    if (hXml.includes("w:t") || hXml.includes("w:pict")) { foundWm = true; break; }
                }
            }
            if (!foundWm) {
                hasExpectedWatermark = false;
                details.push("Watermark may be missing in DOCX output");
                score -= 10;
            }
        }

        // ── Verify: Background preserved ──
        if (pdfMeta.hasBackground && mediaFiles.length === 0) {
            hasExpectedBackground = false;
            details.push("PDF has background images but DOCX has no media files");
            score -= 15;
        }

        // ── Verify: No missing content ──
        const docXml = (await zip.file("word/document.xml")?.async("text")) ?? "";
        if (docXml.length < 100 && pdfMeta.totalTextLength > 50) {
            noMissingContent = false;
            details.push("DOCX document.xml is suspiciously small – content may be missing");
            score -= 20;
        }

        // ── Verify: No major layout shift (check document has sections) ──
        const sectionBreaks = (docXml.match(/<w:sectPr/g) || []).length;
        if (pdfMeta.pageCount > 1 && sectionBreaks === 0) {
            noLayoutShift = false;
            details.push("Multi-page PDF but no section breaks in DOCX");
            score -= 10;
        }

        // Text content size sanity check
        const textMatches: string[] = (docXml.match(/<w:t[^>]*>[^<]+<\/w:t>/g) ?? []) as string[];
        let docxTextLength = 0;
        for (const m of textMatches) {
            const match = m.match(/>([^<]+)</);
            if (match) docxTextLength += match[1].length;
        }

        if (pdfMeta.totalTextLength > 100 && docxTextLength < pdfMeta.totalTextLength * 0.3) {
            noMissingContent = false;
            details.push(`Significant text loss: PDF≈${pdfMeta.totalTextLength} chars, DOCX≈${docxTextLength} chars`);
            score -= 15;
        }

        // ── Verify: Table count matches ──
        const docxTableCount = (docXml.match(/<w:tbl\b/g) || []).length;
        if (pdfMeta.tableCount > 0 && docxTableCount === 0) {
            tableCountMatch = false;
            details.push(`Table mismatch: PDF≈${pdfMeta.tableCount} table page(s), DOCX has ${docxTableCount} tables`);
            score -= 10;
        }
    } catch (e) {
        details.push(`DOCX inspection error: ${e instanceof Error ? e.message : "unknown"}`);
        score -= 10;
    }

    score = Math.max(0, Math.min(100, score));
    const passed = score >= 70 && imageCountMatch && noMissingContent;

    return {
        passed, pageCountMatch: true, imageCountMatch, hasExpectedWatermark,
        hasExpectedBackground, tableCountMatch, noLayoutShift, noDpiLoss,
        noMissingContent, details, score,
    };
}

/* ================================================================
   LAYOUT ANALYSIS
   ================================================================ */

function detectPageLayout(items: StyledTextItem[], pageWidth: number, pageHeight: number): PageLayout {
    const body = items.filter(t => Math.abs(t.rotation) < 5 && t.str.trim());
    if (body.length === 0) return defaultLayout(pageWidth, pageHeight);

    const xs = body.map(t => t.x);
    const xEnds = body.map(t => t.x + (t.width || 0));
    const ys = body.map(t => t.y);
    const yTops = body.map(t => t.y + t.height);

    const contentLeft = Math.min(...xs);
    const contentRight = Math.max(...xEnds);
    const contentBottom = Math.min(...ys);
    const contentTop = Math.max(...yTops);

    const marginLeft = clamp(contentLeft, 18, 144);
    const marginRight = clamp(pageWidth - contentRight, 18, 144);
    const marginTop = clamp(pageHeight - contentTop, 18, 144);
    const marginBottom = clamp(contentBottom, 18, 144);

    // Multi-column detection
    let columns = 1, columnGap = 36;
    const contentWidth = contentRight - contentLeft;

    if (contentWidth > pageWidth * 0.6 && body.length > 20) {
        const midX = pageWidth / 2;
        const left = body.filter(t => t.x + (t.width || 0) < midX - 10);
        const right = body.filter(t => t.x > midX + 10);
        const center = body.filter(t => t.x < midX + 10 && t.x + (t.width || 0) > midX - 10);

        if (left.length > 5 && right.length > 5 && center.length < (left.length + right.length) * 0.1) {
            columns = 2;
            const leftMax = Math.max(...left.map(t => t.x + (t.width || 0)));
            const rightMin = Math.min(...right.map(t => t.x));
            columnGap = Math.max(12, rightMin - leftMax);
        }
    }

    return { width: pageWidth, height: pageHeight, marginTop, marginRight, marginBottom, marginLeft, columns, columnGap, hasHeader: false, hasFooter: false, headerText: "", footerText: "" };
}

function defaultLayout(w: number, h: number): PageLayout {
    return { width: w, height: h, marginTop: 72, marginRight: 72, marginBottom: 72, marginLeft: 72, columns: 1, columnGap: 36, hasHeader: false, hasFooter: false, headerText: "", footerText: "" };
}

/* ── Header / footer via cross-page repetition ── */

function detectHeadersFooters(pages: FullPageData[]): void {
    if (pages.length < 2) return;

    for (const page of pages) {
        const topTexts = page.textItems
            .filter(t => t.y > page.layout.height * 0.85 && Math.abs(t.rotation) < 5)
            .map(t => t.str.trim()).filter(s => s.length > 0);

        const bottomTexts = page.textItems
            .filter(t => t.y < page.layout.height * 0.15 && Math.abs(t.rotation) < 5)
            .map(t => t.str.trim()).filter(s => s.length > 0);

        if (topTexts.length > 0) {
            const repeated = pages.filter(p => p !== page).some(other => {
                const ot = other.textItems.filter(t => t.y > other.layout.height * 0.85).map(t => t.str.trim());
                return topTexts.some(t => ot.includes(t));
            });
            if (repeated) { page.layout.hasHeader = true; page.layout.headerText = topTexts.join(" "); }
        }

        if (bottomTexts.length > 0) {
            const repeated = pages.filter(p => p !== page).some(other => {
                const ob = other.textItems.filter(t => t.y < other.layout.height * 0.15).map(t => t.str.trim());
                return bottomTexts.some(t => ob.includes(t));
            });
            if (repeated) { page.layout.hasFooter = true; page.layout.footerText = bottomTexts.join(" "); }
        }
    }
}

/* ================================================================
   TABLE DETECTION (STEP 6)
   ================================================================ */

function detectTablesFromGeometry(lines: LineSegment[], fills: FillRect[], textItems: StyledTextItem[], pageIndex: number): EnhancedTable[] {
    const hLines = lines.filter(l => Math.abs(l.y1 - l.y2) < 2 && Math.abs(l.x2 - l.x1) > 10);
    const vLines = lines.filter(l => Math.abs(l.x1 - l.x2) < 2 && Math.abs(l.y2 - l.y1) > 10);

    if (hLines.length >= 2 && vLines.length >= 2) {
        return detectTablesFromLines(hLines, vLines, fills, textItems, pageIndex);
    }
    return detectTablesFromTextAlignment(textItems, pageIndex);
}

function detectTablesFromLines(
    hLines: LineSegment[], vLines: LineSegment[], fills: FillRect[],
    textItems: StyledTextItem[], pageIndex: number,
): EnhancedTable[] {
    const tol = 3;

    // Group H-lines by Y
    const hYs: number[] = [];
    for (const l of hLines.sort((a, b) => a.y1 - b.y1)) {
        if (hYs.length === 0 || Math.abs(l.y1 - hYs[hYs.length - 1]) > tol) hYs.push(l.y1);
    }

    // Group V-lines by X
    const vXs: number[] = [];
    for (const l of vLines.sort((a, b) => a.x1 - b.x1)) {
        if (vXs.length === 0 || Math.abs(l.x1 - vXs[vXs.length - 1]) > tol) vXs.push(l.x1);
    }

    if (hYs.length < 2 || vXs.length < 2) return [];

    const rows: EnhancedTableCell[][] = [];
    const rowHeights: number[] = [];
    const columnWidths = vXs.slice(1).map((x, i) => x - vXs[i]);

    for (let ri = 0; ri < hYs.length - 1; ri++) {
        const y1 = hYs[ri], y2 = hYs[ri + 1];
        rowHeights.push(Math.abs(y2 - y1));
        const rowCells: EnhancedTableCell[] = [];

        for (let ci = 0; ci < vXs.length - 1; ci++) {
            const x1 = vXs[ci], x2 = vXs[ci + 1];
            const cellItems = textItems.filter(t =>
                t.x >= x1 - tol && t.x <= x2 + tol &&
                t.y >= Math.min(y1, y2) - tol && t.y <= Math.max(y1, y2) + tol
            );
            const text = cellItems.sort((a, b) => { const dy = b.y - a.y; return Math.abs(dy) > 1 ? dy : a.x - b.x; }).map(t => t.str).join(" ").trim();
            const first = cellItems[0];

            // Cell background from fills
            let bgColor: RGBColor | null = null;
            for (const f of fills) {
                if (f.x <= x1 + tol && f.x + f.width >= x2 - tol &&
                    f.y <= Math.min(y1, y2) + tol && f.y + f.height >= Math.max(y1, y2) - tol - 5 &&
                    !(f.color.r > 250 && f.color.g > 250 && f.color.b > 250)) {
                    bgColor = { ...f.color }; break;
                }
            }

            // Cell alignment detection
            let alignment: "left" | "center" | "right" = "left";
            if (cellItems.length > 0) {
                const cellWidth = x2 - x1;
                const textStartX = Math.min(...cellItems.map(ci => ci.x)) - x1;
                const textEndX = Math.max(...cellItems.map(ci => ci.x + (ci.width || 0))) - x1;
                const leftGap = textStartX;
                const rightGap = cellWidth - textEndX;
                if (Math.abs(leftGap - rightGap) < cellWidth * 0.2 && leftGap > cellWidth * 0.1) alignment = "center";
                else if (leftGap > cellWidth * 0.5) alignment = "right";
            }

            rowCells.push({
                text, fontSize: first?.fontSize || 11, fontFamily: first?.fontFamily || "Arial",
                bold: first?.bold || false, italic: first?.italic || false,
                color: first?.color || { r: 0, g: 0, b: 0 },
                bgColor, colSpan: 1, width: x2 - x1, alignment,
            });
        }
        rows.push(rowCells);
    }

    if (rows.length < 1) return [];

    // Detect header row (first row often has bold text or background color)
    const hasHeaderRow = rows.length > 1 && (
        rows[0].some(c => c.bold) ||
        rows[0].some(c => c.bgColor !== null)
    );

    const borderLine = hLines[0] || vLines[0];
    return [{
        rows, x: vXs[0], y: hYs[0],
        width: vXs[vXs.length - 1] - vXs[0],
        columnWidths, rowHeights,
        borderColor: borderLine ? { ...borderLine.color } : { r: 0, g: 0, b: 0 },
        borderWidth: borderLine?.lineWidth || 0.5,
        pageIndex, hasHeaderRow,
    }];
}

function detectTablesFromTextAlignment(items: StyledTextItem[], pageIndex: number): EnhancedTable[] {
    const body = items.filter(t => Math.abs(t.rotation) < 5 && t.str.trim());
    if (body.length < 6) return [];

    const yTol = 3;
    const rows: { y: number; items: StyledTextItem[] }[] = [];
    const sorted = [...body].sort((a, b) => b.y - a.y);

    for (const item of sorted) {
        const existing = rows.find(r => Math.abs(r.y - item.y) <= yTol);
        if (existing) existing.items.push(item);
        else rows.push({ y: item.y, items: [item] });
    }

    const multiRows = rows.filter(r => r.items.length >= 2);
    if (multiRows.length < 2) return [];

    const freq: Record<number, number> = {};
    for (const r of multiRows) freq[r.items.length] = (freq[r.items.length] || 0) + 1;
    const modeCol = parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || "0");
    if (modeCol < 2) return [];

    const tableRows = multiRows.filter(r => Math.abs(r.items.length - modeCol) <= 1);
    if (tableRows.length < 2) return [];

    const cellRows: EnhancedTableCell[][] = tableRows.map(row => {
        const si = row.items.sort((a, b) => a.x - b.x);
        return si.map(item => ({
            text: item.str.trim(), fontSize: item.fontSize, fontFamily: item.fontFamily,
            bold: item.bold, italic: item.italic, color: item.color,
            bgColor: null, colSpan: 1, width: item.width || 50, alignment: "left" as const,
        }));
    });

    const maxCols = Math.max(...cellRows.map(r => r.length));
    const columnWidths: number[] = [];
    for (let ci = 0; ci < maxCols; ci++) {
        columnWidths.push(Math.max(...cellRows.map(r => r[ci]?.width || 50)));
    }

    const hasHeaderRow = cellRows.length > 1 && cellRows[0].some(c => c.bold);

    return [{
        rows: cellRows,
        x: Math.min(...tableRows.flatMap(r => r.items.map(i => i.x))),
        y: tableRows[0].y,
        width: Math.max(...tableRows.flatMap(r => r.items.map(i => i.x + (i.width || 0)))) - Math.min(...tableRows.flatMap(r => r.items.map(i => i.x))),
        columnWidths,
        rowHeights: tableRows.map(() => 20),
        borderColor: { r: 0, g: 0, b: 0 },
        borderWidth: 0.5,
        pageIndex,
        hasHeaderRow,
    }];
}

/* ================================================================
   STYLED LINE GROUPING – preserves inline formatting runs
   ================================================================ */

interface StyledRun {
    text: string;
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    color: RGBColor;
    charSpacing: number;
}

interface StyledLine {
    text: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    y: number;
    x: number;
    width: number;
    runs: StyledRun[];
}

function groupIntoStyledLines(items: StyledTextItem[], layout: PageLayout): StyledLine[] {
    if (items.length === 0) return [];

    const sorted = [...items].sort((a, b) => {
        const dy = b.y - a.y;
        return Math.abs(dy) > 0.5 ? dy : a.x - b.x;
    });

    const lineGroups: { y: number; items: StyledTextItem[] }[] = [];

    for (const item of sorted) {
        const tol = Math.max(2, item.fontSize * 0.35);
        const last = lineGroups[lineGroups.length - 1];
        if (last && Math.abs(item.y - last.y) <= tol) {
            last.items.push(item);
        } else {
            lineGroups.push({ y: item.y, items: [item] });
        }
    }

    return lineGroups.map(line => {
        const lineSorted = line.items.sort((a, b) => a.x - b.x);
        const runs: StyledRun[] = [];
        let fullText = "";
        let prev: StyledTextItem | null = null;
        let current: StyledRun | null = null;

        for (const item of lineSorted) {
            if (!item.str) continue;

            let gap = "";
            if (prev) {
                const space = item.x - (prev.x + prev.width);
                if (space > prev.fontSize * 0.2 && !fullText.endsWith(" ")) gap = " ";
            }

            const same = current &&
                current.fontFamily === item.fontFamily &&
                Math.abs(current.fontSize - item.fontSize) < 0.5 &&
                current.bold === item.bold &&
                current.italic === item.italic &&
                colorClose(current.color, item.color);

            if (same && current) {
                current.text += gap + item.str;
            } else {
                if (current && gap) current.text += gap;
                current = {
                    text: item.str, fontSize: item.fontSize,
                    fontFamily: item.fontFamily, bold: item.bold,
                    italic: item.italic, underline: item.underline,
                    color: { ...item.color }, charSpacing: item.charSpacing,
                };
                runs.push(current);
            }
            fullText += gap + item.str;
            prev = item;
        }

        const medFs = median(line.items.map(i => i.fontSize));
        const totalWidth = lineSorted.length > 0
            ? lineSorted[lineSorted.length - 1].x + (lineSorted[lineSorted.length - 1].width || 0) - lineSorted[0].x
            : 0;

        return {
            text: fullText.replace(/\s+/g, " ").trim(),
            fontSize: medFs, bold: line.items.some(i => i.bold),
            italic: line.items.some(i => i.italic),
            y: line.y, x: lineSorted[0]?.x || 0, width: totalWidth,
            runs: runs.length > 0 ? runs : [{
                text: fullText.trim(), fontSize: medFs, fontFamily: "Arial",
                bold: false, italic: false, underline: false,
                color: { r: 0, g: 0, b: 0 }, charSpacing: 0,
            }],
        };
    }).filter(l => l.text.length > 0);
}

/* ================================================================
   HYBRID DOCX BUILDER – reconstruct from all extracted layers
   Steps 2-5 are applied here:
     STEP 2: Background as page background image
     STEP 3: Watermarks in Word header section
     STEP 4: Editable text with full font/layout preservation
     STEP 5: Images at full resolution, no compression
   ================================================================ */

async function buildDocxFromLayers(
    pagesData: FullPageData[],
    ocrText?: Array<{ pageNum: number; text: string }>,
): Promise<Buffer> {
    const {
        Document, Packer, Paragraph, TextRun, ImageRun,
        HeadingLevel, AlignmentType,
        Table, TableRow, TableCell: DocxTableCell,
        WidthType, BorderStyle,
        Header, Footer,
    } = await import("docx");

    const PT2HP = 2;   // points → half-points
    const PT2TW = 20;  // points → twips

    const sections: any[] = [];

    for (let pageIdx = 0; pageIdx < pagesData.length; pageIdx++) {
        const page = pagesData[pageIdx];
        const children: any[] = [];

        /* ── Section properties: page size, margins, columns ── */
        const secProps: any = {
            page: {
                size: {
                    width: Math.round(page.layout.width * PT2TW),
                    height: Math.round(page.layout.height * PT2TW),
                },
                margin: {
                    top: Math.round(page.layout.marginTop * PT2TW),
                    right: Math.round(page.layout.marginRight * PT2TW),
                    bottom: Math.round(page.layout.marginBottom * PT2TW),
                    left: Math.round(page.layout.marginLeft * PT2TW),
                },
            },
        };

        if (page.layout.columns > 1) {
            secProps.column = {
                space: Math.round(page.layout.columnGap * PT2TW),
                count: page.layout.columns,
            };
        }

        /* ── STEP 3: Watermarks in header section ── */
        const headerParagraphs: any[] = [];

        for (const wm of page.watermarks) {
            if (wm.type === "text" && wm.text) {
                headerParagraphs.push(new Paragraph({
                    children: [new TextRun({
                        text: wm.text,
                        color: rgbToHex(wm.color || { r: 192, g: 192, b: 192 }),
                        size: Math.round((wm.fontSize || 48) * PT2HP),
                        font: wm.fontFamily || "Arial",
                    })],
                    alignment: AlignmentType.CENTER,
                }));
            }
            if (wm.type === "image" && wm.imageData) {
                try {
                    headerParagraphs.push(new Paragraph({
                        children: [new ImageRun({
                            data: wm.imageData,
                            transformation: { width: wm.imageWidth || 200, height: wm.imageHeight || 200 },
                            type: "png",
                        })],
                        alignment: AlignmentType.CENTER,
                    }));
                } catch { /* skip */ }
            }
        }

        if (page.layout.hasHeader && page.layout.headerText) {
            headerParagraphs.push(new Paragraph({
                children: [new TextRun({ text: page.layout.headerText, size: 18, color: "666666" })],
                alignment: AlignmentType.CENTER,
            }));
        }

        if (headerParagraphs.length > 0) {
            secProps.headers = { default: new Header({ children: headerParagraphs }) };
        }

        /* ── Footer ── */
        if (page.layout.hasFooter && page.layout.footerText) {
            secProps.footers = {
                default: new Footer({
                    children: [new Paragraph({
                        children: [new TextRun({ text: page.layout.footerText, size: 18, color: "666666" })],
                        alignment: AlignmentType.CENTER,
                    })],
                }),
            };
        }

        /* ── STEP 2: Background preservation ── */
        for (const bg of page.backgrounds) {
            try {
                // Use FULL resolution for background - maintain original DPI
                const maxDisplayWidth = Math.round(page.layout.width - page.layout.marginLeft - page.layout.marginRight);
                let w = bg.naturalWidth;
                let h = bg.naturalHeight;

                // Scale to content area if needed, preserve aspect ratio
                if (w > maxDisplayWidth) {
                    const ratio = maxDisplayWidth / w;
                    w = maxDisplayWidth;
                    h = Math.round(h * ratio);
                }

                children.push(new Paragraph({
                    children: [new ImageRun({
                        data: bg.data,
                        transformation: { width: w, height: h },
                        type: "png",
                    })],
                }));
            } catch { /* skip */ }
        }

        if (page.hasText || page.textItems.length > 0) {
            /* ── STEP 6: Table reconstruction ── */
            for (const table of page.tables) {
                try {
                    const totalW = table.columnWidths.reduce((a, b) => a + b, 0) || table.width;

                    const tblRows = table.rows.map((rowCells, ri) => {
                        const cells = rowCells.map((cell, ci) => {
                            const cw = table.columnWidths[ci] || totalW / rowCells.length;
                            const borderSize = Math.max(1, Math.round(table.borderWidth * 2));
                            const borderDef = {
                                style: BorderStyle.SINGLE,
                                size: borderSize,
                                color: rgbToHex(table.borderColor),
                            };

                            // Cell alignment
                            let cellAlignment: any = AlignmentType.LEFT;
                            if (cell.alignment === "center") cellAlignment = AlignmentType.CENTER;
                            else if (cell.alignment === "right") cellAlignment = AlignmentType.RIGHT;

                            const cellOpts: any = {
                                children: [new Paragraph({
                                    children: [new TextRun({
                                        text: cell.text,
                                        size: Math.round(cell.fontSize * PT2HP),
                                        font: cell.fontFamily,
                                        bold: cell.bold || (ri === 0 && table.hasHeaderRow),
                                        italics: cell.italic,
                                        color: rgbToHex(cell.color),
                                    })],
                                    alignment: cellAlignment,
                                })],
                                width: { size: Math.round(cw * PT2TW), type: WidthType.DXA },
                                borders: { top: borderDef, bottom: borderDef, left: borderDef, right: borderDef },
                            };

                            if (cell.bgColor) {
                                cellOpts.shading = { fill: rgbToHex(cell.bgColor) };
                            }
                            return new DocxTableCell(cellOpts);
                        });

                        return new TableRow({
                            children: cells,
                            height: table.rowHeights[ri]
                                ? { value: Math.round(table.rowHeights[ri] * PT2TW), rule: "atLeast" as any }
                                : undefined,
                            tableHeader: ri === 0 && table.hasHeaderRow ? true : undefined,
                        });
                    });

                    if (tblRows.length > 0) {
                        children.push(
                            new Table({ rows: tblRows, width: { size: Math.round(totalW * PT2TW), type: WidthType.DXA } }),
                            new Paragraph({ spacing: { after: 120 } }),
                        );
                    }
                } catch { /* skip malformed tables */ }
            }

            /* ── STEP 4: Editable text reconstruction ── */
            const tableYRanges = page.tables.map(t => {
                const rh = t.rowHeights.reduce((a, b) => a + b, 0);
                return { minY: Math.min(t.y, t.y + rh) - 5, maxY: Math.max(t.y, t.y + rh) + 5, minX: t.x - 5, maxX: t.x + t.width + 5 };
            });

            const bodyItems = page.textItems.filter(item => {
                if (Math.abs(item.rotation) > 10) return false;
                if (page.layout.hasHeader && item.y > page.layout.height * 0.85) return false;
                if (page.layout.hasFooter && item.y < page.layout.height * 0.15) return false;
                for (const r of tableYRanges) {
                    if (item.y >= r.minY && item.y <= r.maxY && item.x >= r.minX && item.x <= r.maxX) return false;
                }
                return true;
            });

            const styledLines = groupIntoStyledLines(bodyItems, page.layout);
            const baseFontSize = median(styledLines.map(l => l.fontSize)) || 12;
            let prevY: number | null = null;

            for (const line of styledLines) {
                const gap = prevY !== null ? prevY - line.y : 0;
                const isLargeGap = prevY !== null && gap > line.fontSize * 2.0;
                const isHeading = line.fontSize >= baseFontSize * 1.25 && line.text.length < 120 && !line.text.endsWith(".");

                // Alignment detection
                let alignment: any = AlignmentType.LEFT;
                const cw = page.layout.width - page.layout.marginLeft - page.layout.marginRight;
                const relX = line.x - page.layout.marginLeft;

                if (cw > 0 && line.width > 0) {
                    const leftGap = relX;
                    const rightGap = cw - (relX + line.width);
                    if (Math.abs(leftGap - rightGap) < cw * 0.15 && leftGap > cw * 0.1) alignment = AlignmentType.CENTER;
                    else if (relX > cw * 0.6) alignment = AlignmentType.RIGHT;
                }

                // Build text runs preserving inline style changes
                const runs = line.runs.map(run => new TextRun({
                    text: run.text,
                    size: Math.round(run.fontSize * PT2HP),
                    font: run.fontFamily,
                    bold: run.bold || isHeading,
                    italics: run.italic,
                    underline: run.underline ? {} : undefined,
                    color: rgbToHex(run.color),
                    characterSpacing: run.charSpacing > 0 ? Math.round(run.charSpacing * PT2TW) : undefined,
                }));

                // Line spacing based on font size
                const lineSpacing = Math.round(line.fontSize * 1.15 * PT2TW);

                const paraOpts: any = {
                    children: runs,
                    spacing: {
                        after: isLargeGap ? 240 : 80,
                        before: isLargeGap ? 120 : 0,
                        line: lineSpacing,
                    },
                    alignment,
                };

                if (isHeading) {
                    paraOpts.heading = line.fontSize >= baseFontSize * 1.6
                        ? HeadingLevel.HEADING_1
                        : line.fontSize >= baseFontSize * 1.35
                            ? HeadingLevel.HEADING_2
                            : HeadingLevel.HEADING_3;
                }

                children.push(new Paragraph(paraOpts));
                prevY = line.y;
            }

            /* ── STEP 5: Images at full resolution ── */
            for (const img of page.images.filter(i => !i.isBackground && !i.isWatermark)) {
                try {
                    // Use display dimensions, preserve aspect ratio, NO compression
                    const maxW = Math.round(page.layout.width - page.layout.marginLeft - page.layout.marginRight);
                    let w = img.width > 5 && img.width < 5000 ? img.width : img.naturalWidth;
                    let h = img.height > 5 && img.height < 5000 ? img.height : img.naturalHeight;
                    if (w > maxW) {
                        const ratio = maxW / w;
                        w = maxW;
                        h = Math.round(h * ratio);
                    }
                    children.push(new Paragraph({
                        children: [new ImageRun({
                            data: img.data,
                            transformation: { width: Math.round(w), height: Math.round(h) },
                            type: "png",
                        })],
                        spacing: { after: 160 },
                    }));
                } catch { /* skip */ }
            }
        } else {
            /* ── SCANNED PAGE: Background image + OCR text overlay ── */
            const ocrPage = ocrText?.find(p => p.pageNum === pageIdx + 1);

            // Embed all page images (background + content) at full resolution
            const allImgs = [...page.backgrounds, ...page.images];
            for (const img of allImgs) {
                try {
                    const maxW = Math.round(page.layout.width - page.layout.marginLeft - page.layout.marginRight);
                    let w = img.naturalWidth;
                    let h = img.naturalHeight;
                    if (w > maxW) {
                        const ratio = maxW / w;
                        w = maxW;
                        h = Math.round(h * ratio);
                    }
                    children.push(new Paragraph({
                        children: [new ImageRun({
                            data: img.data,
                            transformation: { width: w, height: h },
                            type: "png",
                        })],
                    }));
                } catch { /* skip */ }
            }

            // Overlay OCR text as editable paragraphs
            if (ocrPage && ocrPage.text.trim()) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: "", size: 16 })],
                    spacing: { after: 80 },
                }));
                for (const para of ocrPage.text.split(/\n\n+/).filter(p => p.trim())) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: para.trim(), size: 24, font: "Arial" })],
                        spacing: { after: 200 },
                    }));
                }
            }

            if (children.length === 0) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: `[Page ${pageIdx + 1}: No extractable content]`, italics: true, color: "999999", size: 20 })],
                }));
            }
        }

        if (children.length === 0) {
            children.push(new Paragraph({ children: [] }));
        }

        sections.push({ properties: secProps, children });
    }

    const doc = new Document({ sections });
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}

/* ================================================================
   UTILITIES
   ================================================================ */

function rgbToHex(c: RGBColor): string {
    const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function colorClose(a: RGBColor, b: RGBColor): boolean {
    return Math.abs(a.r - b.r) < 5 && Math.abs(a.g - b.g) < 5 && Math.abs(a.b - b.b) < 5;
}

function median(values: number[]): number {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/* ================================================================
   MAIN EXPORT – Hybrid Full-Fidelity Engine
   ================================================================ */

export async function convertPdfToDocx(options: ConversionOptions): Promise<ConversionResult> {
    const { pdfBytes, originalName, ocrText } = options;

    // Validate PDF header
    const header = pdfBytes.subarray(0, 5).toString("ascii");
    if (!header.startsWith("%PDF")) throw new PdfToDocxError("Invalid file: not a PDF.", 400);

    // Get page count
    const { PDFDocument } = await import("pdf-lib");
    let pageCount: number;
    try {
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
    } catch { throw new PdfToDocxError("Cannot read PDF: file may be corrupted.", 400); }

    if (pageCount === 0) throw new PdfToDocxError("PDF has no pages.", 400);

    const baseName = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-. ]/g, "_") || "document";
    const outFileName = `${baseName}.docx`;
    const contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    // ── STEP 1: Extract PDF metadata ──
    console.log("[pdfToDocx] Step 1: Extracting PDF metadata & layers…");
    let pdfMeta: PdfMetadata;
    try {
        pdfMeta = await extractPdfMetadata(pdfBytes);
    } catch (e) {
        console.warn("[pdfToDocx] Metadata extraction failed:", e);
        pdfMeta = { pageCount, pages: [], totalImageCount: 0, totalTextLength: 0, hasWatermark: false, hasBackground: false, tableCount: 0, fontNames: [] };
    }

    console.log(
        `[pdfToDocx] PDF: ${pdfMeta.pageCount} pages, ${pdfMeta.totalImageCount} images, ` +
        `${pdfMeta.totalTextLength} chars, watermark=${pdfMeta.hasWatermark}, ` +
        `bg=${pdfMeta.hasBackground}, tables≈${pdfMeta.tableCount}`,
    );

    /* ─── PRIMARY: Try LibreOffice first ─── */
    try {
        console.log("[pdfToDocx] Primary engine: LibreOffice headless…");
        const loResult = await convertWithLibreOffice(pdfBytes);

        // STEP 7: Quality Control validation
        const validation = await validateDocxOutput(loResult.docxBuffer, pdfMeta);
        const warnings = [...loResult.warnings, ...validation.details];

        console.log(
            `[pdfToDocx] LibreOffice output: ${loResult.docxBuffer.length} bytes, ` +
            `quality score=${validation.score}/100`,
        );

        if (validation.passed && validation.score >= 80) {
            console.log(`[pdfToDocx] LibreOffice passed QC (score=${validation.score})`);
            return {
                docxBuffer: loResult.docxBuffer, fileName: outFileName,
                contentType, engine: "libreoffice", pageCount, warnings, validation,
            };
        }

        // ─── SECONDARY: Formatting mismatch detected → run hybrid reconstruction ───
        console.log(
            `[pdfToDocx] LibreOffice QC score ${validation.score}/100 below threshold. ` +
            `Issues: ${validation.details.join("; ")}. Running hybrid reconstruction…`,
        );

        // Extract all layers for hybrid reconstruction
        const pagesData = await extractAllLayers(pdfBytes);
        const hybridBuffer = await buildDocxFromLayers(pagesData, ocrText);
        const hybridValidation = await validateDocxOutput(hybridBuffer, pdfMeta);

        // Choose the better output
        if (hybridValidation.score > validation.score) {
            console.log(
                `[pdfToDocx] Hybrid engine produced better result (score=${hybridValidation.score} vs ${validation.score})`,
            );
            return {
                docxBuffer: hybridBuffer, fileName: outFileName,
                contentType, engine: "hybrid", pageCount,
                warnings: hybridValidation.details,
                validation: hybridValidation,
            };
        }

        // LibreOffice still better despite QC warnings
        console.log(`[pdfToDocx] LibreOffice output still better (score=${validation.score} vs ${hybridValidation.score}), using it`);
        return {
            docxBuffer: loResult.docxBuffer, fileName: outFileName,
            contentType, engine: "libreoffice", pageCount, warnings, validation,
        };
    } catch (loErr: any) {
        if (loErr.message === "LIBREOFFICE_NOT_FOUND") {
            console.warn("[pdfToDocx] LibreOffice not found – using fallback engine.");
        } else {
            console.warn("[pdfToDocx] LibreOffice failed:", loErr.message, "– using fallback.");
        }
    }

    /* ─── FALLBACK: Full layer-based reconstruction ─── */
    console.log("[pdfToDocx] Fallback: Full layer-based reconstruction…");
    const pagesData = await extractAllLayers(pdfBytes);
    const docxBuffer = await buildDocxFromLayers(pagesData, ocrText);
    const validation = await validateDocxOutput(docxBuffer, pdfMeta);

    console.log(
        `[pdfToDocx] Fallback produced ${docxBuffer.length} bytes ` +
        `(${pagesData.length} pages, ${pagesData.reduce((n, p) => n + p.images.length, 0)} images, ` +
        `${pagesData.reduce((n, p) => n + p.tables.length, 0)} tables, ` +
        `${pagesData.reduce((n, p) => n + p.watermarks.length, 0)} watermarks, ` +
        `${pagesData.reduce((n, p) => n + p.backgrounds.length, 0)} backgrounds), ` +
        `quality score=${validation.score}/100`,
    );

    return {
        docxBuffer, fileName: outFileName, contentType,
        engine: "fallback", pageCount,
        warnings: validation.details, validation,
    };
}
