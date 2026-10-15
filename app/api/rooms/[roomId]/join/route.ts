import { NextRequest, NextResponse } from 'next/server';
import { readBodyLimited } from '@/lib/server/request-body';
import {
  allowedOrigin,
  jsonError,
  limited,
  noStore,
  roomRole,
  setRoomCookie,
  validRoomId,
} from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ roomId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (!allowedOrigin(request)) return jsonError('Invalid origin', 403);
  if (!(await limited(request, 'join', roomId, 12, 60))) {
    return jsonError('Too many attempts', 429, 60);
  }
  const raw = await readBodyLimited(request, 512).catch(() => '{}');
  let token: string | undefined;
  try { token = JSON.parse(raw || '{}').token; }
  catch { return jsonError('Invalid JSON', 400); }
  const role = await roomRole(roomId, token);
  if (!role) return jsonError('Invalid or revoked room link', 403);
  const response = NextResponse.json({ role });
  setRoomCookie(response, roomId, token);
  return noStore(response);
}
