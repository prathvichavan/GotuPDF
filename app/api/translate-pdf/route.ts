import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  Language mapping for MyMemory translation API                     */
/* ------------------------------------------------------------------ */
const LANG_CODES: Record<string, string> = {
    en: "en", mr: "mr", hi: "hi", es: "es", fr: "fr", de: "de",
    it: "it", pt: "pt", nl: "nl", ru: "ru", ja: "ja", ko: "ko",
    "zh-CN": "zh-CN", ar: "ar",
};

const DEVANAGARI_LANGS = new Set(["mr", "hi"]);

/* ------------------------------------------------------------------ */
/*  Font cache (persists across requests in the same process)         */
/* ------------------------------------------------------------------ */
let cachedNotoSans: Buffer | null = null;
let cachedNotoDevanagari: Buffer | null = null;

function loadFont(fileName: string): Buffer {
    const fontPath = path.join(process.cwd(), "public", "fonts", fileName);
    return fs.readFileSync(fontPath);
}
function getNotoSans(): Buffer {
    if (!cachedNotoSans) cachedNotoSans = loadFont("NotoSans-Regular.ttf");
    return cachedNotoSans;
}
function getNotoDevanagari(): Buffer {
    if (!cachedNotoDevanagari) cachedNotoDevanagari = loadFont("NotoSansDevanagari-Regular.ttf");
    return cachedNotoDevanagari;
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface TextBlock {
    str: string;
    x: number;
    y: number;
    fontSize: number;
    width: number;
    height: number;
}

interface PageLayout {
    pageIndex: number;
    width: number;
    height: number;
    blocks: TextBlock[];
    isScanned: boolean;
    translated?: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function chunkText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?।])\s+/);
    let cur = "";
    for (const s of sentences) {
        if ((cur + " " + s).length > maxLen && cur) { chunks.push(cur.trim()); cur = s; }
        else cur = cur ? cur + " " + s : s;
    }
    if (cur.trim()) chunks.push(cur.trim());
    // force-split anything still too long
    const out: string[] = [];
    for (const c of chunks) {
        if (c.length <= maxLen) { out.push(c); continue; }
        const words = c.split(/\s+/);
        let w = "";
        for (const word of words) {
            if ((w + " " + word).length > maxLen && w) { out.push(w.trim()); w = word; }
            else w = w ? w + " " + word : word;
        }
        if (w.trim()) out.push(w.trim());
    }
    return out;
}

