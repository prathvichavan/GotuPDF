import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PYTHON_API_URL = process.env.PDF_ENGINE_URL || "http://localhost:8000";

/**
 * Proxy endpoint to Python PDF Engine
 * POST /api/pdf-engine/edit
 * 
 * Applies text edits to PDF using true content stream modification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { success: false, error: error.detail || "Edit failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("PDF edit proxy error:", error);
    
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
