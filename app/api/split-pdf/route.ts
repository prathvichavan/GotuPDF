import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { withUsageLimit } from "@/lib/usageLimiter";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
    let tempFiles: string[] = [];

    try {
        const formData = await request.formData();
        const file = formData.get("file0") as File;
        const splitType = formData.get("splitType") as string || "individual"; // individual, range, custom
        const pageRanges = formData.get("pageRanges") as string || ""; // e.g., "1-3,5,7-9"

        if (!file) {
            return NextResponse.json(
                { error: "Please upload a PDF file" },
                { status: 400 }
            );
        }

        // Load the PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();

        // Parse page ranges based on split type
        let ranges: number[][] = [];

        switch (splitType) {
            case "individual":
                // Split each page individually
                ranges = Array.from({ length: totalPages }, (_, i) => [i + 1]);
                break;

            case "range":
                // Split into equal ranges (e.g., every 10 pages)
                const pagesPerSplit = parseInt(formData.get("pagesPerSplit") as string) || 10;
                for (let i = 1; i <= totalPages; i += pagesPerSplit) {
                    const end = Math.min(i + pagesPerSplit - 1, totalPages);
                    ranges.push(Array.from({ length: end - i + 1 }, (_, j) => i + j));
                }
                break;

            case "custom":
                // Parse custom ranges like "1-3,5,7-9"
                ranges = parsePageRanges(pageRanges, totalPages);
                if (ranges.length === 0) {
                    return NextResponse.json(
                        { error: "Invalid page ranges. Use format like '1-3,5,7-9'" },
                        { status: 400 }
                    );
                }
                break;

            default:
                return NextResponse.json(
                    { error: "Invalid split type" },
                    { status: 400 }
                );
        }

        // Create ZIP file
        const zip = new JSZip();
        const baseFileName = getFileNameWithoutExtension(file.name);

        // Generate split PDFs
        for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            const splitPdf = await PDFDocument.create();

            // Convert to 0-based indices
            const pageIndices = range.map(p => p - 1);
            const pages = await splitPdf.copyPages(pdfDoc, pageIndices);
            pages.forEach(page => splitPdf.addPage(page));

            const splitPdfBytes = await splitPdf.save();
            const fileName = ranges.length === 1
                ? `${baseFileName}_pages_${range.join('-')}.pdf`
                : `${baseFileName}_part_${i + 1}.pdf`;

            zip.file(fileName, splitPdfBytes);

            // Validate each split PDF
            if (splitPdfBytes.length < 100) {
                throw new Error(`Generated split PDF ${fileName} is invalid`);
            }

            // Verify PDF can be loaded back
            try {
                await PDFDocument.load(splitPdfBytes);
            } catch (validationError) {
                throw new Error(`Generated split PDF ${fileName} is corrupted`);
            }
        }

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({
            type: "uint8array",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });

        // Validate ZIP file
        if (zipBlob.length < 100) {
            throw new Error("Generated ZIP file is invalid");
        }

        // Return the ZIP file
        const response = new NextResponse(Buffer.from(zipBlob), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename=${baseFileName}_split.zip`,
                "X-Total-Pages": totalPages.toString(),
                "X-Split-Count": ranges.length.toString(),
            },
        });

        return response;

    } catch (error) {
        console.error("Error splitting PDF:", error);
        return NextResponse.json(
            { error: `Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    } finally {
        // Cleanup temp files
        for (const tempFile of tempFiles) {
            try {
                await fs.unlink(tempFile);
            } catch (e) {
                console.warn(`Failed to cleanup temp file: ${tempFile}`);
            }
        }
    }
    });
}

/**
 * Parse page ranges from string like "1-3,5,7-9"
 */
function parsePageRanges(rangeStr: string, totalPages: number): number[][] {
    const ranges: number[][] = [];

    if (!rangeStr.trim()) {
        return ranges;
    }

    const parts = rangeStr.split(',').map(p => p.trim());

    for (const part of parts) {
        if (part.includes('-')) {
            // Handle range like "1-3"
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
            if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                continue; // Skip invalid ranges
            }
            ranges.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
        } else {
            // Handle single page like "5"
            const page = parseInt(part);
            if (!isNaN(page) && page >= 1 && page <= totalPages) {
                ranges.push([page]);
            }
        }
    }

    return ranges;
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, "");
}

