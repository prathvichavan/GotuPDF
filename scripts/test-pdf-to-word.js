/**
 * End-to-end test for PDF to Word conversion with full visual fidelity.
 * Creates test PDFs with various features and sends them to the API.
 */
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_URL = 'http://localhost:3000/api/pdf-to-word';

async function createTestPdf(label, builder) {
  const pdfDoc = await PDFDocument.create();
  await builder(pdfDoc);
  const bytes = await pdfDoc.save();
  console.log(`  [${label}] Created test PDF: ${bytes.length} bytes, ${pdfDoc.getPageCount()} page(s)`);
  return Buffer.from(bytes);
}

async function sendToApi(pdfBuffer, filename) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Date.now();
    const parts = [];
    
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`);
    parts.push('Content-Type: application/pdf\r\n\r\n');
    const header = Buffer.from(parts.join(''));
    
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, pdfBuffer, footer]);
    
    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 120000,
    };
    
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

function checkDocx(buffer) {
  // DOCX files start with PK (ZIP signature)
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B;
}

// ── Test 1: Basic text with multiple fonts and colors ──
async function test1_BasicText() {
  const label = 'Test1-BasicText';
  const pdf = await createTestPdf(label, async (doc) => {
    const page = doc.addPage([612, 792]);
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const times = await doc.embedFont(StandardFonts.TimesRoman);
    const courier = await doc.embedFont(StandardFonts.Courier);
    
    page.drawText('GotuPDF Visual Fidelity Test', { x: 72, y: 700, size: 24, font: bold, color: rgb(0.1, 0.2, 0.6) });
    page.drawText('This is regular Helvetica text at 12pt.', { x: 72, y: 660, size: 12, font: helvetica });
    page.drawText('This is Times Roman italic-style text.', { x: 72, y: 640, size: 12, font: times, color: rgb(0.5, 0, 0) });
    page.drawText('function monospace() { return true; }', { x: 72, y: 620, size: 11, font: courier, color: rgb(0, 0.4, 0) });
    page.drawText('Small footer text', { x: 72, y: 50, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
  });
  
  const res = await sendToApi(pdf, 'test-basic.pdf');
  const engine = res.headers['x-conversion-engine'] || 'unknown';
  const validation = res.headers['x-validation-passed'] || 'N/A';
  const score = res.headers['x-quality-score'] || 'N/A';
  const isDocx = checkDocx(res.body);
  
  console.log(`  [${label}] Status: ${res.status} | Engine: ${engine} | QC: ${validation} | Score: ${score}/100 | DOCX valid: ${isDocx} | Size: ${res.body.length} bytes`);
  return res.status === 200 && isDocx;
}

// ── Test 2: Table with borders and styled cells ──
async function test2_Table() {
  const label = 'Test2-Table';
  const pdf = await createTestPdf(label, async (doc) => {
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    
    page.drawText('Table Test Document', { x: 72, y: 720, size: 18, font: bold });
    
    // Draw a simple table with lines
    const tableTop = 680;
    const tableLeft = 72;
    const colWidth = 150;
    const rowHeight = 25;
    const rows = 4;
    const cols = 3;
    
    // Draw horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = tableTop - r * rowHeight;
      page.drawLine({ start: { x: tableLeft, y }, end: { x: tableLeft + cols * colWidth, y }, thickness: 1, color: rgb(0, 0, 0) });
    }
    // Draw vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = tableLeft + c * colWidth;
      page.drawLine({ start: { x, y: tableTop }, end: { x, y: tableTop - rows * rowHeight }, thickness: 1, color: rgb(0, 0, 0) });
    }
    
    // Header row background
    page.drawRectangle({ x: tableLeft, y: tableTop - rowHeight, width: cols * colWidth, height: rowHeight, color: rgb(0.2, 0.3, 0.7) });
    
    // Header text
    const headers = ['Name', 'Value', 'Status'];
    headers.forEach((h, i) => {
      page.drawText(h, { x: tableLeft + i * colWidth + 10, y: tableTop - 18, size: 11, font: bold, color: rgb(1, 1, 1) });
    });
    
    // Data rows
    const data = [['Alpha', '100', 'Active'], ['Beta', '250', 'Pending'], ['Gamma', '75', 'Done']];
    data.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        page.drawText(cell, { x: tableLeft + ci * colWidth + 10, y: tableTop - (ri + 1) * rowHeight - 18, size: 10, font });
      });
    });
  });
  
  const res = await sendToApi(pdf, 'test-table.pdf');
  const engine = res.headers['x-conversion-engine'] || 'unknown';
  const validation = res.headers['x-validation-passed'] || 'N/A';
  const score = res.headers['x-quality-score'] || 'N/A';
  const isDocx = checkDocx(res.body);
  
  console.log(`  [${label}] Status: ${res.status} | Engine: ${engine} | QC: ${validation} | Score: ${score}/100 | DOCX valid: ${isDocx} | Size: ${res.body.length} bytes`);
  return res.status === 200 && isDocx;
}

// ── Test 3: Multi-page document with headers/footers ──
async function test3_MultiPage() {
  const label = 'Test3-MultiPage';
  const pdf = await createTestPdf(label, async (doc) => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    
    for (let i = 1; i <= 4; i++) {
      const page = doc.addPage([612, 792]);
      // Header
      page.drawText('GotuPDF Report', { x: 72, y: 760, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawLine({ start: { x: 72, y: 755 }, end: { x: 540, y: 755 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      
      // Title
      page.drawText(`Chapter ${i}: Section Content`, { x: 72, y: 720, size: 20, font: bold });
      
      // Body text
      const loremLines = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
        'Duis aute irure dolor in reprehenderit in voluptate velit.',
        'Excepteur sint occaecat cupidatat non proident, sunt in culpa.',
      ];
      loremLines.forEach((line, li) => {
        page.drawText(line, { x: 72, y: 680 - li * 20, size: 11, font });
      });
      
      // Footer
      page.drawLine({ start: { x: 72, y: 45 }, end: { x: 540, y: 45 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      page.drawText(`Page ${i} of 4`, { x: 270, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    }
  });
  
  const res = await sendToApi(pdf, 'test-multipage.pdf');
  const engine = res.headers['x-conversion-engine'] || 'unknown';
  const validation = res.headers['x-validation-passed'] || 'N/A';
  const score = res.headers['x-quality-score'] || 'N/A';
  const isDocx = checkDocx(res.body);
  
  console.log(`  [${label}] Status: ${res.status} | Engine: ${engine} | QC: ${validation} | Score: ${score}/100 | DOCX valid: ${isDocx} | Size: ${res.body.length} bytes`);
  return res.status === 200 && isDocx;
}

// ── Test 4: Watermark text ──
async function test4_Watermark() {
  const label = 'Test4-Watermark';
  const pdf = await createTestPdf(label, async (doc) => {
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    
    // Watermark (rotated large text)
    page.drawText('CONFIDENTIAL', {
      x: 100, y: 300, size: 60, font: bold,
      color: rgb(0.9, 0.9, 0.9), rotate: degrees(45), opacity: 0.3,
    });
    
    // Normal content on top
    page.drawText('Confidential Report', { x: 72, y: 700, size: 18, font: bold });
    page.drawText('This document contains the financial overview for Q4 2024.', { x: 72, y: 670, size: 11, font });
    page.drawText('Revenue exceeded targets by 15% across all divisions.', { x: 72, y: 650, size: 11, font });
  });
  
  const res = await sendToApi(pdf, 'test-watermark.pdf');
  const engine = res.headers['x-conversion-engine'] || 'unknown';
  const validation = res.headers['x-validation-passed'] || 'N/A';
  const score = res.headers['x-quality-score'] || 'N/A';
  const isDocx = checkDocx(res.body);
  
  console.log(`  [${label}] Status: ${res.status} | Engine: ${engine} | QC: ${validation} | Score: ${score}/100 | DOCX valid: ${isDocx} | Size: ${res.body.length} bytes`);
  return res.status === 200 && isDocx;
}

// ── Test 5: Embedded image (PNG embedded inline) ──
async function test5_Image() {
  const label = 'Test5-Image';
  const pdf = await createTestPdf(label, async (doc) => {
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    
    page.drawText('Document with Embedded Image', { x: 72, y: 720, size: 18, font: bold });
    
    // Create a simple PNG: 100x100 red square
    // PNG header + IHDR + IDAT + IEND (minimal valid PNG)
    const pngBytes = createMinimalPng(100, 100, [255, 0, 0]);
    const image = await doc.embedPng(pngBytes);
    
    page.drawImage(image, { x: 72, y: 550, width: 200, height: 150 });
    
    page.drawText('Figure 1: Test image above shows the embedded graphic.', { x: 72, y: 530, size: 10, font });
  });
  
  const res = await sendToApi(pdf, 'test-image.pdf');
  const engine = res.headers['x-conversion-engine'] || 'unknown';
  const validation = res.headers['x-validation-passed'] || 'N/A';
  const score = res.headers['x-quality-score'] || 'N/A';
  const isDocx = checkDocx(res.body);
  
  console.log(`  [${label}] Status: ${res.status} | Engine: ${engine} | QC: ${validation} | Score: ${score}/100 | DOCX valid: ${isDocx} | Size: ${res.body.length} bytes`);
  return res.status === 200 && isDocx;
}

/** Create a minimal valid 8-bit RGB PNG of solid color */
function createMinimalPng(width, height, color) {
  const zlib = require('zlib');
  
  // Raw image data: filter byte (0) + RGB pixels per row
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = [0]; // filter byte = None
    for (let x = 0; x < width; x++) {
      row.push(color[0], color[1], color[2]);
    }
    rawRows.push(Buffer.from(row));
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);
  
  const chunks = [];
  
  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(pngChunk('IHDR', ihdr));
  
  // IDAT chunk
  chunks.push(pngChunk('IDAT', compressed));
  
  // IEND chunk
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));
  
  return Buffer.concat(chunks);
}

function pngChunk(type, data) {
  const crc32 = require('buffer-crc32') || null;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  
  // Simple CRC32 implementation
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32Calc(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuf]);
}

function crc32Calc(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Run all tests ──
async function main() {
  console.log('\n=== GotuPDF: PDF to Word End-to-End Tests ===\n');
  
  const tests = [
    ['Basic Text & Fonts', test1_BasicText],
    ['Table with Borders', test2_Table],
    ['Multi-page + Headers/Footers', test3_MultiPage],
    ['Watermark Text', test4_Watermark],
    ['Embedded Image', test5_Image],
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, fn] of tests) {
    console.log(`\n── ${name} ──`);
    try {
      const ok = await fn();
      if (ok) { passed++; console.log(`  ✓ PASSED`); }
      else { failed++; console.log(`  ✗ FAILED`); }
    } catch (err) {
      failed++;
      console.log(`  ✗ ERROR: ${err.message}`);
    }
  }
  
  console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${tests.length} ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
