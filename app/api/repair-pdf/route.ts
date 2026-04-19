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

        const bytes = await file.arrayBuffer();

        // Attempt to load the PDF with lenient options and re-save it.
        // pdf-lib will drop broken xref entries, rebuild the page tree, etc.
        const pdfDoc = await PDFDocument.load(bytes, {
            ignoreEncryption: true,
            updateMetadata: true,
            throwOnInvalidObject: false,
        } as any);

        // Rebuild: strip broken annotations by re-serializing
        const pageCount = pdfDoc.getPageCount();

        // Update metadata to indicate repair
        pdfDoc.setCreator("GotuPDF Repair Tool");

        const repairedBytes = await pdfDoc.save({
            useObjectStreams: false,   // Maximum compatibility
            addDefaultPage: false,
        });

        return new NextResponse(Buffer.from(repairedBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="repaired.pdf"`,
                "X-Total-Pages": String(pageCount),
            },
        });
    } catch (error: any) {
        console.error("Repair PDF error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to repair PDF" },
            { status: 500 }
        );
    }
    });
}
