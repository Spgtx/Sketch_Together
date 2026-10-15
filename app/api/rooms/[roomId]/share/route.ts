import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import {
  allowedOrigin,
  authorizeRoom,
  editorsKey,
  jsonError,
  limited,
  newSecret,
  noStore,
  secretHash,
  validRoomId,
} from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ roomId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (!allowedOrigin(request)) return jsonError('Invalid origin', 403);
  const role = await authorizeRoom(request, roomId);
  if (role !== 'owner') {
    const reason = role === 'editor'
      ? 'Editor access cannot create new invitations; ask the room owner'
      : 'Owner session missing or expired; recover the original owner token';
    return jsonError(reason, 403);
  }
  if (!(await limited(request, 'invite', roomId, 10, 3600))) {
    return jsonError('Invite limit exceeded', 429, 3600);
  }
  const redis = getRedis();
  if (!redis) return jsonError('Cloud unavailable', 503);
  if (await redis.scard(editorsKey(roomId)) >= 30) {
    return jsonError('Too many active invite links', 429, 3600);
  }
  const token = newSecret();
  await redis.sadd(editorsKey(roomId), secretHash(token));
  return noStore(NextResponse.json({ token }));
}

/** Immediately revokes API access for all editor links issued to this room. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (!allowedOrigin(request)) return jsonError('Invalid origin', 403);
  if (await authorizeRoom(request, roomId) !== 'owner') {
    return jsonError('Only owners can revoke invites', 403);
  }
  const redis = getRedis();
  if (!redis) return jsonError('Cloud unavailable', 503);
  await redis.del(editorsKey(roomId));
  return noStore(NextResponse.json({ revoked: true }));
}