async function translateChunk(text: string, src: string, tgt: string): Promise<string> {
    if (!text.trim()) return "";
    try {
        const pair = `${LANG_CODES[src] || src}|${LANG_CODES[tgt] || tgt}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.responseData?.translatedText || text;
    } catch {
        return text;
    }
}

async function translateString(text: string, src: string, tgt: string): Promise<string> {
    const chunks = chunkText(text, 450);
    const parts: string[] = [];
    for (const c of chunks) parts.push(await translateChunk(c, src, tgt));
    return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/*  Extract text layout from PDF via pdfjs-dist                       */
/* ------------------------------------------------------------------ */
async function extractPageLayouts(pdfBytes: ArrayBuffer): Promise<PageLayout[]> {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "";
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true, isEvalSupported: false } as any).promise;
    const layouts: PageLayout[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const blocks: TextBlock[] = [];

        for (const item of content.items as any[]) {
            if (!item.str || !item.str.trim()) continue;
            const tx = item.transform; // [scaleX, skewX, skewY, scaleY, posX, posY]
            const fontSize = Math.abs(tx[3]) || Math.abs(tx[0]) || 11;
            blocks.push({
                str: item.str,
                x: tx[4],
                y: tx[5],
                fontSize: Math.round(fontSize * 10) / 10,
                width: item.width || 0,
                height: item.height || fontSize,
            });
        }

        layouts.push({
            pageIndex: i - 1,
            width: vp.width,
            height: vp.height,
            blocks,
            isScanned: blocks.length < 3,
        });
    }
    doc.destroy();
    return layouts;
}

/* ------------------------------------------------------------------ */
/*  OCR fallback for scanned pages                                    */
/* ------------------------------------------------------------------ */
async function ocrPageText(pdfBytes: ArrayBuffer, pageIdx: number, lang: string): Promise<TextBlock[]> {
    try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "";
        const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true, isEvalSupported: false } as any).promise;
        const page = await doc.getPage(pageIdx + 1);
        const vp = page.getViewport({ scale: 1 });

        // Try to get any text pdfjs can find
        const tc = await page.getTextContent();
        const raw = tc.items.map((it: any) => it.str).join(" ").trim();
        doc.destroy();

        if (raw.length > 5) {
            return [{ str: raw, x: 50, y: vp.height - 60, fontSize: 11, width: vp.width - 100, height: 14 }];
        }

        // If truly no text, try Tesseract
        const Tesseract = await import("tesseract.js");
        const tessLang = lang === "mr" ? "mar" : lang === "hi" ? "hin" : "eng";
        const worker = await Tesseract.createWorker(tessLang);
        // Note: full canvas-based OCR requires node-canvas which may not be available
        // Return placeholder for truly image-only pages
        await worker.terminate();

        return [{ str: "[Scanned page – limited extraction]", x: 50, y: vp.height / 2, fontSize: 11, width: vp.width - 100, height: 14 }];
    } catch {
        return [{ str: "[OCR unavailable for this page]", x: 50, y: 400, fontSize: 11, width: 400, height: 14 }];
    }
}

/* ------------------------------------------------------------------ */
/*  Draw translated text over a copied page                           */
/* ------------------------------------------------------------------ */
function renderTranslated(
    page: PDFPage,
    blocks: TextBlock[],
    translated: string[],
    font: PDFFont,
) {
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const t = (translated[i] || b.str).trim();
        if (!t) continue;

        const fs = Math.max(6, Math.min(b.fontSize, 36));
        const w = Math.max(b.width, t.length * fs * 0.45) + 6;

        // white-out original text area
        page.drawRectangle({
            x: b.x - 1,
            y: b.y - 2,
            width: w,
            height: b.height + 4,
            color: rgb(1, 1, 1),
            opacity: 1,
        });

        // draw translated text
        try {
            page.drawText(t, { x: b.x, y: b.y, size: fs, font, color: rgb(0, 0, 0) });
        } catch {
            // character not in font — skip
        }
    }
}

/* ================================================================== */
/*  POST handler                                                      */
/* ================================================================== */
export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
        try {
            const formData = await req.formData();
            const file = formData.get("file0") as File | null;
            if (!file) return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });

        const targetLang = (formData.get("targetLanguage") as string) || "es";
        const sourceLang = (formData.get("sourceLanguage") as string) || "en";

        const bytes = await file.arrayBuffer();

        // 1 — extract layout
        const layouts = await extractPageLayouts(bytes);

        // 2 — OCR scanned pages
        for (const l of layouts) {
            if (l.isScanned) l.blocks = await ocrPageText(bytes, l.pageIndex, sourceLang);
        }

        // 3 — translate every page
        for (const l of layouts) {
            if (l.blocks.length === 0) { l.translated = []; continue; }
            const txts: string[] = [];
            for (const b of l.blocks) txts.push(await translateString(b.str, sourceLang, targetLang));
            l.translated = txts;
        }

        // 4 — rebuild PDF preserving original layout
        const origDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const outDoc = await PDFDocument.create();
        outDoc.registerFontkit(fontkit);

        // embed correct font
        let font: PDFFont;
        try {
            const fontBuf = DEVANAGARI_LANGS.has(targetLang) ? getNotoDevanagari() : getNotoSans();
            font = await outDoc.embedFont(fontBuf, { subset: false });
        } catch {
            const { StandardFonts } = await import("pdf-lib");
            font = await outDoc.embedFont(StandardFonts.Helvetica);
        }

        const copied = await outDoc.copyPages(origDoc, origDoc.getPageIndices());

        for (let i = 0; i < copied.length; i++) {
            const page = copied[i];
            outDoc.addPage(page);
            const l = layouts[i];
            if (!l || l.blocks.length === 0) continue;
            renderTranslated(page, l.blocks, l.translated || [], font);
        }

        const pdfBytes = await outDoc.save();

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="translated.pdf"`,
                "X-Total-Pages": String(outDoc.getPageCount()),
                "X-Target-Language": targetLang,
                "X-Source-Language": sourceLang,
            },
        });
        } catch (error: any) {
            console.error("Translate PDF error:", error);
            return NextResponse.json(
                { error: error?.message || "Failed to translate PDF" },
                { status: 500 },
            );
        }
    });
}
