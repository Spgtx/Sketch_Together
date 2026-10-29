import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { toFabricState, validChange, type SyncDocument } from '@/lib/sync-model';
import { APPLY_SYNC_OPERATION } from '@/lib/sync-lua';
import { readBodyLimited, PayloadTooLarge } from '@/lib/server/request-body';
import {
  allowedOrigin,
  authorizeRoom,
  dirtyKey,
  docKey,
  jsonError,
  limited,
  noStore,
  validRoomId,
} from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';
const MAX_BYTES = 4_500_000;
type Context = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (!(await authorizeRoom(request, roomId))) return jsonError('Room access required', 403);
  if (!(await limited(request, 'read', roomId, 100, 60))) {
    return jsonError('Too many reads', 429, 10);
  }
  const redis = getRedis();
  if (!redis) return jsonError('Cloud storage unavailable', 503);
  try {
    const doc = await redis.get<SyncDocument>(docKey(roomId));
    if (!doc) return jsonError('Room not found', 404);
    const tag = `"room-${doc.revision}"`;
    if (request.headers.get('if-none-match') === tag) {
      return noStore(new NextResponse(null, {
        status: 304,
        headers: { ETag: tag },
      }));
    }
    return noStore(NextResponse.json({
      revision: doc.revision,
      versions: doc.versions,
      memberVersions: doc.memberVersions || {},
      structureVersions: doc.structureVersions || {},
      policy: doc.policy || 'protected',
      state: toFabricState(doc),
    }, { headers: { ETag: tag } }));
  } catch {
    return jsonError('Cloud board unavailable', 503);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { roomId } = await params;
  if (!validRoomId(roomId)) return jsonError('Invalid room', 400);
  if (!allowedOrigin(request)) return jsonError('Invalid origin', 403);
  if (!(await authorizeRoom(request, roomId))) return jsonError('Edit permission required', 403);
  if (!(await limited(request, 'write', roomId, 120, 60))) {
    return jsonError('Rate limit exceeded; pending changes were not discarded', 429, 2);
  }
  const redis = getRedis();
  if (!redis) return jsonError('Cloud storage unavailable', 503);
  try {
    const body = await readBodyLimited(request, MAX_BYTES);
    const op: unknown = JSON.parse(body);
    if (!validChange(op)) return jsonError('Invalid operation', 400);
    const result = await redis.eval(
      APPLY_SYNC_OPERATION,
      [docKey(roomId), dirtyKey],
      [JSON.stringify(op), String(Date.now()), roomId],
    );
    const response = typeof result === 'string' ? JSON.parse(result) : result;
    if (response?.status === 'conflict') {
      return jsonError('Object changed in another session; local copy retained', 409);
    }
    if (response?.status === 'too_large') return jsonError('Board too large', 413);
    if (response?.status !== 'ok') return jsonError('Board write failed', 503);
    return noStore(NextResponse.json({
      revision: response.revision,
      duplicate: Boolean(response.duplicate),
    }));
  } catch (error) {
    if (error instanceof PayloadTooLarge) return jsonError('Payload too large', 413);
    if (error instanceof SyntaxError) return jsonError('Invalid JSON', 400);
    return jsonError('Board write failed', 503);
  }
}
