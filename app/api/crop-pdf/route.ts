import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
    try {
        const formData = await req.formData();
        const file = formData.get("file0") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Crop margins in points (1 point = 1/72 inch)
        const top = parseFloat(formData.get("top") as string) || 0;
        const bottom = parseFloat(formData.get("bottom") as string) || 0;
        const left = parseFloat(formData.get("left") as string) || 0;
        const right = parseFloat(formData.get("right") as string) || 0;

        const bytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const totalPages = pages.length;

        pages.forEach((page) => {
            const { width, height } = page.getSize();
            // Set CropBox to trim the specified margins from each edge
            const newLeft = left;
            const newBottom = bottom;
            const newRight = width - right;
            const newTop = height - top;

            if (newRight <= newLeft || newTop <= newBottom) {
                // Skip pages where crop would be invalid
                return;
            }

            page.setCropBox(newLeft, newBottom, newRight - newLeft, newTop - newBottom);
        });

        const resultBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(resultBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="cropped.pdf"`,
                "X-Total-Pages": String(totalPages),
            },
        });
    } catch (error: any) {
        console.error("Crop PDF error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to crop PDF" },
            { status: 500 }
        );
    }
    });
}
