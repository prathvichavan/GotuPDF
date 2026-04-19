import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, degrees } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
    try {
        const formData = await req.formData();
        const file = formData.get("file0") as File | null;
        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        const sigFile = formData.get("signature") as File | null;
        if (!sigFile) return NextResponse.json({ error: "No signature image provided" }, { status: 400 });

        const pagesRaw = (formData.get("pages") as string) || "1";
        const x = parseFloat(formData.get("x") as string) || 50;
        const y = parseFloat(formData.get("y") as string) || 50;
        const sigWidth = parseFloat(formData.get("width") as string) || 200;
        const sigHeight = parseFloat(formData.get("height") as string) || 80;
        const rot = parseFloat(formData.get("rotation") as string) || 0;
        const sigOpacity = parseFloat(formData.get("opacity") as string);
        const opacityVal = Number.isFinite(sigOpacity) ? sigOpacity : 1;

        const pdfBytes = await file.arrayBuffer();
        const sigBytes = await sigFile.arrayBuffer();
        const sigUint8 = new Uint8Array(sigBytes);

        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const totalPages = pages.length;

        // Embed signature image
        let embeddedImage;
        if (isPng(sigUint8) || sigFile.type?.includes("png")) {
            embeddedImage = await pdfDoc.embedPng(sigBytes);
        } else {
            embeddedImage = await pdfDoc.embedJpg(sigBytes);
        }

        // Parse target pages (comma-separated or "all")
        const targetPages = parsePageList(pagesRaw, totalPages);

        for (const pageIdx of targetPages) {
            if (pageIdx < 0 || pageIdx >= totalPages) continue;
            const page = pages[pageIdx];
            const { height: pageHeight } = page.getSize();

            page.drawImage(embeddedImage, {
                x,
                y: pageHeight - y - sigHeight,
                width: sigWidth,
                height: sigHeight,
                rotate: degrees(rot),
                opacity: opacityVal,
            });
        }

        const resultBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(resultBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="signed.pdf"`,
                "X-Total-Pages": String(totalPages),
            },
        });
    } catch (error: any) {
        console.error("Sign PDF error:", error);
        return NextResponse.json({ error: error?.message || "Failed to sign PDF" }, { status: 500 });
    }
    });
}

function isPng(bytes: Uint8Array): boolean {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function parsePageList(raw: string, total: number): number[] {
    if (raw.trim().toLowerCase() === "all") {
        return Array.from({ length: total }, (_, i) => i);
    }
    const result = new Set<number>();
    for (const part of raw.split(",")) {
        const trimmed = part.trim();
        const num = parseInt(trimmed, 10);
        if (Number.isFinite(num) && num >= 1 && num <= total) {
            result.add(num - 1); // 0-indexed
        }
    }
    return [...result];
}
