/**
 * Page Operations API Route
 * Add, delete, duplicate, rotate, crop pages
 */

import { NextRequest, NextResponse } from 'next/server';

const PDF_ENGINE_URL = process.env.PDF_ENGINE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    const response = await fetch(
      `${PDF_ENGINE_URL}/api/pdf/page/operation?session_id=${sessionId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Page operation failed' }));
      return NextResponse.json(
        { error: error.detail || 'Page operation failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Page operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform page operation' },
      { status: 500 }
    );
  }
}
