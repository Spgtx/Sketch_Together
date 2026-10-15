import { NextRequest, NextResponse } from 'next/server';
import { Rest } from 'ably';

export const dynamic = 'force-dynamic';

/** Issues scoped, short-lived Ably tokens; never exposes the server API key. */
export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get('roomId') || '';
  const clientId = request.nextUrl.searchParams.get('clientId') || '';

  const roomValid = /^[a-zA-Z0-9_-]{8,32}$/.test(roomId);
  const clientValid = /^guest-[a-zA-Z0-9_-]{8,36}$/.test(clientId);
  if (!roomValid || !clientValid) {
    return NextResponse.json({ error: 'Invalid room or client' }, { status: 400 });
  }

  if (!process.env.ABLY_API_KEY) {
    return NextResponse.json({ error: 'Real-time not configured' }, {
      status: 503,
    });
  }

  try {
    const ably = new Rest({ key: process.env.ABLY_API_KEY });
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      ttl: 60 * 60 * 1000,
      capability: JSON.stringify({
        [`sketch:${roomId}`]: ['publish', 'subscribe', 'presence'],
      }),
    });
    return NextResponse.json(tokenRequest, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Ably authentication failed', error);
    return NextResponse.json({ error: 'Real-time unavailable' }, { status: 503 });
  }
}
