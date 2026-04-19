import { NextRequest, NextResponse } from "next/server";
import {
    PdfToPptxError,
    convertPdfToPptx,
} from "@/lib/pdfToPptxImage";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_MAX_MB = 50;

function getMaxFileSizeBytes() {
    return Math.max(1, Number(process.env.PDF_TO_PPT_MAX_MB || DEFAULT_MAX_MB)) * 1024 * 1024;
}

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        try {
            if (request.signal.aborted) {
                return NextResponse.json({ error: "Upload cancelled." }, { status: 400 });
            }

        const formData = await request.formData();
        const file =
            (formData.get("file0") as File | null) ||
            (formData.get("file") as File | null);

        if (!file) {
            return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
        }
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
        }

        const maxBytes = getMaxFileSizeBytes();
        if (file.size > maxBytes) {
            return NextResponse.json(
                { error: `File too large. Max allowed is ${Math.round(maxBytes / 1024 / 1024)}MB.` },
                { status: 413 },
            );
        }

        // Read file bytes
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = Buffer.from(arrayBuffer);

        // Convert via image-based engine (pdftoppm + pptxgenjs)
        const result = await convertPdfToPptx({
            originalName: file.name,
            pdfBytes,
        });

        const headers = new Headers();
        headers.set("Content-Type", result.contentType);
        headers.set("Content-Disposition", `attachment; filename="${result.fileName}"`);
        headers.set("Cache-Control", "no-store, max-age=0");
        headers.set("Content-Length", result.pptxBuffer.length.toString());
        // Metadata headers
        headers.set("X-Conversion-Engine", result.engine);
        headers.set("X-Quality-Score", String(result.validation.score));
        headers.set("X-Total-Slides", String(result.slideCount));
        headers.set("X-Has-Images", String(result.hasImages));
        headers.set("X-Has-Backgrounds", String(result.hasBackgrounds));
        headers.set("X-Image-Count", String(result.imageCount));
        headers.set("X-Elapsed-Ms", String(result.elapsed));
        if (result.warnings.length > 0) {
            headers.set("X-Warnings", result.warnings.join(" | "));
        }

        return new NextResponse(new Uint8Array(result.pptxBuffer), { status: 200, headers });
        } catch (error) {
            if (error instanceof PdfToPptxError) {
                return NextResponse.json({ error: error.message }, { status: error.status });
            }
            if ((error as any)?.name === "AbortError") {
                return NextResponse.json({ error: "Conversion cancelled." }, { status: 400 });
            }
            console.error("[PDF-TO-PPT] Error:", error);
            return NextResponse.json(
                { error: `Failed to convert PDF to PPTX: ${error instanceof Error ? error.message : "Unknown error"}` },
                { status: 500 },
            );
        }
    });
}
