import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { freshDocument } from '@/lib/sync-model';
import {
  allowedOrigin,
  docKey,
  jsonError,
  limited,
  metaKey,
  newSecret,
  noStore,
  secretHash,
  setRoomCookie,
} from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CreateStage = 'redis-client' | 'rate-limit' | 'metadata' | 'document' | 'response';

/**
 * These categories are safe to log: never write Redis credentials, tokens,
 * request headers, URLs or raw backend error messages to logs.
 */
function failureCategory(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/unauthorized|invalid.*token|401/i.test(message)) return 'redis-authentication';
  if (/forbidden|permission denied|403/i.test(message)) return 'redis-permission';
  if (/fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|timeout/i.test(message)) {
    return 'redis-connectivity';
  }
  if (/EVAL|script|unknown command/i.test(message)) return 'redis-command';
  return 'redis-unknown';
}

export async function POST(request: NextRequest) {
  if (!allowedOrigin(request)) return jsonError('Invalid origin', 403);
  let stage: CreateStage = 'redis-client';
  let redis: ReturnType<typeof getRedis> = null;
  let roomId: string | null = null;
  let metadataCreated = false;

  try {
    redis = getRedis();
    if (!redis) return jsonError('Redis is not configured', 503);
    stage = 'rate-limit';
    // Previously outside try/catch, producing an opaque HTTP 500 on failure.
    if (!(await limited(request, 'create', 'all', 5, 3600))) {
      return jsonError('Room creation limit reached', 429, 3600);
    }

    const id = randomBytes(12).toString('hex');
    const token = newSecret();
    const meta = {
      id,
      ownerHash: secretHash(token),
      createdAt: Date.now(),
    };

    stage = 'metadata';
    const created = await redis.set(metaKey(id), meta, { nx: true });
    if (!created) return jsonError('Could not reserve a new room', 503);
    roomId = id;
    metadataCreated = true;

    stage = 'document';
    const board = { ...freshDocument(), policy: 'protected' as const };
    await redis.set(docKey(id), JSON.stringify(board));

    stage = 'response';
    const response = NextResponse.json(
      { id, token, policy: board.policy },
      { status: 201 },
    );
    setRoomCookie(response, id, token);
    return noStore(response);
  } catch (error) {
    console.error('[rooms:create]', stage, failureCategory(error));
    // Prevent metadata-only rooms when the initial document write fails.
    if (redis && metadataCreated && roomId && stage === 'document') {
      try {
        await redis.del(metaKey(roomId));
      } catch {
        console.error('[rooms:create] orphan metadata cleanup failed');
      }
    }
    if (stage === 'redis-client') {
      return jsonError('Redis client configuration failed. Run npm run redis:check.', 503);
    }
    if (stage === 'rate-limit') {
      return jsonError(
        'Redis rate-limit check failed. Run npm run redis:check on the server.',
        503,
      );
    }
    return jsonError(
      'Redis room write failed. Run npm run redis:check and inspect server logs.',
      503,
    );
  }
}
