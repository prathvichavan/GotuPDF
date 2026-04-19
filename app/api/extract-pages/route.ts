import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    try {
        const formData = await request.formData();
        const file = formData.get("file0") as File;
        const pagesToExtractStr = formData.get("pages") as string;

        if (!file) {
            return NextResponse.json({ error: "Please upload a PDF file" }, { status: 400 });
        }

        if (!pagesToExtractStr) {
            return NextResponse.json({ error: "Please specify pages to extract" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const totalPages = pdfDoc.getPageCount();

        // Parse pages to extract (1-indexed from client)
        const pagesToExtract = new Set<number>();
        const parts = pagesToExtractStr.split(",").map((s) => s.trim());
        for (const part of parts) {
            if (part.includes("-")) {
                const [startStr, endStr] = part.split("-").map((s) => s.trim());
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (isNaN(start) || isNaN(end)) continue;
                for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
                    pagesToExtract.add(i);
                }
            } else {
                const pageNum = parseInt(part, 10);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    pagesToExtract.add(pageNum);
                }
            }
        }

        if (pagesToExtract.size === 0) {
            return NextResponse.json({ error: "No valid pages specified for extraction" }, { status: 400 });
        }

        // Convert to sorted 0-indexed array
        const sortedPages = Array.from(pagesToExtract).sort((a, b) => a - b).map((p) => p - 1);

        // Create new PDF with only extracted pages
        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, sortedPages);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="extracted-pages.pdf"`,
                "X-Pages-Extracted": pagesToExtract.size.toString(),
            },
        });
    } catch (error: any) {
        console.error("Error extracting pages:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to extract pages from PDF" },
            { status: 500 }
        );
    }
    });
}
