import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    try {
        const formData = await request.formData();
        const file = formData.get("file0") as File;
        const newOrder = formData.get("newOrder") as string; // comma-separated page numbers like "3,1,2,4"

        if (!file) {
            return NextResponse.json(
                { error: "Please upload a PDF file" },
                { status: 400 }
            );
        }

        if (!newOrder) {
            return NextResponse.json(
                { error: "Please specify the new page order" },
                { status: 400 }
            );
        }

        // Load the PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();

        // Parse new order
        const orderArray = newOrder.split(',').map(n => parseInt(n.trim()) - 1); // Convert to 0-based

        // Validate order
        if (orderArray.length !== totalPages) {
            return NextResponse.json(
                { error: `Order must contain exactly ${totalPages} page numbers` },
                { status: 400 }
            );
        }

        // Check for duplicates and invalid page numbers
        const seen = new Set<number>();
        for (const pageIndex of orderArray) {
            if (pageIndex < 0 || pageIndex >= totalPages) {
                return NextResponse.json(
                    { error: `Invalid page number: ${pageIndex + 1}` },
                    { status: 400 }
                );
            }
            if (seen.has(pageIndex)) {
                return NextResponse.json(
                    { error: `Duplicate page number: ${pageIndex + 1}` },
                    { status: 400 }
                );
            }
            seen.add(pageIndex);
        }

        // Create new PDF with reordered pages
        const newPdf = await PDFDocument.create();

        // Add pages in the new order
        for (const pageIndex of orderArray) {
            const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
            newPdf.addPage(copiedPage);
        }

        // Save the reordered PDF
        const reorderedPdfBytes = await newPdf.save();

        // Validate output
        if (reorderedPdfBytes.length < 1000) {
            throw new Error("Generated PDF is invalid");
        }

        // Verify PDF can be loaded back
        try {
            await PDFDocument.load(reorderedPdfBytes);
        } catch (validationError) {
            throw new Error("Generated PDF is corrupted");
        }

        // Return the reordered PDF
        const response = new NextResponse(Buffer.from(reorderedPdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename=${getFileNameWithoutExtension(file.name)}_reordered.pdf`,
                "X-Total-Pages": totalPages.toString(),
                "X-New-Order": newOrder,
            },
        });

        return response;

    } catch (error) {
        console.error("Error reordering PDF:", error);
        return NextResponse.json(
            { error: `Failed to reorder PDF: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
    });
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, "");
}

