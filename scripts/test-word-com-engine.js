/**
 * test-word-com-engine.js
 * End-to-end test suite for GotuPDF Word COM Automation Engine
 *
 * Tests both directions:
 *   - PDF → Word (via /api/pdf-to-word)
 *   - Word → PDF (via /api/word-to-pdf)
 *
 * Validates: status codes, output format, metadata headers, quality scores
 */

const http = require("http");
const https = require("https");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const RESULTS = { passed: 0, failed: 0, total: 0 };

/* ================================================================
   HELPERS
   ================================================================ */

function post(urlPath, formEntries) {
    return new Promise((resolve, reject) => {
        const boundary = "----FormBoundary" + Date.now().toString(36);
        const parts = [];

        for (const { name, data, filename, contentType } of formEntries) {
            let header = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"`;
            if (filename) header += `; filename="${filename}"`;
            header += "\r\n";
            if (contentType) header += `Content-Type: ${contentType}\r\n`;
            header += "\r\n";
            parts.push(Buffer.from(header));
            parts.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
            parts.push(Buffer.from("\r\n"));
        }
        parts.push(Buffer.from(`--${boundary}--\r\n`));
        const body = Buffer.concat(parts);

        const url = new URL(urlPath, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Content-Length": body.length,
            },
            timeout: 300000, // 5 min
        };

        const req = http.request(options, (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    buffer,
                    text: () => buffer.toString("utf-8"),
                    json: () => JSON.parse(buffer.toString("utf-8")),
                });
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
        req.write(body);
        req.end();
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function runTest(name, fn) {
    RESULTS.total++;
    process.stdout.write(`\n── ${name} ──\n`);
    try {
        await fn();
        RESULTS.passed++;
        console.log(`  \x1b[32m✓ PASSED\x1b[0m`);
    } catch (err) {
        RESULTS.failed++;
        console.log(`  \x1b[31m✗ FAILED: ${err.message}\x1b[0m`);
    }
}

/* ================================================================
   PDF TEST HELPERS  (create test PDFs with pdf-lib)
   ================================================================ */

async function createBasicTextPdf() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([595, 842]);
    page.drawText("GotuPDF Test Document", { x: 50, y: 780, size: 24, font: bold });
    page.drawText("This is a basic text test with multiple paragraphs.", { x: 50, y: 740, size: 12, font });
    page.drawText("Second paragraph with different content for validation.", { x: 50, y: 720, size: 12, font });
    page.drawText("Third paragraph ensures sufficient text for QC checks.", { x: 50, y: 700, size: 12, font });
    return Buffer.from(await doc.save());
}

async function createTablePdf() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    // Draw table grid lines
    const startX = 50, startY = 750, cellW = 120, cellH = 25, rows = 4, cols = 4;
    for (let r = 0; r <= rows; r++) {
        page.drawLine({ start: { x: startX, y: startY - r * cellH }, end: { x: startX + cols * cellW, y: startY - r * cellH }, thickness: 1 });
    }
    for (let c = 0; c <= cols; c++) {
        page.drawLine({ start: { x: startX + c * cellW, y: startY }, end: { x: startX + c * cellW, y: startY - rows * cellH }, thickness: 1 });
    }
    // Fill some cells
    const data = [["Name", "Age", "City", "Score"], ["Alice", "30", "NYC", "95"], ["Bob", "25", "LA", "88"], ["Carol", "35", "Chicago", "92"]];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            page.drawText(data[r][c], { x: startX + c * cellW + 5, y: startY - r * cellH - 17, size: 10, font });
        }
    }
    return Buffer.from(await doc.save());
}

async function createMultiPagePdf(pageCount = 5) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= pageCount; i++) {
        const page = doc.addPage([595, 842]);
        page.drawText(`Page ${i} of ${pageCount}`, { x: 50, y: 780, size: 18, font });
        for (let line = 0; line < 20; line++) {
            page.drawText(`Content line ${line + 1} on page ${i} — Lorem ipsum dolor sit amet.`, {
                x: 50, y: 740 - line * 20, size: 10, font,
            });
        }
    }
    return Buffer.from(await doc.save());
}

