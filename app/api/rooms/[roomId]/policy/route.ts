import { NextRequest, NextResponse } from 'next/server';
import { readBodyLimited } from '@/lib/server/request-body';
import { getRedis } from '@/lib/redis';
import {
  allowedOrigin,
  authorizeRoom,
  docKey,
  dirtyKey,
  jsonError,
  noStore,
  validRoomId,
} from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ roomId: string }> };

const SET_POLICY = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local board = cjson.decode(raw)
if board.policy ~= ARGV[1] then
  board.policy = ARGV[1]
  board.revision = board.revision + 1
  board.updatedAt = tonumber(ARGV[2])
  redis.call('SET', KEYS[1], cjson.encode(board))
  redis.call('ZADD', KEYS[2], board.updatedAt, ARGV[3])
end
return 1
`;

export async function POST(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (!allowedOrigin(request)) return jsonError('Invalid origin', 403);
  if (await authorizeRoom(request, roomId) !== 'owner') {
    return jsonError('Only owners can change collaboration policy', 403);
  }
  const raw = await readBodyLimited(request, 512).catch(() => '{}');
  let policy: string | undefined;
  try { policy = JSON.parse(raw || '{}').policy; }
  catch { return jsonError('Invalid JSON', 400); }
  if (policy !== 'classic' && policy !== 'protected') {
    return jsonError('Invalid collaboration policy', 400);
  }
  const redis = getRedis();
  if (!redis) return jsonError('Cloud unavailable', 503);
  const changed = await redis.eval(SET_POLICY, [docKey(roomId), dirtyKey], [
    policy, String(Date.now()), roomId,
  ]);
  if (!changed) return jsonError('Room not found', 404);
  return noStore(NextResponse.json({ policy }));
}
