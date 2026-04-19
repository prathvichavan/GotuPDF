import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, degrees } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    try {
        const formData = await request.formData();
        const file = formData.get("file0") as File;
        const rotationAngle = parseInt(formData.get("rotationAngle") as string) || 90;
        const pageRange = formData.get("pageRange") as string || "all"; // "all", "1,3,5", "1-5"

        if (!file) {
            return NextResponse.json(
                { error: "Please upload a PDF file" },
                { status: 400 }
            );
        }

        // Validate rotation angle
        if (![90, 180, 270].includes(Math.abs(rotationAngle))) {
            return NextResponse.json(
                { error: "Rotation angle must be 90, 180, or 270 degrees" },
                { status: 400 }
            );
        }

        // Load the PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();

        // Parse page range
        const pagesToRotate = parsePageRange(pageRange, totalPages);
        if (pagesToRotate.length === 0) {
            return NextResponse.json(
                { error: "Invalid page range specified" },
                { status: 400 }
            );
        }

        // Rotate specified pages
        const pages = pdfDoc.getPages();
        pagesToRotate.forEach(pageIndex => {
            if (pageIndex < pages.length) {
                const page = pages[pageIndex];
                const currentRotation = page.getRotation().angle;
                page.setRotation(degrees(currentRotation + rotationAngle));
            }
        });

        // Save the rotated PDF
        const rotatedPdfBytes = await pdfDoc.save();

        // Validate output
        if (rotatedPdfBytes.length < 1000) {
            throw new Error("Generated PDF is invalid");
        }

        // Verify PDF can be loaded back
        try {
            await PDFDocument.load(rotatedPdfBytes);
        } catch (validationError) {
            throw new Error("Generated PDF is corrupted");
        }

        // Return the rotated PDF
        const response = new NextResponse(Buffer.from(rotatedPdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename=${getFileNameWithoutExtension(file.name)}_rotated.pdf`,
                "X-Total-Pages": totalPages.toString(),
                "X-Pages-Rotated": pagesToRotate.length.toString(),
                "X-Rotation-Angle": rotationAngle.toString(),
            },
        });

        return response;

    } catch (error) {
        console.error("Error rotating PDF:", error);
        return NextResponse.json(
            { error: `Failed to rotate PDF: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
    });
}

/**
 * Parse page range string into array of page indices (0-based)
 */
function parsePageRange(rangeStr: string, totalPages: number): number[] {
    const pages: number[] = [];

    if (rangeStr === "all") {
        return Array.from({ length: totalPages }, (_, i) => i);
    }

    const parts = rangeStr.split(',').map(p => p.trim());

    for (const part of parts) {
        if (part.includes('-')) {
            // Handle range like "1-3"
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
            if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                continue; // Skip invalid ranges
            }
            for (let i = start; i <= end; i++) {
                pages.push(i - 1); // Convert to 0-based
            }
        } else {
            // Handle single page like "5"
            const page = parseInt(part);
            if (!isNaN(page) && page >= 1 && page <= totalPages) {
                pages.push(page - 1); // Convert to 0-based
            }
        }
    }

    // Remove duplicates and sort
    return [...new Set(pages)].sort((a, b) => a - b);
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, "");
}

