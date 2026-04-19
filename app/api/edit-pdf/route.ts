import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { applyExactTextEdits, ExactTextEdit } from "@/lib/pdfStreamEditor";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

/**
 * API Route for TRUE PDF text editing (Exact Mode)
 * Performs in-place content stream replacement for strict, Sejda-grade fidelity.
 * If the PDF structure or encoding is too complex, it returns a clear error.
 */

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FONT_FILES = {
  sans: "DejaVuSans.ttf",
  sansBold: "DejaVuSans-Bold.ttf",
  sansItalic: "DejaVuSans-Oblique.ttf",
  sansBoldItalic: "DejaVuSans-BoldOblique.ttf",
  mono: "DejaVuSansMono.ttf",
  monoBold: "DejaVuSansMono-Bold.ttf",
  monoItalic: "DejaVuSansMono-Oblique.ttf",
  monoBoldItalic: "DejaVuSansMono-BoldOblique.ttf",
  serif: "DejaVuSerif.ttf",
  serifBold: "DejaVuSerif-Bold.ttf",
  serifItalic: "DejaVuSerif-Italic.ttf",
  serifBoldItalic: "DejaVuSerif-BoldItalic.ttf",
} as const;

const loadFontBytes = (fileName: string) => {
  const fontPath = path.join(FONT_DIR, fileName);
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font file missing: ${fontPath}`);
  }
  return fs.readFileSync(fontPath);
};

const FONT_BYTES = {
  sans: loadFontBytes(FONT_FILES.sans),
  sansBold: loadFontBytes(FONT_FILES.sansBold),
  sansItalic: loadFontBytes(FONT_FILES.sansItalic),
  sansBoldItalic: loadFontBytes(FONT_FILES.sansBoldItalic),
  mono: loadFontBytes(FONT_FILES.mono),
  monoBold: loadFontBytes(FONT_FILES.monoBold),
  monoItalic: loadFontBytes(FONT_FILES.monoItalic),
  monoBoldItalic: loadFontBytes(FONT_FILES.monoBoldItalic),
  serif: loadFontBytes(FONT_FILES.serif),
  serifBold: loadFontBytes(FONT_FILES.serifBold),
  serifItalic: loadFontBytes(FONT_FILES.serifItalic),
  serifBoldItalic: loadFontBytes(FONT_FILES.serifBoldItalic),
};

/**
 * POST /api/edit-pdf
 * 
 * Request body (JSON):
 * {
 *   pdfBase64: string,  // Base64 encoded PDF
 *   edits: Array<{
 *     text: string,
 *     originalText: string,
 *     sourceIndex: number,
 *     x: number,
 *     y: number,
 *     fontSize: number,
 *     fontName: string,
 *     color: string,
 *     pageNumber: number
 *   }>
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   pdfBase64?: string,  // Edited PDF as base64
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {  return withUsageLimit(request, async () => {  try {
    const contentType = request.headers.get("content-type") || "";
    let pdfBuffer: Buffer | null = null;
    let edits: any[] = [];
    let mode: string | null = null;
    let allowFallback = true;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { pdfBase64, edits: jsonEdits, mode: jsonMode = "mixed", allowFallback: jsonAllowFallback = true } = body || {};
      if (!pdfBase64 || !jsonEdits || !Array.isArray(jsonEdits)) {
        return NextResponse.json(
          { success: false, error: "Invalid request format" },
          { status: 400 }
        );
      }
      pdfBuffer = Buffer.from(pdfBase64, "base64");
      edits = jsonEdits;
      mode = jsonMode;
      allowFallback = Boolean(jsonAllowFallback);
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const editsRaw = formData.get("edits");
      const modeRaw = formData.get("mode");
      const fallbackRaw = formData.get("allowFallback");

      if (!file) {
        return NextResponse.json(
          { success: false, error: "Please upload a PDF file." },
          { status: 400 }
        );
      }
      if (!editsRaw) {
        return NextResponse.json(
          { success: false, error: "Missing edits payload." },
          { status: 400 }
        );
      }
      pdfBuffer = Buffer.from(await file.arrayBuffer());
      edits = JSON.parse(String(editsRaw));
      mode = modeRaw ? String(modeRaw) : "mixed";
      allowFallback = fallbackRaw ? String(fallbackRaw) !== "false" : true;
      const annotationsRaw = formData.get("annotations");
      if (annotationsRaw) {
        (request as any).__annotations = JSON.parse(String(annotationsRaw));
      }
    }

    if (!pdfBuffer || !edits || !Array.isArray(edits)) {
      return NextResponse.json(
        { success: false, error: "Invalid request format" },
        { status: 400 }
      );
    }

    const toExactEdit = (edit: any): ExactTextEdit => ({
      pageNumber: Number(edit.pageNumber),
      sourceIndex: Number(edit.sourceIndex),
      originalText: String(edit.originalText ?? ""),
      text: String(edit.text ?? ""),
      x: typeof edit.x === "number" ? edit.x : undefined,
      y: typeof edit.y === "number" ? edit.y : undefined,
      transform: Array.isArray(edit.transform) ? edit.transform : undefined,
    });

    const toOverlayEdit = (edit: any): OverlayTextEdit => ({
      pageNumber: Number(edit.pageNumber),
      text: String(edit.text ?? ""),
      originalText: String(edit.originalText ?? ""),
      x: typeof edit.x === "number" ? edit.x : undefined,
      y: typeof edit.y === "number" ? edit.y : undefined,
      width: typeof edit.width === "number" ? edit.width : undefined,
      height: typeof edit.height === "number" ? edit.height : undefined,
      fontSize: typeof edit.fontSize === "number" ? edit.fontSize : undefined,
      fontName: typeof edit.fontName === "string" ? edit.fontName : undefined,
      fontWeight: typeof edit.fontWeight === "string" ? edit.fontWeight : undefined,
      fontStyle: typeof edit.fontStyle === "string" ? edit.fontStyle : undefined,
      color: typeof edit.color === "string" ? edit.color : undefined,
      coverColor: typeof edit.coverColor === "string" ? edit.coverColor : undefined,
      transform: Array.isArray(edit.transform) ? edit.transform : undefined,
    });

    const exactCandidates = edits.filter((edit: any) => Number.isFinite(Number(edit.sourceIndex)));
    const overlayCandidates = edits.filter((edit: any) => !Number.isFinite(Number(edit.sourceIndex)));

    const normalizedExactEdits = exactCandidates.map(toExactEdit);
    const overlayEdits = edits.map(toOverlayEdit);

    let editedBytes = new Uint8Array(pdfBuffer);
    let resultMode: "exact" | "overlay" | "mixed" = "exact";
    let warning: string | undefined;

    const wantsOverlayOnly = mode === "overlay";
    const wantsExactOnly = mode === "exact";

    if (wantsOverlayOnly) {
      editedBytes = await applyOverlayTextEdits(editedBytes, overlayEdits);
      resultMode = "overlay";
      warning = "Exact text replacement was not requested. Exported using visual overlay edits.";
    } else if (wantsExactOnly) {
      try {
        editedBytes = await applyExactTextEdits(editedBytes, normalizedExactEdits);
        resultMode = "exact";
      } catch (error) {
        if (!allowFallback) throw error;
        editedBytes = await applyOverlayTextEdits(editedBytes, overlayEdits);
        resultMode = "overlay";
        warning =
          "Exact text replacement was not possible for this PDF. Exported using visual overlay edits for reliability.";
      }
    } else {
      const exactFailures: OverlayTextEdit[] = [];
      for (const sourceEdit of exactCandidates) {
        const exactEdit = toExactEdit(sourceEdit);
        try {
          editedBytes = await applyExactTextEdits(editedBytes, [exactEdit]);
        } catch (error) {
          if (!allowFallback) throw error;
          exactFailures.push(toOverlayEdit(sourceEdit));
        }
      }

      const overlayQueue = [
        ...overlayCandidates.map(toOverlayEdit),
        ...exactFailures,
      ];

      if (overlayQueue.length > 0) {
        editedBytes = await applyOverlayTextEdits(editedBytes, overlayQueue);
      }

      if (normalizedExactEdits.length > 0 && overlayQueue.length > 0) {
        resultMode = "mixed";
        warning =
          "Some edits required overlay replacement for reliable output. Exact edits were applied where possible.";
      } else if (overlayQueue.length > 0) {
        resultMode = "overlay";
        warning = "Exact text replacement was not available. Exported using overlay edits.";
      } else {
        resultMode = "exact";
      }
    }

    // Process annotations (new text, highlights, shapes)
    const annotationsData = (request as any).__annotations as any[] | undefined;
    if (annotationsData && annotationsData.length > 0) {
      const annDoc = await PDFDocument.load(editedBytes);
      annDoc.registerFontkit(fontkit);
      const annPages = annDoc.getPages();
      let annFont: PDFFont | null = null;
      for (const ann of annotationsData) {
        const page = annPages[ann.pageNumber - 1];
        if (!page) continue;
        const { height: pH } = page.getSize();
        const color = parseHexColor(ann.color);
        if (ann.type === 'text' && ann.text) {
          if (!annFont) annFont = await annDoc.embedFont(StandardFonts.Helvetica);
          const fs = ann.fontSize || 12;
          page.drawText(ann.text, {
            x: ann.x,
            y: pH - ann.y - fs,
            size: fs,
            font: annFont,
            color,
            opacity: ann.opacity ?? 1,
          });
        } else if (ann.type === 'highlight') {
          page.drawRectangle({
            x: ann.x,
            y: pH - ann.y - ann.height,
            width: ann.width,
            height: ann.height,
            color,
            opacity: ann.opacity ?? 0.35,
          });
        } else if (ann.type === 'rect') {
          page.drawRectangle({
            x: ann.x,
            y: pH - ann.y - ann.height,
            width: ann.width,
            height: ann.height,
            borderColor: color,
            borderWidth: 2,
            opacity: ann.opacity ?? 1,
          });
        }
      }
      editedBytes = await annDoc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "no-store, max-age=0");
    headers.set("X-Edit-Mode", resultMode);
    if (warning) {
      headers.set("X-Edit-Warning", warning);
    }

    return new NextResponse(Buffer.from(editedBytes), {
      status: 200,
      headers,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    const status = message.startsWith("Exact edit failed") ? 422 : 500;
    console.error("PDF editing error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
  });
}

/**
 * GET /api/edit-pdf
 * Returns API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'Edit PDF API',
    version: '1.0.0',
    description: 'Server-side PDF editing with strict, in-place content stream replacement',
    endpoints: {
      POST: {
        description: 'Edit PDF with text modifications',
        body: {
          pdfBase64: 'Base64 encoded PDF',
          edits: 'Array of edit objects (requires sourceIndex + originalText)',
          mode: 'exact | overlay (optional)',
          allowFallback: 'boolean (optional)',
        },
      },
    },
  });
}

interface OverlayTextEdit {
  pageNumber: number;
  text: string;
  originalText: string;
  x?: number; // PDF units, left
  y?: number; // PDF units, top (from top)
  width?: number;
  height?: number;
  fontSize?: number;
  fontName?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  coverColor?: string;
  transform?: number[];
}

async function applyOverlayTextEdits(pdfBytes: Uint8Array, edits: OverlayTextEdit[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const pages = pdfDoc.getPages();
  const standardCache = new Map<StandardFonts, PDFFont>();
  const customCache = new Map<string, PDFFont>();

  for (const edit of edits) {
    if (!edit || edit.text === edit.originalText) continue;
    const page = pages[edit.pageNumber - 1];
    if (!page) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const fontSize = typeof edit.fontSize === "number" && edit.fontSize > 0 ? edit.fontSize : 12;
    const { x, y } = resolvePdfPosition(edit, pageHeight, fontSize);
    const font = await getOverlayFont(pdfDoc, standardCache, customCache, edit);
    const color = parseHexColor(edit.color);
    const coverColor = edit.coverColor ? parseHexColor(edit.coverColor) : rgb(1, 1, 1);

    // Cover the original text area (best-effort)
    const cover = resolveCoverRect(edit, pageHeight, fontSize, x, pageWidth);
    if (cover) {
      page.drawRectangle({
        x: cover.x,
        y: cover.y,
        width: cover.width,
        height: cover.height,
        color: coverColor,
        opacity: 1,
      });
    }

    page.drawText(edit.text, {
      x,
      y,
      size: fontSize,
      font,
      color,
      maxWidth: typeof edit.width === "number" && edit.width > 0 ? edit.width : undefined,
      lineHeight: fontSize * 1.15,
    });
  }

  return await pdfDoc.save({
    useObjectStreams: false,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
}

function resolvePdfPosition(edit: OverlayTextEdit, pageHeight: number, fontSize: number) {
  if (edit.transform && edit.transform.length >= 6) {
    return {
      x: edit.transform[4],
      y: edit.transform[5],
    };
  }

  const x = typeof edit.x === "number" ? edit.x : 0;
  const topY = typeof edit.y === "number" ? edit.y : 0;
  const baselineY = pageHeight - topY - fontSize;
  return { x, y: baselineY };
}

function resolveCoverRect(
  edit: OverlayTextEdit,
  pageHeight: number,
  fontSize: number,
  fallbackX: number,
  pageWidth: number
) {
  if (typeof edit.x !== "number" && typeof edit.transform !== "object") {
    return null;
  }

  const x = typeof edit.x === "number" ? edit.x : fallbackX;
  const topY = typeof edit.y === "number" ? edit.y : pageHeight - fontSize;
  const height = typeof edit.height === "number" && edit.height > 0 ? edit.height : fontSize * 1.1;
  const referenceText = edit.originalText || edit.text || " ";
  const width =
    typeof edit.width === "number" && edit.width > 0
      ? edit.width
      : Math.min(pageWidth - x, Math.max(referenceText.length, 1) * (fontSize * 0.6));

  const y = pageHeight - topY - height;
  if (width <= 0 || height <= 0) return null;

  return { x, y, width, height };
}

function parseHexColor(hex?: string) {
  if (!hex) return rgb(0, 0, 0);
  const match = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return rgb(0, 0, 0);
  const int = parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  return rgb(r, g, b);
}

async function getOverlayFont(
  pdfDoc: PDFDocument,
  standardCache: Map<StandardFonts, PDFFont>,
  customCache: Map<string, PDFFont>,
  edit: OverlayTextEdit
) {
  const name = (edit.fontName || "").toLowerCase();
  const weight = (edit.fontWeight || "").toLowerCase();
  const style = (edit.fontStyle || "").toLowerCase();
  const isBold = name.includes("bold") || weight === "bold";
  const isItalic =
    name.includes("italic") || name.includes("oblique") || style === "italic" || style === "oblique";
  const isMono = name.includes("courier") || name.includes("mono");
  const isSerif = name.includes("times") || name.includes("serif") || name.includes("roman");

  const resolveCustomFont = async (key: string, bytes: Buffer) => {
    if (!customCache.has(key)) {
      customCache.set(key, await pdfDoc.embedFont(bytes));
    }
    return customCache.get(key)!;
  };

  const resolveStandard = async (fontKey: StandardFonts) => {
    if (!standardCache.has(fontKey)) {
      standardCache.set(fontKey, await pdfDoc.embedFont(fontKey));
    }
    return standardCache.get(fontKey)!;
  };

  try {
    if (isMono) {
      if (isBold && isItalic) return resolveCustomFont("monoBoldItalic", FONT_BYTES.monoBoldItalic);
      if (isBold) return resolveCustomFont("monoBold", FONT_BYTES.monoBold);
      if (isItalic) return resolveCustomFont("monoItalic", FONT_BYTES.monoItalic);
      return resolveCustomFont("mono", FONT_BYTES.mono);
    }

    if (isSerif) {
      if (isBold && isItalic) return resolveCustomFont("serifBoldItalic", FONT_BYTES.serifBoldItalic);
      if (isBold) return resolveCustomFont("serifBold", FONT_BYTES.serifBold);
      if (isItalic) return resolveCustomFont("serifItalic", FONT_BYTES.serifItalic);
      return resolveCustomFont("serif", FONT_BYTES.serif);
    }

    if (isBold && isItalic) return resolveCustomFont("sansBoldItalic", FONT_BYTES.sansBoldItalic);
    if (isBold) return resolveCustomFont("sansBold", FONT_BYTES.sansBold);
    if (isItalic) return resolveCustomFont("sansItalic", FONT_BYTES.sansItalic);
    return resolveCustomFont("sans", FONT_BYTES.sans);
  } catch (error) {
    console.warn("Custom font embedding failed, falling back to standard fonts.", error);
  }

  let fontKey: StandardFonts;
  if (isMono) {
    fontKey = isBold && isItalic ? StandardFonts.CourierBoldOblique : isBold ? StandardFonts.CourierBold : isItalic ? StandardFonts.CourierOblique : StandardFonts.Courier;
  } else if (isSerif) {
    fontKey = isBold && isItalic ? StandardFonts.TimesBoldItalic : isBold ? StandardFonts.TimesBold : isItalic ? StandardFonts.TimesItalic : StandardFonts.TimesRoman;
  } else {
    fontKey = isBold && isItalic ? StandardFonts.HelveticaBoldOblique : isBold ? StandardFonts.HelveticaBold : isItalic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
  }

  return resolveStandard(fontKey);
}

