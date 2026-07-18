import { NextRequest, NextResponse } from "next/server";
import { convertWordToPdf, WordComError } from "@/lib/wordComEngine";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        try {
        if (process.env.VERCEL === "1" || process.platform !== "win32") {
            return NextResponse.json(
                { error: "Word-to-PDF requires Microsoft Word on a Windows server. This feature cannot run on Vercel." },
                { status: 501 },
            );
        }

        const formData = await request.formData();
        const file = formData.get("file0") as File;

        if (!file) {
            return NextResponse.json(
                { error: "Please upload a Word document" },
                { status: 400 },
            );
        }

        // Validate file type
        const fileName = file.name.toLowerCase();
        const allowedTypes = [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "application/rtf",
        ];
        const hasValidExtension = fileName.endsWith(".doc") || fileName.endsWith(".docx") || fileName.endsWith(".rtf");
        const hasValidMimeType = allowedTypes.includes(file.type);

        if (!hasValidExtension && !hasValidMimeType) {
            return NextResponse.json(
                { error: "Please upload a valid Word document (.doc, .docx, or .rtf)" },
                { status: 400 },
            );
        }

        if (file.size > 100 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File size exceeds 100 MB limit." },
                { status: 400 },
            );
        }

        const docBytes = Buffer.from(await file.arrayBuffer());

        console.log(`[word-to-pdf] Converting: ${file.name} (${docBytes.length} bytes)`);

        const result = await convertWordToPdf({
            originalName: file.name,
            docBytes,
        });

        console.log(
            `[word-to-pdf] Done: engine=${result.engine}, pages=${result.pageCount}, ` +
            `size=${result.pdfBuffer.length}, validation=${result.validation.passed ? "PASS" : "WARN"}, ` +
            `score=${result.validation.score}/100, elapsed=${result.elapsed}ms`,
        );

        const headers = new Headers();
        headers.set("Content-Type", result.contentType);
        headers.set(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(result.fileName)}"`,
        );
        headers.set("Content-Length", result.pdfBuffer.length.toString());
        headers.set("Cache-Control", "no-store, max-age=0");
        headers.set("X-Conversion-Engine", result.engine);
        headers.set("X-Total-Pages", result.pageCount.toString());
        headers.set("X-Validation-Passed", result.validation.passed ? "true" : "false");
        headers.set("X-Quality-Score", result.validation.score.toString());
        headers.set("X-Elapsed-Ms", result.elapsed.toString());
        if (result.warnings.length > 0) {
            headers.set("X-Conversion-Warnings", result.warnings.join("; "));
        }
        if (result.validation.details.length > 0) {
            headers.set("X-Validation-Details", result.validation.details.join("; "));
        }

        return new NextResponse(new Uint8Array(result.pdfBuffer), {
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
            console.error("[word-to-pdf] Unexpected error:", error);
            return NextResponse.json(
                {
                    error: `Failed to convert Word to PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
                },
                { status: 500 },
            );
        }
    });
}