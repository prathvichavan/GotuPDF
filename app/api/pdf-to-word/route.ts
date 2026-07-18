import { NextRequest, NextResponse } from "next/server";
import { convertPdfToWord, WordComError } from "@/lib/wordComEngine";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    try {
        if (process.env.VERCEL === "1" || process.platform !== "win32") {
            return NextResponse.json(
                { error: "PDF-to-Word requires Microsoft Word on a Windows server. This feature cannot run on Vercel." },
                { status: 501 },
            );
        }

        const formData = await request.formData();

        // Accept multiple field names for the file
        const file = (formData.get("file0") || formData.get("file")) as File | null;
        if (!file || typeof file === "string") {
            return NextResponse.json(
                { error: "Please upload a PDF file." },
                { status: 400 },
            );
        }

        if (file.size > 100 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File size exceeds 100 MB limit." },
                { status: 400 },
            );
        }

        const pdfBytes = Buffer.from(await file.arrayBuffer());

        console.log(`[pdf-to-word] Converting: ${file.name} (${pdfBytes.length} bytes)`);

        const result = await convertPdfToWord({
            originalName: file.name,
            pdfBytes,
        });

        console.log(
            `[pdf-to-word] Done: engine=${result.engine}, pages=${result.pageCount}, ` +
            `images=${result.imageCount}, tables=${result.tableCount}, ` +
            `watermark=${result.hasWatermark}, size=${result.docxBuffer.length}, ` +
            `validation=${result.validation.passed ? "PASS" : "WARN"}, ` +
            `score=${result.validation.score}/100, elapsed=${result.elapsed}ms`,
        );

        const headers = new Headers();
        headers.set("Content-Type", result.contentType);
        headers.set(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(result.fileName)}"`,
        );
        headers.set("Content-Length", result.docxBuffer.length.toString());
        headers.set("Cache-Control", "no-store, max-age=0");
        headers.set("X-Original-Pages", result.pageCount.toString());
        headers.set("X-Conversion-Engine", result.engine);
        headers.set("X-Validation-Passed", result.validation.passed ? "true" : "false");
        headers.set("X-Quality-Score", result.validation.score.toString());
        headers.set("X-Image-Count", result.imageCount.toString());
        headers.set("X-Table-Count", result.tableCount.toString());
        headers.set("X-Has-Watermark", result.hasWatermark ? "true" : "false");
        headers.set("X-Has-Headers", result.hasHeaders ? "true" : "false");
        headers.set("X-Has-Footers", result.hasFooters ? "true" : "false");
        headers.set("X-Elapsed-Ms", result.elapsed.toString());
        if (result.warnings.length > 0) {
            headers.set("X-Conversion-Warnings", result.warnings.join("; "));
        }
        if (result.validation.details.length > 0) {
            headers.set("X-Validation-Details", result.validation.details.join("; "));
        }

        return new NextResponse(new Uint8Array(result.docxBuffer), {
            status: 200,
            headers,
        });
    } catch (error) {
        if (error instanceof WordComError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }
        console.error("[pdf-to-word] Unexpected error:", error);
        return NextResponse.json(
            {
                error: `Conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
            { status: 500 },
        );
    }
    });
}

