import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PYTHON_API_URL = process.env.PDF_ENGINE_URL || "http://localhost:8000";

/**
 * Proxy endpoint to Python PDF Engine
 * POST /api/pdf-engine/upload
 * 
 * Uploads PDF and creates editing session
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { success: false, error: error.detail || "Upload failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("PDF upload proxy error:", error);
    
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
