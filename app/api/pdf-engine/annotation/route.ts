/**
 * Annotations API Route
 * Add, modify, and delete PDF annotations
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
      `${PDF_ENGINE_URL}/api/pdf/annotation/add?session_id=${sessionId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add annotation' }));
      return NextResponse.json(
        { error: error.detail || 'Failed to add annotation' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Annotation add error:', error);
    return NextResponse.json(
      { error: 'Failed to add annotation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const annotId = searchParams.get('annot_id');
    
    if (!sessionId || !annotId) {
      return NextResponse.json(
        { error: 'session_id and annot_id are required' },
        { status: 400 }
      );
    }
    
    const response = await fetch(
      `${PDF_ENGINE_URL}/api/pdf/annotation/${annotId}?session_id=${sessionId}`,
      { method: 'DELETE' }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete annotation' }));
      return NextResponse.json(
        { error: error.detail || 'Failed to delete annotation' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Annotation delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    );
  }
}
