import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        try {
        const formData = await request.formData();
        const files: File[] = [];

        // Collect all uploaded files
        for (const [key, value] of formData.entries()) {
            if (key.startsWith("file") && value instanceof File) {
                files.push(value);
            }
        }

        if (files.length === 0) {
            return NextResponse.json(
                { error: "Please upload at least one JPG image" },
                { status: 400 }
            );
        }

        // Get page size preference
        const pageSizeMode = formData.get("pageSize") as string || "fit"; // "fit", "a4", "letter"

        // Define standard page sizes (in points: 1 inch = 72 points)
        const pageSizes: Record<string, [number, number]> = {
            a4: [595.28, 841.89],      // A4: 210mm x 297mm
            letter: [612, 792],         // Letter: 8.5" x 11"
        };

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Process each image file
        for (const file of files) {
            const imageBytes = await file.arrayBuffer();

            // Embed the image (supports both JPG and PNG)
            let image;
            if (file.type === "image/jpeg" || file.type === "image/jpg") {
                image = await pdfDoc.embedJpg(imageBytes);
            } else if (file.type === "image/png") {
                image = await pdfDoc.embedPng(imageBytes);
            } else {
                continue; // Skip unsupported formats
            }

            // Determine page size
            let pageWidth: number, pageHeight: number;

            if (pageSizeMode === "fit") {
                // Create page matching image size
                pageWidth = image.width;
                pageHeight = image.height;
            } else {
                // Use standard page size
                const [stdWidth, stdHeight] = pageSizes[pageSizeMode] || pageSizes.a4;
                pageWidth = stdWidth;
                pageHeight = stdHeight;
            }

            const page = pdfDoc.addPage([pageWidth, pageHeight]);

            // Calculate scaling to fit image on page while maintaining aspect ratio
            const imageAspect = image.width / image.height;
            const pageAspect = pageWidth / pageHeight;

            let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

            if (pageSizeMode === "fit") {
                // Exact fit
                drawWidth = image.width;
                drawHeight = image.height;
                drawX = 0;
                drawY = 0;
            } else {
                // Fit to page with margins
                const margin = 36; // 0.5 inch margin
                const availableWidth = pageWidth - (margin * 2);
                const availableHeight = pageHeight - (margin * 2);

                if (imageAspect > pageAspect) {
                    // Image is wider - fit to width
                    drawWidth = availableWidth;
                    drawHeight = availableWidth / imageAspect;
                } else {
                    // Image is taller - fit to height
                    drawHeight = availableHeight;
                    drawWidth = availableHeight * imageAspect;
                }

                // Center the image
                drawX = (pageWidth - drawWidth) / 2;
                drawY = (pageHeight - drawHeight) / 2;
            }

            // Draw the image on the page
            page.drawImage(image, {
                x: drawX,
                y: drawY,
                width: drawWidth,
                height: drawHeight,
            });
        }

        // Save the PDF
        const pdfBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=converted.pdf",
            },
        });
        } catch (error) {
            console.error("Error converting JPG to PDF:", error);
            return NextResponse.json(
                { error: "Failed to convert images to PDF" },
                { status: 500 }
            );
        }
    });
}