async function createWatermarkPdf() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    // Simulated watermark (diagonal text)
    page.drawText("CONFIDENTIAL", { x: 120, y: 400, size: 60, font, color: rgb(0.9, 0.9, 0.9), rotate: { type: "degrees", angle: 45 } });
    page.drawText("Document with watermark overlay", { x: 50, y: 780, size: 14, font: regular });
    page.drawText("The watermark should be preserved in conversion.", { x: 50, y: 750, size: 12, font: regular });
    return Buffer.from(await doc.save());
}

async function createImagePdf() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText("Document with embedded image placeholder", { x: 50, y: 780, size: 14, font });
    // Draw a colored rectangle as image placeholder
    page.drawRectangle({ x: 50, y: 500, width: 200, height: 150, color: rgb(0.2, 0.5, 0.8), borderWidth: 2, borderColor: rgb(0, 0, 0) });
    page.drawText("(Image Area)", { x: 110, y: 570, size: 12, font, color: rgb(1, 1, 1) });
    return Buffer.from(await doc.save());
}

/* ================================================================
   DOCX TEST HELPER (create minimal DOCX for Word-to-PDF testing)
   ================================================================ */

function createMinimalDocx() {
    // Create a valid DOCX (Open XML) using jszip.
    // Must include styles.xml + settings.xml + document.xml.rels
    // so Word COM can open it without "corrupted" errors.
    const JSZip = require("jszip");
    const zip = new JSZip();

    // [Content_Types].xml
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`);

    // _rels/.rels
    zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // word/_rels/document.xml.rels — references styles + settings
    zip.folder("word").folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`);

    // word/styles.xml — defines Title and TableGrid styles
    zip.folder("word").file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:after="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="56"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/>
    <w:tblPr><w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
    </w:tblBorders></w:tblPr>
  </w:style>
  <w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>
    <w:tblPr><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>
  </w:style>
