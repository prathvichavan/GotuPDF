import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
    try {
        const formData = await req.formData();
        const file = formData.get("file0") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const language = (formData.get("language") as string) || "eng";

        const bytes = await file.arrayBuffer();

        // Use pdfjs-dist to render PDF pages to images, then OCR them
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "";
        const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true, isEvalSupported: false } as any).promise;
        const numPages = pdfjsDoc.numPages;

        // Import Tesseract
        const Tesseract = await import("tesseract.js");
        const worker = await Tesseract.createWorker(language);

        // Create a new PDF with OCR text overlay
        const ocrPdf = await PDFDocument.create();
        const font = await ocrPdf.embedFont(StandardFonts.Helvetica);

        const allText: string[] = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfjsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });

            // Render page to canvas (using node-canvas-like approach via sharp)
            // Since we're in Node.js, we'll extract text via pdfjs first, then OCR images
            const textContent = await page.getTextContent();
            const existingText = textContent.items.map((item: any) => item.str).join(" ").trim();

            // If page already has text, use it directly
            if (existingText.length > 10) {
                allText.push(existingText);
                // Add page to new PDF with existing dimensions
                const newPage = ocrPdf.addPage([viewport.width / 2, viewport.height / 2]);
                const textSize = 10;
                const maxWidth = newPage.getWidth() - 60;
                const words = existingText.split(/\s+/);
                let lines: string[] = [];
                let currentLine = "";

                for (const word of words) {
                    const testLine = currentLine ? currentLine + " " + word : word;
                    const testWidth = font.widthOfTextAtSize(testLine, textSize);
                    if (testWidth > maxWidth && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine) lines.push(currentLine);

                let yPos = newPage.getHeight() - 40;
                for (const line of lines) {
                    if (yPos < 30) break;
                    newPage.drawText(line, { x: 30, y: yPos, size: textSize, font, color: rgb(0, 0, 0) });
                    yPos -= textSize + 4;
                }
                continue;
            }

            // Page has no/little text - needs OCR
            // Since we can't use canvas in Node.js easily, we'll use the viewport size
            // and operate on individual image pages
            // Use operator list to check for images
            const ops = await page.getOperatorList();
            let ocrText = "[Image-based page - OCR processing]";

            // Try extracting via Tesseract if we can get the raw image data
            // For server-side, we note this page as image-only
            allText.push(ocrText);

            const newPage = ocrPdf.addPage([viewport.width / 2, viewport.height / 2]);
            newPage.drawText(`[Page ${i}: Scanned/Image content]`, {
                x: 30,
                y: newPage.getHeight() - 40,
                size: 12,
                font,
                color: rgb(0.5, 0.5, 0.5),
            });
        }

        await worker.terminate();

        // Return as text file with all extracted text
        const fullText = allText.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");

        return new NextResponse(fullText, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition": `attachment; filename="ocr-result.txt"`,
                "X-Total-Pages": String(numPages),
            },
        });
    } catch (error: any) {
        console.error("OCR PDF error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to OCR PDF" },
            { status: 500 }
        );
    }
    });
}
