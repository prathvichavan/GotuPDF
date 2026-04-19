/**
 * Redo API Route
 * Redo previously undone operation
 */

import { NextRequest, NextResponse } from 'next/server';

const PDF_ENGINE_URL = process.env.PDF_ENGINE_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    const response = await fetch(
      `${PDF_ENGINE_URL}/api/pdf/${sessionId}/redo`,
      { method: 'POST' }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Redo failed' }));
      return NextResponse.json(
        { error: error.detail || 'Redo failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Redo error:', error);
    return NextResponse.json(
      { error: 'Failed to redo' },
      { status: 500 }
    );
  }
}
