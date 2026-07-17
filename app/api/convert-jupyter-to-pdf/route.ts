import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { marked } from "marked";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_MB = 50;
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FONT_SANS_PATH = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_SANS_BOLD_PATH = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");
const FONT_MONO_PATH = path.join(FONT_DIR, "DejaVuSansMono.ttf");

const loadFont = (filePath: string) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Font file missing: ${filePath}`);
    }
    return fs.readFileSync(filePath);
};

const FONT_SANS = loadFont(FONT_SANS_PATH);
const FONT_SANS_BOLD = loadFont(FONT_SANS_BOLD_PATH);
const FONT_MONO = loadFont(FONT_MONO_PATH);

const normalizeText = (value?: string | string[]) =>
    Array.isArray(value) ? value.join("") : value ?? "";

const sanitizeBaseName = (name: string) => {
    const base = name.replace(/\.[^/.]+$/, "");
    const safe = base.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 80) || "document";
};

const stripHtml = (value: string) =>
    value
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<\/?[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

type Layout = {
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    promptWidth: number;
    gutter: number;
};

function createPdfBuffer(options: {
    fileName: string;
    isPython: boolean;
    pythonSource?: string;
    notebook?: any;
}) {
    const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        compress: true,
    });

    doc.registerFont("Sans", FONT_SANS);
    doc.registerFont("Sans-Bold", FONT_SANS_BOLD);
    doc.registerFont("Mono", FONT_MONO);

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

    const endPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));
    });

    const layout: Layout = {
        marginTop: 36,
        marginBottom: 36,
        marginLeft: 36,
        marginRight: 36,
        promptWidth: 58,
        gutter: 8,
    };

    let cursorY = layout.marginTop;

    const getContentX = () => layout.marginLeft + layout.promptWidth + layout.gutter;
    const getContentWidth = () =>
        doc.page.width - layout.marginRight - getContentX();
    const getPageBottom = () => doc.page.height - layout.marginBottom;

    const ensureSpace = (height: number) => {
        if (cursorY + height <= getPageBottom()) return;
        doc.addPage();
        cursorY = layout.marginTop;
    };

    const drawTextBlock = (text: string, options: {
        x: number;
        width: number;
        font: string;
        fontSize: number;
        color?: string;
        lineGap?: number;
        spacingAfter?: number;
        align?: "left" | "right" | "center" | "justify";
    }) => {
        const spacingAfter = options.spacingAfter ?? 6;
        doc.font(options.font).fontSize(options.fontSize).fillColor(options.color || "#111827");
        const height = doc.heightOfString(text, {
            width: options.width,
            align: options.align || "left",
            lineGap: options.lineGap ?? 2,
        });
        ensureSpace(height + spacingAfter);
        doc.text(text, options.x, cursorY, {
            width: options.width,
            align: options.align || "left",
            lineGap: options.lineGap ?? 2,
        });
        cursorY += height + spacingAfter;
    };

    const drawHeader = (title: string, createdAt: string) => {
        doc.font("Sans-Bold").fontSize(16).fillColor("#111827");
        const titleHeight = doc.heightOfString(title, { width: doc.page.width - layout.marginLeft - layout.marginRight });
        ensureSpace(titleHeight + 10);
        doc.text(title, layout.marginLeft, cursorY, {
            width: doc.page.width - layout.marginLeft - layout.marginRight,
        });
        cursorY += titleHeight + 4;
        doc.font("Sans").fontSize(9).fillColor("#6b7280");
        doc.text(`Generated on ${createdAt}`, layout.marginLeft, cursorY, {
            width: doc.page.width - layout.marginLeft - layout.marginRight,
        });
        cursorY += 10;
        doc.moveTo(layout.marginLeft, cursorY).lineTo(doc.page.width - layout.marginRight, cursorY).strokeColor("#d0d0d0").stroke();
        cursorY += 12;
    };

    const drawPrompt = (label: string) => {
        doc.font("Mono").fontSize(9).fillColor("#1f4b99");
        doc.text(label, layout.marginLeft, cursorY + 2, {
            width: layout.promptWidth,
            align: "right",
        });
    };

    const drawCodeBlock = (code: string, label: string) => {
        const contentX = getContentX();
        const contentWidth = getContentWidth();
        const padding = 6;
        doc.font("Mono").fontSize(9.5);
        const textHeight = doc.heightOfString(code, {
            width: contentWidth - padding * 2,
            lineGap: 2,
        });
        const blockHeight = textHeight + padding * 2;

        ensureSpace(blockHeight + 4);
        drawPrompt(label);
        doc.save();
        doc.rect(contentX, cursorY, contentWidth, blockHeight).fill("#f7f7f7");
        doc.restore();
        doc.fillColor("#111827").font("Mono").fontSize(9.5);
        doc.text(code, contentX + padding, cursorY + padding, {
            width: contentWidth - padding * 2,
            lineGap: 2,
        });
        cursorY += blockHeight + 6;
    };

    const drawOutputBlock = (text: string, label?: string, options?: { error?: boolean }) => {
        const contentX = getContentX();
        const contentWidth = getContentWidth();
        const padding = 6;
        doc.font("Mono").fontSize(9.5);
        const textHeight = doc.heightOfString(text, {
            width: contentWidth - padding * 2,
            lineGap: 2,
        });
        const blockHeight = textHeight + padding * 2;

        ensureSpace(blockHeight + 4);
        if (label) {
            drawPrompt(label);
        }
        doc.save();
        doc.rect(contentX, cursorY, contentWidth, blockHeight).fill(options?.error ? "#fff2f2" : "#f7f7f7");
        doc.restore();
        doc.fillColor(options?.error ? "#7f1d1d" : "#111827").font("Mono").fontSize(9.5);
        doc.text(text, contentX + padding, cursorY + padding, {
            width: contentWidth - padding * 2,
            lineGap: 2,
        });
        cursorY += blockHeight + 6;
    };

    const drawImageOutput = (buffer: Buffer, label?: string) => {
        const contentX = getContentX();
        const contentWidth = getContentWidth();
        let image;
        try {
            image = (doc as any).openImage(buffer);
        } catch {
            return;
        }
        const scale = Math.min(contentWidth / image.width, 1);
        const width = image.width * scale;
        const height = image.height * scale;

        ensureSpace(height + 6);
        if (label) {
            drawPrompt(label);
        }
        doc.image(image, contentX, cursorY, { width });
        cursorY += height + 6;
    };

    const renderMarkdown = (markdown: string) => {
        const tokens = marked.lexer(markdown || "");
        for (const token of tokens) {
            if (token.type === "space") {
                cursorY += 6;
                continue;
            }
            if (token.type === "heading") {
                const depth = (token as any).depth || 2;
                const size = depth === 1 ? 14 : depth === 2 ? 12 : 11;
                drawTextBlock((token as any).text || "", {
                    x: getContentX(),
                    width: getContentWidth(),
                    font: "Sans-Bold",
                    fontSize: size,
                    spacingAfter: 6,
                    lineGap: 2,
                });
                continue;
            }
            if (token.type === "paragraph") {
                drawTextBlock((token as any).text || "", {
                    x: getContentX(),
                    width: getContentWidth(),
                    font: "Sans",
                    fontSize: 10.5,
                    spacingAfter: 6,
                    lineGap: 2,
                });
                continue;
            }
            if (token.type === "list") {
                const list = token as any;
                const items = list.items || [];
                items.forEach((item: any, index: number) => {
                    const bullet = list.ordered ? `${index + 1}.` : "•";
                    const text = item.text || "";
                    drawTextBlock(`${bullet} ${text}`, {
                        x: getContentX(),
                        width: getContentWidth(),
                    font: "Sans",
                        fontSize: 10.5,
                        spacingAfter: 4,
                        lineGap: 2,
                    });
                });
                continue;
            }
            if (token.type === "code") {
                const code = (token as any).text || "";
                drawOutputBlock(code, undefined);
                continue;
            }
            if (token.type === "blockquote") {
                drawTextBlock((token as any).text || "", {
                    x: getContentX(),
                    width: getContentWidth(),
                    font: "Sans",
                    fontSize: 10,
                    color: "#4b5563",
                    spacingAfter: 6,
                    lineGap: 2,
                });
                continue;
            }
            if (token.type === "hr") {
                ensureSpace(8);
                doc.moveTo(getContentX(), cursorY).lineTo(getContentX() + getContentWidth(), cursorY).strokeColor("#d0d0d0").stroke();
                cursorY += 10;
                continue;
            }
        }
    };

    const title = options.fileName.replace(/\.(ipynb|py)$/i, "");
    const createdAt = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    drawHeader(title, createdAt);

    if (options.isPython && options.pythonSource) {
        const codeText = options.pythonSource.trimEnd();
        drawCodeBlock(codeText, "In [ ]:");
        doc.end();
        return endPromise;
    }

    const cells = options.notebook?.cells || [];
    for (const cell of cells) {
        const source = normalizeText(cell?.source).trim();
        if (!source) continue;

        if (cell.cell_type === "markdown") {
            renderMarkdown(source);
            continue;
        }

        if (cell.cell_type === "code") {
            const exec = cell.execution_count ?? " ";
            const execLabel = exec === null || exec === undefined ? " " : String(exec);
            drawCodeBlock(source, `In [${execLabel}]:`);

            const outputs = Array.isArray(cell.outputs) ? cell.outputs : [];
            let outLabelUsed = false;
            for (const output of outputs) {
                const label = outLabelUsed ? undefined : `Out [${execLabel}]:`;
                if (output.output_type === "stream") {
                    const text = normalizeText(output.text);
                    if (text.trim()) {
                        drawOutputBlock(text.trimEnd(), label);
                        outLabelUsed = true;
                    }
                    continue;
                }
                if (output.output_type === "error") {
                    const traceback = normalizeText(output.traceback);
                    if (traceback.trim()) {
                        drawOutputBlock(traceback.trimEnd(), label, { error: true });
                        outLabelUsed = true;
                    }
                    continue;
                }
                if (output.output_type === "execute_result" || output.output_type === "display_data") {
                    const data = output.data || {};
                    if (data["image/png"]) {
                        drawImageOutput(Buffer.from(data["image/png"], "base64"), label);
                        outLabelUsed = true;
                        continue;
                    }
                    if (data["image/jpeg"]) {
                        drawImageOutput(Buffer.from(data["image/jpeg"], "base64"), label);
                        outLabelUsed = true;
                        continue;
                    }
                    if (data["text/plain"]) {
                        const text = normalizeText(data["text/plain"]);
                        if (text.trim()) {
                            drawOutputBlock(text.trimEnd(), label);
                            outLabelUsed = true;
                        }
                        continue;
                    }
                    if (data["text/markdown"]) {
                        const text = normalizeText(data["text/markdown"]);
                        if (text.trim()) {
                            drawOutputBlock(text.trimEnd(), label);
                            outLabelUsed = true;
                        }
                        continue;
                    }
                    if (data["text/html"]) {
                        const text = stripHtml(normalizeText(data["text/html"]));
                        if (text.trim()) {
                            drawOutputBlock(text.trimEnd(), label);
                            outLabelUsed = true;
                        }
                        continue;
                    }
                    if (data["application/json"]) {
                        const jsonText = JSON.stringify(data["application/json"], null, 2);
                        drawOutputBlock(jsonText, label);
                        outLabelUsed = true;
                    }
                }
            }
        }
    }

    doc.end();
    return endPromise;
}

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        try {
            const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Please upload a .py or .ipynb file." }, { status: 400 });
        }

        const isPython = file.name.toLowerCase().endsWith(".py");
        const isNotebook = file.name.toLowerCase().endsWith(".ipynb");

        if (!isPython && !isNotebook) {
            return NextResponse.json({ error: "Only .py and .ipynb files are supported." }, { status: 400 });
        }

        if (file.size > MAX_MB * 1024 * 1024) {
            return NextResponse.json({ error: `File too large. Max allowed is ${MAX_MB}MB.` }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const content = buffer.toString("utf-8");
        const baseName = sanitizeBaseName(file.name);

        if (isPython) {
            if (!content.trim()) {
                return NextResponse.json({ error: "This Python file is empty." }, { status: 400 });
            }
            const pdfBuffer = await createPdfBuffer({
                fileName: file.name,
                isPython: true,
                pythonSource: content,
            });

            return new NextResponse(new Uint8Array(pdfBuffer), {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
                    "Cache-Control": "no-store, max-age=0",
                },
            });
        }

        let notebook: any;
        try {
            notebook = JSON.parse(content);
        } catch {
            return NextResponse.json({ error: "Invalid .ipynb file." }, { status: 400 });
        }

        if (!Array.isArray(notebook?.cells) || notebook.cells.length === 0) {
            return NextResponse.json({ error: "This notebook has no cells to render." }, { status: 400 });
        }

        const pdfBuffer = await createPdfBuffer({
            fileName: file.name,
            isPython: false,
            notebook,
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
                "Cache-Control": "no-store, max-age=0",
            },
        });
        } catch (error) {
            return NextResponse.json(
                { error: `Failed to convert: ${error instanceof Error ? error.message : "Unknown error"}` },
                { status: 500 }
            );
        }
    });
}
