import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    try {
        const formData = await request.formData();
        const file = formData.get("file0") as File;
        const pagesToRemoveStr = formData.get("pages") as string;

        if (!file) {
            return NextResponse.json({ error: "Please upload a PDF file" }, { status: 400 });
        }

        if (!pagesToRemoveStr) {
            return NextResponse.json({ error: "Please specify pages to remove" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const totalPages = pdfDoc.getPageCount();

        // Parse pages to remove (1-indexed from client)
        const pagesToRemove = new Set<number>();
        const parts = pagesToRemoveStr.split(",").map((s) => s.trim());
        for (const part of parts) {
            if (part.includes("-")) {
                const [startStr, endStr] = part.split("-").map((s) => s.trim());
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (isNaN(start) || isNaN(end)) continue;
                for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
                    pagesToRemove.add(i);
                }
            } else {
                const pageNum = parseInt(part, 10);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    pagesToRemove.add(pageNum);
                }
            }
        }

        if (pagesToRemove.size === 0) {
            return NextResponse.json({ error: "No valid pages specified for removal" }, { status: 400 });
        }

        if (pagesToRemove.size >= totalPages) {
            return NextResponse.json({ error: "Cannot remove all pages from the PDF" }, { status: 400 });
        }

        // Build list of pages to KEEP (0-indexed)
        const pagesToKeep: number[] = [];
        for (let i = 0; i < totalPages; i++) {
            if (!pagesToRemove.has(i + 1)) {
                pagesToKeep.push(i);
            }
        }

        // Create new PDF with only kept pages
        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, pagesToKeep);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="pages-removed.pdf"`,
                "X-Pages-Removed": pagesToRemove.size.toString(),
                "X-Pages-Remaining": pagesToKeep.length.toString(),
            },
        });
    } catch (error: any) {
        console.error("Error removing pages:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to remove pages from PDF" },
            { status: 500 }
        );
    }
    });
}
