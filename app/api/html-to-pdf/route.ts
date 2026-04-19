import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { withUsageLimit } from "@/lib/usageLimiter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    return withUsageLimit(req, async () => {
        try {
        const formData = await req.formData();
        const htmlContent = formData.get("html") as string;

        if (!htmlContent || htmlContent.trim().length === 0) {
            return NextResponse.json({ error: "No HTML content provided" }, { status: 400 });
        }

        const pageSize = (formData.get("pageSize") as string) || "A4";
        const marginVal = parseInt(formData.get("margin") as string) || 40;

        // Page dimensions (in points)
        const sizes: Record<string, [number, number]> = {
            A4: [595.28, 841.89],
            Letter: [612, 792],
            Legal: [612, 1008],
        };
        const [pageWidth, pageHeight] = sizes[pageSize] || sizes.A4;

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Strip HTML tags and convert to plain text (preserving structure)
        const lines = htmlToTextLines(htmlContent);

        const textSize = 11;
        const lineHeight = textSize + 6;
        const maxWidth = pageWidth - marginVal * 2;

        let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        let yPos = pageHeight - marginVal;

        for (const line of lines) {
            // Check if we need a new page
            if (yPos < marginVal + lineHeight) {
                currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                yPos = pageHeight - marginVal;
            }

            if (line.type === "heading") {
                const headingSize = line.level === 1 ? 22 : line.level === 2 ? 18 : 14;
                yPos -= headingSize * 0.5;
                if (yPos < marginVal + headingSize) {
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPos = pageHeight - marginVal;
                }
                currentPage.drawText(line.text, {
                    x: marginVal,
                    y: yPos,
                    size: headingSize,
                    font: boldFont,
                    color: rgb(0, 0, 0),
                });
                yPos -= headingSize + 8;
            } else if (line.type === "empty") {
                yPos -= lineHeight * 0.5;
            } else {
                // Wrap text
                const words = line.text.split(/\s+/);
                let currentLine = "";
                for (const word of words) {
                    const testLine = currentLine ? currentLine + " " + word : word;
                    const testWidth = font.widthOfTextAtSize(testLine, textSize);
                    if (testWidth > maxWidth && currentLine) {
                        if (yPos < marginVal) {
                            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                            yPos = pageHeight - marginVal;
                        }
                        currentPage.drawText(currentLine, {
                            x: marginVal,
                            y: yPos,
                            size: textSize,
                            font,
                            color: rgb(0, 0, 0),
                        });
                        yPos -= lineHeight;
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine) {
                    if (yPos < marginVal) {
                        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
                        yPos = pageHeight - marginVal;
                    }
                    currentPage.drawText(currentLine, {
                        x: marginVal,
                        y: yPos,
                        size: textSize,
                        font,
                        color: rgb(0, 0, 0),
                    });
                    yPos -= lineHeight;
                }
            }
        }

        const pdfBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="converted.pdf"`,
                "X-Total-Pages": String(pdfDoc.getPageCount()),
            },
        });
        } catch (error: any) {
            console.error("HTML to PDF error:", error);
            return NextResponse.json(
                { error: error?.message || "Failed to convert HTML to PDF" },
                { status: 500 }
            );
        }
    });
}

interface TextLine {
    type: "text" | "heading" | "empty";
    text: string;
    level?: number;
}

function htmlToTextLines(html: string): TextLine[] {
    const lines: TextLine[] = [];

    // Replace common HTML entities
    let text = html
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

    // Process headings
    text = text.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_, level, content) => {
        return `\n__HEADING_${level}__${stripTags(content)}\n`;
    });

    // Replace block elements with newlines
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/?(p|div|tr|li|blockquote|section|article|aside|header|footer|main|nav)[^>]*>/gi, "\n");
    text = text.replace(/<\/?(ul|ol|dl|table|thead|tbody|tfoot)[^>]*>/gi, "\n");

    // Replace <td>/<th> with tabs
    text = text.replace(/<\/?(td|th)[^>]*>/gi, "\t");

    // Strip remaining tags
    text = stripTags(text);

    // Parse into structured lines
    const rawLines = text.split("\n");
    for (const rawLine of rawLines) {
        const trimmed = rawLine.trim();
        if (!trimmed) {
            lines.push({ type: "empty", text: "" });
            continue;
        }

        const headingMatch = trimmed.match(/^__HEADING_(\d)__(.*)$/);
        if (headingMatch) {
            lines.push({ type: "heading", text: headingMatch[2].trim(), level: parseInt(headingMatch[1]) });
        } else {
            lines.push({ type: "text", text: trimmed });
        }
    }

    return lines;
}

function stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, "");
}
