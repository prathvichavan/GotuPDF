import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import { withUsageLimit } from "@/lib/usageLimiter";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
    return withUsageLimit(request, async () => {
        const startTime = Date.now();

        try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (file.type !== "application/pdf") {
            return NextResponse.json(
                { error: "Only PDF files are supported" },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    error: `File size must be less than 20MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
                },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const pdfBuffer = Buffer.from(await file.arrayBuffer());

        // Extract tables from PDF
        const { tables, pagesProcessed } = await extractTablesFromPDF(pdfBuffer);

        if (tables.length === 0) {
            return NextResponse.json(
                { error: "No tables found in PDF. Please try a different PDF with table data." },
                { status: 400 }
            );
        }

        // Create Excel workbook
        const workbook = XLSX.utils.book_new();
        let totalRowsExtracted = 0;

        // Add data sheets
        tables.forEach((table, index) => {
            const worksheet = XLSX.utils.aoa_to_sheet(table.data);

            // Auto-adjust column widths
            const colWidths: any[] = [];
            if (table.data.length > 0) {
                const maxColCount = Math.max(...table.data.map(row => row.length));
                for (let col = 0; col < maxColCount; col++) {
                    let maxWidth = 12;
                    for (let row = 0; row < table.data.length; row++) {
                        const cell = table.data[row][col];
                        if (cell) {
                            const cellStr = cell.toString();
                            maxWidth = Math.max(maxWidth, cellStr.length);
                        }
                    }
                    colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
                }
            }
            worksheet["!cols"] = colWidths;

            const sheetName = `Table_${index + 1}`;
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            totalRowsExtracted += table.data.length;
        });

        // Generate Excel buffer
        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        const processingTime = (Date.now() - startTime) / 1000;

        // Return the Excel file with metadata headers
        const response = new NextResponse(Buffer.from(excelBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="GotuPDF-${Date.now()}.xlsx"`,
                "x-tables-found": tables.length.toString(),
                "x-rows-extracted": totalRowsExtracted.toString(),
                "x-processing-time": processingTime.toString(),
                "x-pages-processed": pagesProcessed.toString(),
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        });

            return response;
        } catch (error) {
            console.error("Error converting PDF to Excel:", error);
            return NextResponse.json(
                {
                    error: `Failed to convert PDF to Excel: ${error instanceof Error ? error.message : "Unknown error"}`,
                },
                { status: 500 }
            );
        }
    });
}

/**
 * Extract tables from PDF using PDF.js
 */
async function extractTablesFromPDF(pdfBuffer: Buffer): Promise<{
    tables: Array<{ data: string[][] }>;
    pagesProcessed: number;
}> {
    const data = new Uint8Array(pdfBuffer);
        const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    const tables: Array<{ data: string[][] }> = [];
    let pagesProcessed = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Group text by y-position to detect rows
        const rowMap = new Map<number, Array<{ text: string; x: number }>>();

        for (const item of textContent.items) {
            if ("str" in item && item.str.trim()) {
                const textItem = item as any;
                const y = Math.round(textItem.y || textItem.transform?.[5] || 0);
                if (!rowMap.has(y)) {
                    rowMap.set(y, []);
                }
                rowMap.get(y)!.push({
                    text: item.str,
                    x: textItem.x || textItem.transform?.[4] || 0,
                });
            }
        }

        // Convert to sorted rows
        const sortedRows = Array.from(rowMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([_, items]) => {
                return items
                    .sort((a, b) => a.x - b.x)
                    .map((item) => item.text);
            });

        if (sortedRows.length > 0) {
            tables.push({
                data: sortedRows,
            });
        }

        pagesProcessed++;
    }

    return { tables, pagesProcessed };
}

/**
 * Extract tables from text content
 */
function extractTablesFromText(text: string): string[][][] {
    const tables: string[][][] = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Simple table detection (looking for aligned columns)
    let currentTable: string[][] = [];
    let inTable = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Simple heuristic: if line contains multiple spaces or tabs, might be tabular
        if (trimmed.includes('\t') || (trimmed.split(/\s{2,}/).length > 2)) {
            if (!inTable) {
                inTable = true;
                currentTable = [];
            }

            // Split by tabs or multiple spaces
            const cells = trimmed.split(/\t|\s{2,}/).map(cell => cell.trim()).filter(cell => cell);
            if (cells.length > 1) {
                currentTable.push(cells);
            }
        } else if (inTable && trimmed) {
            // End of table
            if (currentTable.length > 1) {
                tables.push(currentTable);
            }
            currentTable = [];
            inTable = false;
        }
    }

    // Add final table if exists
    if (currentTable.length > 1) {
        tables.push(currentTable);
    }

    return tables;
}

/**
 * Convert text content to Excel rows
 */
function convertTextToRows(text: string): string[][] {
    const rows: string[][] = [];
    const paragraphs = text.split('\n\n').filter(p => p.trim());

    for (const paragraph of paragraphs) {
        const lines = paragraph.split('\n').filter(line => line.trim());

        for (const line of lines) {
            // Try to split into columns if it looks like CSV or tabular data
            if (line.includes(',') && !line.includes(' ')) {
                // Looks like CSV
                rows.push(line.split(',').map(cell => cell.trim()));
            } else if (line.includes('\t')) {
                // Tab-separated
                rows.push(line.split('\t').map(cell => cell.trim()));
            } else {
                // Single cell
                rows.push([line.trim()]);
            }
        }

        // Add empty row between paragraphs
        rows.push([]);
    }

    return rows;
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, "");
}


