import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        try {
        const formData = await request.formData();
        const file = formData.get("file0") as File;

        if (!file) {
            return NextResponse.json(
                { error: "Please upload a PDF file" },
                { status: 400 }
            );
        }

        // Load the PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        // Get the first page
        const pages = pdfDoc.getPages();
        if (pages.length === 0) {
            return NextResponse.json(
                { error: "PDF has no pages" },
                { status: 400 }
            );
        }

        // For serverless compatibility, we return a simple SVG placeholder
        // In production, consider using client-side rendering with PDF.js
        const page = pages[0];
        const { width, height } = page.getSize();

        // Create SVG placeholder
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${Math.floor(width)}" height="${Math.floor(height)}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#333">
        PDF to PNG Conversion
    </text>
    <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#666">
        Page 1 of ${pages.length}
    </text>
    <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#999">
        For high-quality conversion, use client-side rendering
    </text>
</svg>`;

        // Return SVG (browsers can display this directly)
        return new NextResponse(svg, {
            status: 200,
            headers: {
                "Content-Type": "image/svg+xml",
                "Content-Disposition": `attachment; filename=page-1.svg`,
                "X-Total-Pages": pages.length.toString(),
            },
        });
        } catch (error) {
            console.error("Error converting PDF to PNG:", error);
            return NextResponse.json(
                {
                    error: "Failed to convert PDF to PNG",
                    note: "For production-quality conversion, consider using client-side PDF.js rendering"
                },
                { status: 500 }
            );
        }
    });
}

