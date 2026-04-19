import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

interface RedactArea {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
    try {
        const formData = await req.formData();
        const file = formData.get("file0") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const areasJson = formData.get("areas") as string;
        if (!areasJson) {
            return NextResponse.json({ error: "No redaction areas provided" }, { status: 400 });
        }

        let areas: RedactArea[];
        try {
            areas = JSON.parse(areasJson);
        } catch {
            return NextResponse.json({ error: "Invalid redaction areas format" }, { status: 400 });
        }

        if (!Array.isArray(areas) || areas.length === 0) {
            return NextResponse.json({ error: "At least one redaction area is required" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const totalPages = pages.length;

        // Draw black rectangles over each redaction area
        for (const area of areas) {
            const pageIndex = area.page - 1;
            if (pageIndex < 0 || pageIndex >= totalPages) continue;

            const page = pages[pageIndex];
            const { height: pageHeight } = page.getSize();

            page.drawRectangle({
                x: area.x,
                y: pageHeight - area.y - area.height,
                width: area.width,
                height: area.height,
                color: rgb(0, 0, 0),
                opacity: 1,
            });
        }

        const resultBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(resultBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="redacted.pdf"`,
                "X-Total-Pages": String(totalPages),
                "X-Areas-Redacted": String(areas.length),
            },
        });
    } catch (error: any) {
        console.error("Redact PDF error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to redact PDF" },
            { status: 500 }
        );
    }
    });
}
