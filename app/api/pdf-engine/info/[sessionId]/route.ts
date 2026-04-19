/**
 * Document Info API Route
 * Get information about a loaded PDF document
 */

import { NextRequest, NextResponse } from 'next/server';

const PDF_ENGINE_URL = process.env.PDF_ENGINE_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const targetUrl = `${PDF_ENGINE_URL}/api/pdf/${sessionId}/info`;
    console.log('[Info Route] Fetching:', targetUrl);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    console.log('[Info Route] Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get info' }));
      console.log('[Info Route] Error response:', error);
      return NextResponse.json(
        { error: error.detail || 'Failed to get document info' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[Info Route] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to get document info', detail: String(error) },
      { status: 500 }
    );
  }
}
