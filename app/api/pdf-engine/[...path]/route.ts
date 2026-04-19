import { NextRequest, NextResponse } from 'next/server';

const PDF_ENGINE_URL = process.env.PDF_ENGINE_URL || 'http://localhost:8000';

// Proxy all requests to the Python PDF engine
async function proxyRequest(
  request: NextRequest,
  method: string,
  path: string
): Promise<NextResponse> {
  const targetUrl = `${PDF_ENGINE_URL}${path}`;
  
  console.log(`[PDF Engine Proxy] ${method} ${targetUrl}`);
  
  try {
    const headers: HeadersInit = {};
    
    // Forward relevant headers
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    
    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    
    // Forward body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      // Check if it's multipart form data
      if (contentType?.includes('multipart/form-data')) {
        const formData = await request.formData();
        fetchOptions.body = formData;
        // Let fetch set the Content-Type with boundary for FormData
        delete (fetchOptions.headers as Record<string, string>)['Content-Type'];
      } else {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      }
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    // Get response data
    const responseContentType = response.headers.get('content-type') || '';
    let responseBody: ArrayBuffer | string;
    
    if (responseContentType.includes('application/json')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.arrayBuffer();
    }
    
    // Create response with appropriate content type
    const proxyResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    });
    
    // Forward response headers
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        proxyResponse.headers.set(key, value);
      }
    });
    
    return proxyResponse;
  } catch (error) {
    console.error('[PDF Engine Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to connect to PDF Engine',
        detail: error instanceof Error ? error.message : 'Unknown error',
        target: targetUrl
      },
      { status: 503 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = '/api/' + path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const pathWithQuery = searchParams ? `${fullPath}?${searchParams}` : fullPath;
  
  return proxyRequest(request, 'GET', pathWithQuery);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = '/api/' + path.join('/');
  
  return proxyRequest(request, 'POST', fullPath);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = '/api/' + path.join('/');
  
  return proxyRequest(request, 'PUT', fullPath);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = '/api/' + path.join('/');
  
  return proxyRequest(request, 'DELETE', fullPath);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
