import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

type NumberPosition = "bottom-center" | "bottom-left" | "bottom-right" | "top-center" | "top-left" | "top-right";

export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
    try {
        const formData = await req.formData();
        const file = formData.get("file0") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const position = (formData.get("position") as NumberPosition) || "bottom-center";
        const startNumber = parseInt(formData.get("startNumber") as string) || 1;
        const fontSize = parseInt(formData.get("fontSize") as string) || 12;
        const margin = parseInt(formData.get("margin") as string) || 30;
        const format = (formData.get("format") as string) || "{n}";

        const bytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pages = pdfDoc.getPages();
        const totalPages = pages.length;

        pages.forEach((page, index) => {
            const pageNum = startNumber + index;
            const text = format
                .replace("{n}", String(pageNum))
                .replace("{total}", String(totalPages + startNumber - 1));

            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const { width, height } = page.getSize();

            let x = 0;
            let y = 0;

            // Horizontal
            if (position.includes("left")) {
                x = margin;
            } else if (position.includes("right")) {
                x = width - textWidth - margin;
            } else {
                x = (width - textWidth) / 2;
            }

            // Vertical
            if (position.startsWith("top")) {
                y = height - margin;
            } else {
                y = margin;
            }

            page.drawText(text, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
            });
        });

        const resultBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(resultBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="numbered.pdf"`,
                "X-Total-Pages": String(totalPages),
            },
        });
    } catch (error: any) {
        console.error("Add page numbers error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to add page numbers" },
            { status: 500 }
        );
    }
    });
}
