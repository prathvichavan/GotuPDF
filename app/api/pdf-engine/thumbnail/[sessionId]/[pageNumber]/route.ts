/**
 * Thumbnail API Route
 * Generate page thumbnails
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
    const width = searchParams.get('width') || '120';
    
    const response = await fetch(
      `${PDF_ENGINE_URL}/api/pdf/${sessionId}/thumbnail/${pageNumber}?width=${width}`
    );
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to generate thumbnail' },
        { status: response.status }
      );
    }
    
    const blob = await response.blob();
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    
  } catch (error) {
    console.error('Thumbnail error:', error);
    return NextResponse.json(
      { error: 'Failed to generate thumbnail' },
      { status: 500 }
    );
  }
}
