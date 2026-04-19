import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
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

        const mode = (formData.get("mode") as string) || "text"; // "text" | "image"
        const opacity = parseFloat(formData.get("opacity") as string) || 0.15;
        const rotation = parseInt(formData.get("rotation") as string) || 0;
        const position = (formData.get("position") as string) || "center"; // center|tile|top-left|top-right|bottom-left|bottom-right

        const pdfBytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const totalPages = pages.length;

        if (mode === "image") {
            /* ============================================================ */
            /*  IMAGE / LOGO WATERMARK                                       */
            /* ============================================================ */
            const imageFile = formData.get("image") as File | null;
            if (!imageFile) {
                return NextResponse.json({ error: "No watermark image provided" }, { status: 400 });
            }

            const imgBytes = await imageFile.arrayBuffer();
            const imgType = imageFile.type || "";

            let embeddedImage;
            if (imgType.includes("png") || imageFile.name?.toLowerCase().endsWith(".png")) {
                embeddedImage = await pdfDoc.embedPng(imgBytes);
            } else {
                embeddedImage = await pdfDoc.embedJpg(imgBytes);
            }

            const imgW = parseFloat(formData.get("imgWidth") as string) || 200;
            const imgH = parseFloat(formData.get("imgHeight") as string) || (imgW * (embeddedImage.height / embeddedImage.width));
            const repeat = formData.get("repeat") === "true";

            for (const page of pages) {
                const { width: pw, height: ph } = page.getSize();

                if (repeat) {
                    // Tile the image across the page
                    const spacingX = imgW + 80;
                    const spacingY = imgH + 80;
                    for (let y = 20; y < ph; y += spacingY) {
                        for (let x = 20; x < pw; x += spacingX) {
                            page.drawImage(embeddedImage, {
                                x, y,
                                width: imgW, height: imgH,
                                opacity,
                                rotate: degrees(rotation),
                            });
                        }
                    }
                } else {
                    // Single placement based on position
                    const coords = getImagePosition(position, pw, ph, imgW, imgH);
                    page.drawImage(embeddedImage, {
                        x: coords.x, y: coords.y,
                        width: imgW, height: imgH,
                        opacity,
                        rotate: degrees(rotation),
                    });
                }
            }
        } else {
            /* ============================================================ */
            /*  TEXT WATERMARK                                                */
            /* ============================================================ */
            const text = (formData.get("text") as string) || "CONFIDENTIAL";
            const fontSize = parseInt(formData.get("fontSize") as string) || 48;
            const colorHex = (formData.get("color") as string) || "#888888";
            const fontFamily = (formData.get("fontFamily") as string) || "Helvetica-Bold";
            const repeat = formData.get("repeat") === "true";

            const r = parseInt(colorHex.slice(1, 3), 16) / 255;
            const g = parseInt(colorHex.slice(3, 5), 16) / 255;
            const b = parseInt(colorHex.slice(5, 7), 16) / 255;

            // Resolve font
            const fontKey = resolveFontKey(fontFamily);
            const font = await pdfDoc.embedFont(fontKey);

            for (const page of pages) {
                const { width: pw, height: ph } = page.getSize();
                const textWidth = font.widthOfTextAtSize(text, fontSize);

                if (repeat) {
                    // Tile text across the page
                    const spacingX = textWidth + 80;
                    const spacingY = fontSize + 80;
                    for (let y = 20; y < ph; y += spacingY) {
                        for (let x = 20; x < pw; x += spacingX) {
                            page.drawText(text, {
                                x, y,
                                size: fontSize, font,
                                color: rgb(r, g, b),
                                opacity,
                                rotate: degrees(rotation),
                            });
                        }
                    }
                } else {
                    // Single centered text
                    page.drawText(text, {
                        x: pw / 2 - textWidth / 2,
                        y: ph / 2,
                        size: fontSize, font,
                        color: rgb(r, g, b),
                        opacity,
                        rotate: degrees(rotation),
                    });
                }
            }
        }

        const resultBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(resultBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="watermarked.pdf"`,
                "X-Total-Pages": String(totalPages),
            },
        });
    } catch (error: any) {
        console.error("Add watermark error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to add watermark" },
            { status: 500 },
        );
    }
    });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getImagePosition(position: string, pw: number, ph: number, iw: number, ih: number) {
    switch (position) {
        case "top-left":      return { x: 20, y: ph - ih - 20 };
        case "top-right":     return { x: pw - iw - 20, y: ph - ih - 20 };
        case "bottom-left":   return { x: 20, y: 20 };
        case "bottom-right":  return { x: pw - iw - 20, y: 20 };
        case "center":
        default:              return { x: pw / 2 - iw / 2, y: ph / 2 - ih / 2 };
    }
}

function resolveFontKey(name: string): import("pdf-lib").StandardFonts {
    const n = name.toLowerCase();
    if (n.includes("courier") && n.includes("bold"))  return StandardFonts.CourierBold;
    if (n.includes("courier"))                          return StandardFonts.Courier;
    if (n.includes("times") && n.includes("bold"))     return StandardFonts.TimesRomanBold;
    if (n.includes("times") && n.includes("italic"))   return StandardFonts.TimesRomanItalic;
    if (n.includes("times"))                            return StandardFonts.TimesRoman;
    if (n.includes("bold") && n.includes("oblique"))   return StandardFonts.HelveticaBoldOblique;
    if (n.includes("bold"))                             return StandardFonts.HelveticaBold;
    if (n.includes("oblique") || n.includes("italic")) return StandardFonts.HelveticaOblique;
    return StandardFonts.HelveticaBold;
}
