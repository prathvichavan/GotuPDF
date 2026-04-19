import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PYTHON_API_URL = process.env.PDF_ENGINE_URL || "http://localhost:8000";

/**
 * Proxy endpoint to Python PDF Engine
 * POST /api/pdf-engine/export
 * 
 * Exports the edited PDF (returns binary PDF data)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { detail: errorText || "Export failed" };
      }
      return NextResponse.json(
        { success: false, error: errorJson.detail || "Export failed" },
        { status: response.status }
      );
    }

    // Check if response is binary (PDF) or JSON
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/pdf')) {
      // Return binary PDF
      const pdfData = await response.arrayBuffer();
      return new NextResponse(pdfData, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="exported.pdf"',
        },
      });
    }
    
    // Return JSON response (might contain download URL or base64)
    const data = await response.json();
    
    // If response contains base64 PDF data, decode and return as binary
    if (data.pdf_data) {
      const binaryString = atob(data.pdf_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="exported.pdf"',
        },
      });
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("PDF export proxy error:", error);
    
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "PDF engine unavailable",
          fallback: true,
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
