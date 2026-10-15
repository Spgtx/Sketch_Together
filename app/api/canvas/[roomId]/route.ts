import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
const MAX_BYTES = 4_500_000;

function validId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,32}$/.test(id);
}

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

const noCache = { 'Cache-Control': 'no-store' };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { roomId } = await params;
  if (!validId(roomId)) {
    return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ state: null, mode: 'local' }, { headers: noCache });
  }

  try {
    const stored = await redis.get<{ state: unknown; updatedAt: number }>(
      `sketch:v2:${roomId}`,
    );
    if (stored) {
      return NextResponse.json({ ...stored, mode: 'cloud' }, { headers: noCache });
    }

    // Load older rooms. The next cloud save migrates to the v2 key.
    const legacy = await redis.get<unknown>(`canvas:${roomId}`);
    const state = typeof legacy === 'string' ? JSON.parse(legacy) : legacy;
    return NextResponse.json({
      state: state ?? null,
      updatedAt: 0,
      mode: 'cloud',
    }, { headers: noCache });
  } catch (error) {
    console.error('Failed to load board', error);
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { roomId } = await params;
  if (!validId(roomId)) {
    return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Cloud storage is not configured' }, {
      status: 503,
    });
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Board exceeds 4.5MB limit' }, {
        status: 413,
      });
    }

    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).length > MAX_BYTES) {
      return NextResponse.json({ error: 'Board exceeds 4.5MB limit' }, {
        status: 413,
      });
    }

    const parsed: unknown = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) {
      return NextResponse.json({ error: 'Missing board state' }, { status: 400 });
    }

    const state = (parsed as { state: unknown }).state;
    if (
      !state
      || typeof state !== 'object'
      || !('objects' in state)
      || !Array.isArray((state as { objects: unknown }).objects)
    ) {
      return NextResponse.json({ error: 'Invalid Fabric canvas state' }, {
        status: 400,
      });
    }

    const updatedAt = Date.now();
    await redis.set(`sketch:v2:${roomId}`, { state, updatedAt });
    return NextResponse.json({ success: true, updatedAt });
  } catch (error) {
    console.error('Failed to save board', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
