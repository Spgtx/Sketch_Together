import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { backupRoom } from '@/lib/server/cloud-backup';
import {
  allowedOrigin,
  authorizeRoom,
  jsonError,
  limited,
  noStore,
  validRoomId,
} from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ roomId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (!allowedOrigin(request)) return jsonError('Invalid origin', 403);
  if (await authorizeRoom(request, roomId) !== 'owner') {
    return jsonError('Only owners can request durable backups', 403);
  }
  if (!(await limited(request, 'backup', roomId, 2, 60))) {
    return jsonError('Only two manual backups per minute', 429, 30);
  }
  try {
    const result = await backupRoom(roomId);
    return noStore(NextResponse.json(result));
  } catch {
    return jsonError('Backup failed or Supabase Storage not configured', 503);
  }
}

export async function GET(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (await authorizeRoom(request, roomId) !== 'owner') {
    return jsonError('Only owners can check backup status', 403);
  }
  if (!(await limited(request, 'backup-status', roomId, 20, 60))) {
    return jsonError('Too many status requests', 429, 10);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return jsonError('Supabase backups not configured', 503);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.from('sketch_board_backups')
    .select('revision,backed_up_at')
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) return jsonError('Backup status unavailable', 503);
  return noStore(NextResponse.json({ backup: data ?? null }));
}
