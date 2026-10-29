import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    realtime: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL
      && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      && process.env.SUPABASE_JWT_SECRET
    ),
    persistence: Boolean(
      process.env.UPSTASH_REDIS_REST_URL
      && process.env.UPSTASH_REDIS_REST_TOKEN
    ),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