</w:styles>`);

    // word/settings.xml — minimal required settings
    zip.folder("word").file("settings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`);

    // word/document.xml — a real DOCX body with paragraphs and a table
    zip.folder("word").file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t>GotuPDF Word to PDF Test</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is a test document created for the Word COM Engine test suite.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Bold text</w:t></w:r>
      <w:r><w:t xml:space="preserve"> and </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>italic text</w:t></w:r>
      <w:r><w:t xml:space="preserve"> and </w:t></w:r>
      <w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>underlined text</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="0" w:type="auto"/>
      </w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Name</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Value</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Engine</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Word COM</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Quality</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100/100</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:r><w:t>End of test document.</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`);

    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/* ================================================================
   TEST SUITE — PDF TO WORD
   ================================================================ */

async function testPdfToWordBasicText() {
    const pdfBytes = await createBasicTextPdf();
    console.log(`  Created test PDF: ${pdfBytes.length} bytes`);

    const res = await post("/api/pdf-to-word", [{
        name: "file0",
        data: pdfBytes,
        filename: "test-basic.pdf",
        contentType: "application/pdf",
    }]);

    const engine = res.headers["x-conversion-engine"] || "";
    const score = res.headers["x-quality-score"] || "0";
    const qc = res.headers["x-validation-passed"] || "";
    const pages = res.headers["x-original-pages"] || "0";

    console.log(`  Status: ${res.status} | Engine: ${engine} | Pages: ${pages} | QC: ${qc} | Score: ${score}/100 | Size: ${res.buffer.length} bytes`);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(engine === "word-com", `Expected word-com engine, got ${engine}`);
    assert(res.buffer.length > 1000, `Output too small: ${res.buffer.length}`);
    assert(res.buffer[0] === 0x50 && res.buffer[1] === 0x4B, "Not a valid DOCX (ZIP)");
    assert(parseInt(score) >= 70, `Quality score too low: ${score}`);
}

async function testPdfToWordTable() {
    const pdfBytes = await createTablePdf();
    console.log(`  Created table PDF: ${pdfBytes.length} bytes`);

    const res = await post("/api/pdf-to-word", [{
        name: "file0",
        data: pdfBytes,
        filename: "test-table.pdf",
        contentType: "application/pdf",
    }]);

    const engine = res.headers["x-conversion-engine"] || "";
    const score = res.headers["x-quality-score"] || "0";
    const tables = res.headers["x-table-count"] || "0";

    console.log(`  Status: ${res.status} | Engine: ${engine} | Tables: ${tables} | Score: ${score}/100 | Size: ${res.buffer.length} bytes`);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(engine === "word-com", `Expected word-com engine`);
    assert(res.buffer.length > 1000, "Output too small");
}

async function testPdfToWordMultiPage() {
    const pdfBytes = await createMultiPagePdf(5);
    console.log(`  Created 5-page PDF: ${pdfBytes.length} bytes`);

    const res = await post("/api/pdf-to-word", [{
        name: "file0",
        data: pdfBytes,
        filename: "test-multipage.pdf",
        contentType: "application/pdf",
    }]);

    const engine = res.headers["x-conversion-engine"] || "";
    const score = res.headers["x-quality-score"] || "0";
    const pages = res.headers["x-original-pages"] || "0";

    console.log(`  Status: ${res.status} | Engine: ${engine} | Pages: ${pages} | Score: ${score}/100 | Size: ${res.buffer.length} bytes`);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(engine === "word-com", "Expected word-com engine");
    assert(parseInt(pages) >= 3, `Expected at least 3 pages, got ${pages}`);
}

async function testPdfToWordWatermark() {
    const pdfBytes = await createWatermarkPdf();
    console.log(`  Created watermark PDF: ${pdfBytes.length} bytes`);

    const res = await post("/api/pdf-to-word", [{
        name: "file0",
        data: pdfBytes,
        filename: "test-watermark.pdf",
        contentType: "application/pdf",
    }]);

    const engine = res.headers["x-conversion-engine"] || "";
    const score = res.headers["x-quality-score"] || "0";
    const watermark = res.headers["x-has-watermark"] || "false";

    console.log(`  Status: ${res.status} | Engine: ${engine} | Watermark: ${watermark} | Score: ${score}/100 | Size: ${res.buffer.length} bytes`);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(engine === "word-com", "Expected word-com engine");
}

async function testPdfToWordImage() {
    const pdfBytes = await createImagePdf();
    console.log(`  Created image PDF: ${pdfBytes.length} bytes`);

    const res = await post("/api/pdf-to-word", [{
        name: "file0",
        data: pdfBytes,
        filename: "test-image.pdf",
        contentType: "application/pdf",
    }]);

    const engine = res.headers["x-conversion-engine"] || "";
    const score = res.headers["x-quality-score"] || "0";
    const images = res.headers["x-image-count"] || "0";

    console.log(`  Status: ${res.status} | Engine: ${engine} | Images: ${images} | Score: ${score}/100 | Size: ${res.buffer.length} bytes`);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(engine === "word-com", "Expected word-com engine");
}

/* ================================================================
   TEST SUITE — WORD TO PDF
   ================================================================ */

async function testWordToPdfBasic() {
    const docxBytes = await createMinimalDocx();
    console.log(`  Created test DOCX: ${docxBytes.length} bytes`);

    const res = await post("/api/word-to-pdf", [{
        name: "file0",
        data: docxBytes,
        filename: "test-basic.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }]);

    const engine = res.headers["x-conversion-engine"] || "";
    const score = res.headers["x-quality-score"] || "0";
    const pages = res.headers["x-total-pages"] || "0";
    const elapsed = res.headers["x-elapsed-ms"] || "0";

    console.log(`  Status: ${res.status} | Engine: ${engine} | Pages: ${pages} | Score: ${score}/100 | Elapsed: ${elapsed}ms | Size: ${res.buffer.length} bytes`);

    if (res.status !== 200) {
        console.log(`  ERROR BODY: ${res.buffer.toString().substring(0, 300)}`);
    }

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(engine === "word-com", `Expected word-com engine, got ${engine}`);
    assert(res.buffer.length > 1000, `Output too small: ${res.buffer.length}`);
    // Check PDF header
    const header = res.buffer.slice(0, 5).toString("ascii");
    assert(header === "%PDF-", `Not a valid PDF. Header: ${header}`);
    assert(parseInt(score) >= 70, `Quality score too low: ${score}`);
}

async function testWordToPdfRoundTrip() {
    // Create PDF → convert to Word → convert back to PDF
    const originalPdf = await createBasicTextPdf();
    console.log(`  Step 1: Created original PDF: ${originalPdf.length} bytes`);

    // PDF → Word
    const res1 = await post("/api/pdf-to-word", [{
        name: "file0",
        data: originalPdf,
        filename: "roundtrip.pdf",
        contentType: "application/pdf",
    }]);
    assert(res1.status === 200, `PDF→Word failed with ${res1.status}`);
    console.log(`  Step 2: PDF→Word: ${res1.buffer.length} bytes`);

    // Word → PDF
    const res2 = await post("/api/word-to-pdf", [{
        name: "file0",
        data: res1.buffer,
        filename: "roundtrip.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }]);

    const engine = res2.headers["x-conversion-engine"] || "";
    const score = res2.headers["x-quality-score"] || "0";
    const pages = res2.headers["x-total-pages"] || "0";

    console.log(`  Step 3: Word→PDF: ${res2.buffer.length} bytes | Engine: ${engine} | Pages: ${pages} | Score: ${score}/100`);

    assert(res2.status === 200, `Word→PDF failed with ${res2.status}`);
    assert(engine === "word-com", "Expected word-com engine");
    const header = res2.buffer.slice(0, 5).toString("ascii");
    assert(header === "%PDF-", "Round-trip output is not a valid PDF");
}

/* ================================================================
   ERROR HANDLING TESTS
   ================================================================ */

async function testPdfToWordInvalidFile() {
    const res = await post("/api/pdf-to-word", [{
        name: "file0",
        data: Buffer.from("This is not a PDF file at all"),
        filename: "invalid.pdf",
        contentType: "application/pdf",
    }]);

    console.log(`  Status: ${res.status} (expected 400)`);
    assert(res.status === 400, `Expected 400 for invalid PDF, got ${res.status}`);
}

async function testWordToPdfInvalidFile() {
    const res = await post("/api/word-to-pdf", [{
        name: "file0",
        data: Buffer.from("This is not a DOCX file"),
        filename: "invalid.txt",
        contentType: "text/plain",
    }]);

    console.log(`  Status: ${res.status} (expected 400)`);
    assert(res.status === 400, `Expected 400 for invalid file type, got ${res.status}`);
}

async function testPdfToWordEmptyFile() {
    const res = await post("/api/pdf-to-word", [{
        name: "file0",
        data: Buffer.alloc(0),
        filename: "empty.pdf",
        contentType: "application/pdf",
    }]);

    console.log(`  Status: ${res.status} (expected 400)`);
    assert(res.status === 400 || res.status === 500, `Expected 400/500 for empty file, got ${res.status}`);
}

/* ================================================================
   MAIN
   ================================================================ */

async function main() {
    console.log("\n=== GotuPDF: Word COM Engine End-to-End Tests ===\n");

    // PDF → Word tests
    console.log("━━━ PDF TO WORD ━━━");
    await runTest("Basic Text PDF → Word", testPdfToWordBasicText);
    await runTest("Table PDF → Word", testPdfToWordTable);
    await runTest("Multi-page PDF → Word", testPdfToWordMultiPage);
    await runTest("Watermark PDF → Word", testPdfToWordWatermark);
    await runTest("Image PDF → Word", testPdfToWordImage);

    // Word → PDF tests
    console.log("\n━━━ WORD TO PDF ━━━");
    await runTest("Basic DOCX → PDF", testWordToPdfBasic);
    await runTest("Round-trip: PDF → Word → PDF", testWordToPdfRoundTrip);

    // Error handling tests
    console.log("\n━━━ ERROR HANDLING ━━━");
    await runTest("Invalid PDF → Word (should 400)", testPdfToWordInvalidFile);
    await runTest("Invalid Word → PDF (should 400)", testWordToPdfInvalidFile);
    await runTest("Empty PDF → Word (should fail)", testPdfToWordEmptyFile);

    // Summary
    console.log(`\n=== Results: ${RESULTS.passed} passed, ${RESULTS.failed} failed out of ${RESULTS.total} ===\n`);
    process.exit(RESULTS.failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("Test suite crashed:", err);
    process.exit(1);
});
