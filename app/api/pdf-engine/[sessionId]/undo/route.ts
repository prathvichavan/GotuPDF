/**
 * Undo API Route
 * Undo last edit operation
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
      `${PDF_ENGINE_URL}/api/pdf/${sessionId}/undo`,
      { method: 'POST' }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Undo failed' }));
      return NextResponse.json(
        { error: error.detail || 'Undo failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Undo error:', error);
    return NextResponse.json(
      { error: 'Failed to undo' },
      { status: 500 }
    );
  }
}
