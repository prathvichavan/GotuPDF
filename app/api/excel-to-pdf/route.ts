import { NextRequest, NextResponse } from "next/server";
import { PDFDocument as PDFLibDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { withUsageLimit } from "@/lib/usageLimiter";

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        try {
        const formData = await request.formData();
        const file = formData.get("file0") as File;

        if (!file) {
            return NextResponse.json(
                { error: "Please upload an Excel file" },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
            'text/csv', // .csv
            'application/csv', // .csv (alternative mime type)
        ];

        const isValidExtension = file.name.match(/\.(xlsx|xls|xlsm|csv)$/i);
        const isValidMimeType = allowedTypes.includes(file.type);

        if (!isValidMimeType && !isValidExtension) {
            return NextResponse.json(
                { error: "Please upload a valid Excel file (.xls, .xlsx) or CSV file (.csv)" },
                { status: 400 }
            );
        }

        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let fileContent: string | Buffer = buffer;

        // For CSV files, read as text with UTF-8 encoding to handle special characters
        if (file.name.toLowerCase().endsWith('.csv')) {
            fileContent = new TextDecoder('utf-8').decode(arrayBuffer);
        }

        // Parse Excel/CSV file
        const workbook = XLSX.read(fileContent, { type: file.name.toLowerCase().endsWith('.csv') ? 'string' : 'buffer' });
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
            throw new Error("No worksheets or data found in the file");
        }

        // Create PDF from Excel/CSV data
        const pdfBuffer = await createPDFFromExcel(workbook, getFileNameWithoutExtension(file.name));

        // Validate the output
        if (pdfBuffer.length < 1000) {
            throw new Error("Generated PDF is too small or invalid");
        }

        // Verify PDF can be loaded back
        try {
            await PDFLibDocument.load(pdfBuffer);
        } catch (validationError) {
            throw new Error("Generated PDF is corrupted and cannot be validated");
        }

        // Return the PDF
        const response = new NextResponse(Buffer.from(pdfBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename=${getFileNameWithoutExtension(file.name)}.pdf`,
                "X-Original-Format": file.type,
                "X-Sheets-Count": sheetNames.length.toString(),
                "X-Conversion-Type": "excel-to-pdf",
            },
        });

            return response;

        } catch (error) {
            console.error("Error converting file to PDF:", error);
            return NextResponse.json(
                { error: `Failed to convert file to PDF: ${error instanceof Error ? error.message : 'Unknown error'}` },
                { status: 500 }
            );
        }
    });
}

/**
 * Sanitize text to handle Unicode characters that WinAnsi font doesn't support
 */
function sanitizeTextForPDF(text: string): string {
    if (!text) return text;
    
    // Replace common special currency symbols
    let sanitized = text
        .replace(/₹/g, 'Rs.') // Indian Rupee
        .replace(/€/g, 'EUR ') // Euro
        .replace(/¥/g, 'JPY ') // Yen
        .replace(/£/g, 'GBP ') // Pound
        .replace(/¢/g, 'c') // Cent
        .replace(/₱/g, 'PHP ') // Philippine Peso
        .replace(/₦/g, 'NGN ') // Nigerian Naira
        .replace(/₨/g, 'Rs.') // Generic Rupee
        .replace(/₩/g, 'KRW ') // Won
        .replace(/₪/g, 'ILS ') // Shekel
        .replace(/₫/g, 'VND ') // Vietnamese Dong
        .replace(/₱/g, 'P') // Peso
        .replace(/[^\x20-\x7E]/g, '?'); // Replace other non-ASCII chars with ?
    
    return sanitized;
}

/**
 * Create PDF from Excel workbook using pdf-lib
 */
async function createPDFFromExcel(workbook: XLSX.WorkBook, title: string): Promise<Buffer> {
    const pdfDoc = await PDFLibDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595; // A4 width
    const pageHeight = 842; // A4 height
    const margin = 50;
    const contentWidth = pageWidth - 2 * margin;

    // Start first page
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Process each worksheet
    for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
        const sheetName = workbook.SheetNames[sheetIndex];
        const worksheet = workbook.Sheets[sheetName];

        // Add new page for each sheet (except first)
        if (sheetIndex > 0) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
        }

        // Sheet title
        page.drawText(sanitizeTextForPDF(`${sheetName}`), {
            x: margin,
            y: yPosition,
            size: 16,
            font: helveticaBold,
            color: rgb(0.1, 0.1, 0.1)
        });
        yPosition -= 35;

        // Convert sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false
        }) as any[][];

        if (jsonData.length === 0) {
            page.drawText(sanitizeTextForPDF('(Empty sheet)'), {
                x: margin,
                y: yPosition,
                size: 12,
                font: helvetica,
                color: rgb(0.5, 0.5, 0.5)
            });
            yPosition -= 40;
            continue;
        }

        // Calculate column widths
        const maxCols = Math.max(...jsonData.map(row => row.length));
        const colWidth = Math.min(80, contentWidth / maxCols);

        // Draw table
        const fontSize = 8;
        const lineHeight = 16;

        for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
            const row = jsonData[rowIndex];

            // Check if we need a new page
            if (yPosition < margin + 50) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = pageHeight - margin;

                // Add continuation header
                page.drawText(sanitizeTextForPDF(`${sheetName} (continued)`), {
                    x: margin,
                    y: yPosition,
                    size: 14,
                    font: helveticaBold,
                    color: rgb(0.1, 0.1, 0.1)
                });
                yPosition -= 30;
            }

            // Draw row - each cell in its own column
            for (let colIndex = 0; colIndex < maxCols; colIndex++) {
                const cellValue = row[colIndex] !== undefined ? String(row[colIndex]) : '';
                // Sanitize and truncate based on column width
                const sanitized = sanitizeTextForPDF(cellValue);
                const maxChars = Math.floor(colWidth / 4);
                const truncated = sanitized.length > maxChars ? sanitized.substring(0, maxChars - 3) + '...' : sanitized;

                const x = margin + (colIndex * colWidth);
                const font = rowIndex === 0 ? helveticaBold : helvetica;

                page.drawText(truncated, {
                    x: x,
                    y: yPosition,
                    size: fontSize,
                    font: font,
                    color: rgb(0.1, 0.1, 0.1),
                    maxWidth: colWidth - 2
                });
            }

            yPosition -= lineHeight;

            // Draw separator line after header
            if (rowIndex === 0) {
                page.drawLine({
                    start: { x: margin, y: yPosition + 5 },
                    end: { x: pageWidth - margin, y: yPosition + 5 },
                    thickness: 1,
                    color: rgb(0.8, 0.8, 0.8)
                });
                yPosition -= 5;
            }
        }

        yPosition -= 30;
    }

    // Add page numbers
    const pages = pdfDoc.getPages();
    pages.forEach((p, index) => {
        p.drawText(`Page ${index + 1} of ${pages.length}`, {
            x: pageWidth / 2 - 30,
            y: 30,
            size: 8,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5)
        });
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, "");
}

