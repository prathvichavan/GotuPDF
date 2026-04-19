/**
 * Extract All API Route
 * Extract all objects (text, images, vectors, annotations) from a page
 */

import { NextRequest, NextResponse } from 'next/server';

const PDF_ENGINE_URL = process.env.PDF_ENGINE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetUrl = `${PDF_ENGINE_URL}/api/pdf/extract/all`;
    console.log('[Extract-All Route] Request body:', body);
    console.log('[Extract-All Route] Fetching:', targetUrl);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    console.log('[Extract-All Route] Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Extraction failed' }));
      console.log('[Extract-All Route] Error response:', error);
      return NextResponse.json(
        { error: error.detail || 'Extraction failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[Extract-All Route] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to extract objects', detail: String(error) },
      { status: 500 }
    );
  }
}
