/**
 * Test Script for Protect PDF and PDF-to-PPT Systems
 *
 * Run with: npx ts-node --esm scripts/test-pdf-systems.ts
 * Or: node --loader ts-node/esm scripts/test-pdf-systems.ts
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

async function createTestPdf(): Promise<string> {
    // Create a simple valid PDF for testing
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Hello World!) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000222 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
318
%%EOF`;

    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "pdf-test-"));
    const pdfPath = path.join(tempDir, "test.pdf");
    await fsp.writeFile(pdfPath, pdfContent);
    return pdfPath;
}

async function testProtectPdf(): Promise<boolean> {
    console.log("\n=== Testing Protect PDF System ===\n");
    
    try {
        const { protectPdf } = await import("../lib/protectPdfQpdf.js");
        
        const testPdfPath = await createTestPdf();
        const pdfBytes = await fsp.readFile(testPdfPath);
        
        console.log("Input PDF size:", pdfBytes.length, "bytes");
        
        const result = await protectPdf({
            pdfBytes: Buffer.from(pdfBytes),
            outputBaseName: "test",
            userPassword: "user123",
            ownerPassword: "owner456",
            permissions: {
                print: true,
                copy: false,
                modify: false,
                annotate: true,
            },
        });
        
        console.log("✅ Protection successful!");
        console.log("   Output file:", result.fileName);
        console.log("   Output size:", result.pdfBytes.length, "bytes");
        console.log("   Content type:", result.contentType);
        
        // Verify encryption metadata
        const hasEncrypt = result.pdfBytes.includes("/Encrypt");
        console.log("   Has /Encrypt:", hasEncrypt ? "✅ Yes" : "❌ No");
        
        // Cleanup
        await fsp.rm(path.dirname(testPdfPath), { recursive: true, force: true });
        
        return hasEncrypt;
    } catch (error) {
        console.error("❌ Protection failed:", error);
        return false;
    }
}

async function testPdfToPptx(): Promise<boolean> {
    console.log("\n=== Testing PDF to PPTX System ===\n");
    
    try {
        const { convertPdfToPptx } = await import("../lib/pdfToPptxImage.js");
        
        const testPdfPath = await createTestPdf();
        const pdfBytes = await fsp.readFile(testPdfPath);
        
        console.log("Input PDF size:", pdfBytes.length, "bytes");
        
        const result = await convertPdfToPptx({
            originalName: "test.pdf",
            pdfBytes: Buffer.from(pdfBytes),
        });
        
        console.log("✅ Conversion successful!");
        console.log("   Output file:", result.fileName);
        console.log("   Output size:", (result.pptxBuffer.length / 1024).toFixed(2), "KB");
        console.log("   Slide count:", result.slideCount);
        console.log("   Has images:", result.hasImages);
        console.log("   Engine:", result.engine);
        console.log("   Quality score:", result.validation.score);
        console.log("   Elapsed:", result.elapsed, "ms");
        
        // Cleanup
        await fsp.rm(path.dirname(testPdfPath), { recursive: true, force: true });
        
        return result.slideCount > 0;
    } catch (error) {
        console.error("❌ Conversion failed:", error);
        return false;
    }
}

async function main() {
    console.log("╔════════════════════════════════════════╗");
    console.log("║   PDF Systems Validation Test Suite    ║");
    console.log("╚════════════════════════════════════════╝");
    
    const protectResult = await testProtectPdf();
    const convertResult = await testPdfToPptx();
    
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║           Test Results Summary         ║");
    console.log("╠════════════════════════════════════════╣");
    console.log(`║ Protect PDF:   ${protectResult ? "✅ PASSED" : "❌ FAILED"}              ║`);
    console.log(`║ PDF to PPTX:   ${convertResult ? "✅ PASSED" : "❌ FAILED"}              ║`);
    console.log("╚════════════════════════════════════════╝");
    
    if (!protectResult || !convertResult) {
        process.exit(1);
    }
}

main().catch(console.error);
