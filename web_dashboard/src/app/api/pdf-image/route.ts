import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src') || '';

  if (!src) {
    return new NextResponse('Missing src parameter', { status: 400 });
  }

  try {
    // Allow only trusted remote hosts used by the app's uploaded media.
    const parsed = new URL(src);
    const allowedHosts = new Set([
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
    ]);

    if (!allowedHosts.has(parsed.hostname)) {
      return new NextResponse('Host not allowed', { status: 403 });
    }

    const upstream = await fetch(src, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return new NextResponse('Could not fetch image', { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return new NextResponse('Invalid src URL', { status: 400 });
  }
}
