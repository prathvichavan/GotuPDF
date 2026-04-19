/**
 * Batch Text Edit API Route
 * Apply multiple text edits at once
 */

import { NextRequest, NextResponse } from 'next/server';

const PDF_ENGINE_URL = process.env.PDF_ENGINE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${PDF_ENGINE_URL}/api/pdf/edit/text/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Batch edit failed' }));
      return NextResponse.json(
        { error: error.detail || 'Batch edit failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Batch edit error:', error);
    return NextResponse.json(
      { error: 'Failed to apply batch edits' },
      { status: 500 }
    );
  }
}
