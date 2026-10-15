import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeRoom,
  jsonError,
  limited,
  noStore,
  signedRoomJwt,
  validRoomId,
} from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  const role = await authorizeRoom(request, roomId);
  if (!role) return jsonError('Room permission required', 403);
  if (!(await limited(request, 'live-token', roomId, 30, 60))) {
    return jsonError('Realtime authentication is temporarily limited', 429, 60);
  }
  const token = signedRoomJwt(roomId, role);
  if (!token) return jsonError('Private Realtime is not configured', 503);
  return noStore(NextResponse.json({ token }));
}
