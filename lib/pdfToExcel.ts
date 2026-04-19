import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

// Set up PDF.js worker (client only)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface ConversionMetrics {
  tablesFound: number;
  rowsExtracted: number;
  processingTime: number;
  pagesProcessed: number;
}

/**
 * Extract text content from PDF with layout information
 */
async function extractPDFContent(pdfBuffer: ArrayBuffer) {
  // Ensure we have a Uint8Array for pdfjs-dist
  const data = new Uint8Array(pdfBuffer);
  const pdf = await pdfjsLib.getDocument({
    data,
    disableWorker: typeof window === 'undefined',
  }).promise;
  const pages: any[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group items by y-coordinate to detect rows
    const rowMap = new Map<number, any[]>();

    for (const item of textContent.items) {
      if ('str' in item) {
        const textItem = item as any;
        const y = Math.round(textItem.y || textItem.transform?.[5] || 0);
        if (!rowMap.has(y)) {
          rowMap.set(y, []);
        }
        rowMap.get(y)!.push({
          text: textItem.str,
          x: textItem.x || textItem.transform?.[4] || 0,
          y: y,
          width: textItem.width || 0,
        });
      }
    }

    pages.push({
      pageNum: i,
      rows: Array.from(rowMap.entries())
        .sort((a, b) => b[0] - a[0]) // Sort by y-coordinate descending
        .map(([_, items]) => {
          return items
            .sort((a, b) => a.x - b.x)
            .map((item: any) => item.text)
            .join(' ');
        }),
      itemsByRow: rowMap,
    });
  }

  return pages;
}

/**
 * Detect potential tables by analyzing text layout
 * Tables are identified by aligned text in columns
 */
function detectTables(pages: any[]) {
  const tables: any[] = [];

  for (const page of pages) {
    const itemsByRow = page.itemsByRow;

    // Convert map to sorted rows
    const sortedRows = Array.from(itemsByRow.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([_, items]) => {
        return items.sort((a, b) => a.x - b.x);
      });

    // Detect columns by finding consistent x-positions
    const xPositions = new Set<number>();
    for (const row of sortedRows) {
      for (const item of row) {
        xPositions.add(Math.round(item.x / 10) * 10); // Round to nearest 10
      }
    }

    const sortedXPositions = Array.from(xPositions).sort((a, b) => a - b);

    if (sortedXPositions.length > 1) {
      // Build table data
      const tableData: any[] = [];

      for (const row of sortedRows) {
        const rowData: string[] = [];
        for (let i = 0; i < sortedXPositions.length; i++) {
          const colX = sortedXPositions[i];
          const nextColX =
            i < sortedXPositions.length - 1
              ? sortedXPositions[i + 1]
              : Infinity;

          const cellContent = row
            .filter((item: any) => {
              const roundedX = Math.round(item.x / 10) * 10;
              return roundedX === colX;
            })
            .map((item: any) => item.text)
            .join(' ');

          rowData.push(cellContent);
        }

        if (rowData.some((cell) => cell.trim().length > 0)) {
          tableData.push(rowData);
        }
      }

      if (tableData.length > 0) {
        tables.push({
          pageNum: page.pageNum,
          data: tableData,
          rowCount: tableData.length,
          colCount: sortedXPositions.length,
        });
      }
    }
  }

  return tables;
}

/**
 * Convert extracted table data to Excel workbook
 */
function createExcelWorkbook(tables: any[]) {
  const workbook = XLSX.utils.book_new();
  let totalRowsExtracted = 0;

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const sheetName = `Sheet${i + 1}`;

    // Create worksheet from table data
    const worksheet = XLSX.utils.aoa_to_sheet(table.data);

    // Auto-adjust column widths
    const colWidths = [];
    if (table.data.length > 0) {
      const firstRow = table.data[0];
      for (let j = 0; j < firstRow.length; j++) {
        let maxWidth = 12;
        for (let row = 0; row < table.data.length; row++) {
          const cellValue = table.data[row][j]?.toString() || '';
          maxWidth = Math.max(maxWidth, cellValue.length);
        }
        colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
      }
    }
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    totalRowsExtracted += table.rowCount;
  }

  return { workbook, totalRowsExtracted };
}

/**
 * Main conversion function
 */
export async function convertPDFToExcel(
  pdfBuffer: ArrayBuffer
): Promise<{
  buffer: Buffer;
  metrics: ConversionMetrics;
}> {
  const startTime = Date.now();

  try {
    // Extract content from PDF
    const pages = await extractPDFContent(pdfBuffer);

    // Detect tables
    const tables = detectTables(pages);

    // Create Excel workbook
    const { workbook, totalRowsExtracted } = createExcelWorkbook(
      tables.map((t) => t.data)
    );

    // Convert workbook to buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer' });

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      buffer: excelBuffer as Buffer,
      metrics: {
        tablesFound: tables.length,
        rowsExtracted: totalRowsExtracted,
        processingTime,
        pagesProcessed: pages.length,
      },
    };
  } catch (error) {
    console.error('PDF to Excel conversion error:', error);
    throw new Error(
      `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fallback method using simpler table detection
 * This uses line detection to identify table boundaries
 */
export async function convertPDFToExcelAdvanced(
  pdfBuffer: ArrayBuffer
): Promise<{
  buffer: Buffer;
  metrics: ConversionMetrics;
}> {
  const startTime = Date.now();

  try {
    // Ensure we have a Uint8Array for pdfjs-dist
    const data = new Uint8Array(pdfBuffer);
    const pdf = await pdfjsLib.getDocument({
      data,
      disableWorker: typeof window === 'undefined',
    }).promise;
    const allTables: any[] = [];
    let totalPages = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Group text by position
      const rows: Map<number, any[]> = new Map();

      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          const textItem = item as any;
          const y = Math.round(textItem.y || textItem.transform?.[5] || 0);
          if (!rows.has(y)) {
            rows.set(y, []);
          }
          rows.get(y)!.push({
            text: textItem.str,
            x: textItem.x || textItem.transform?.[4] || 0,
          });
        }
      }

      // Convert to array and sort
      const sortedRows = Array.from(rows.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([_, items]) => {
          return items
            .sort((a, b) => a.x - b.x)
            .map((i) => i.text);
        });

      if (sortedRows.length > 0) {
        allTables.push(sortedRows);
      }

      totalPages++;
    }

    // Create Excel with all data
    const workbook = XLSX.utils.book_new();

    for (let i = 0; i < allTables.length; i++) {
      const sheetName = `Page${i + 1}`;
      const worksheet = XLSX.utils.aoa_to_sheet(allTables[i]);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    const excelBuffer = XLSX.write(workbook, { type: 'buffer' });
    const processingTime = (Date.now() - startTime) / 1000;

    return {
      buffer: excelBuffer as Buffer,
      metrics: {
        tablesFound: allTables.length,
        rowsExtracted: allTables.reduce((sum, t) => sum + t.length, 0),
        processingTime,
        pagesProcessed: totalPages,
      },
    };
  } catch (error) {
    console.error('Advanced PDF to Excel conversion error:', error);
    throw new Error(
      `Advanced conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
