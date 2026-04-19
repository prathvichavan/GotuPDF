/**
 * Page Render API Route
 * Render PDF pages as images
 */

import { NextRequest, NextResponse } from 'next/server';

const PDF_ENGINE_URL = process.env.PDF_ENGINE_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; pageNumber: string }> }
) {
  try {
    const { sessionId, pageNumber } = await params;
    const { searchParams } = new URL(request.url);
    const scale = searchParams.get('scale') || '1.5';
    
    const response = await fetch(
      `${PDF_ENGINE_URL}/api/pdf/${sessionId}/render/${pageNumber}?scale=${scale}`
    );
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to render page' },
        { status: response.status }
      );
    }
    
    const blob = await response.blob();
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('Render error:', error);
    return NextResponse.json(
      { error: 'Failed to render page' },
      { status: 500 }
    );
  }
}
