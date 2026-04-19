import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PYTHON_API_URL = process.env.PDF_ENGINE_URL || "http://localhost:8000";

/**
 * Proxy endpoint to Python PDF Engine
 * POST /api/pdf-engine/extract
 * 
 * Extracts text spans from PDF for editing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${PYTHON_API_URL}/api/pdf/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { success: false, error: error.detail || "Extraction failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("PDF extraction proxy error:", error);
    
    // Check if Python backend is unavailable
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "PDF engine unavailable. Please ensure the Python backend is running.",
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
