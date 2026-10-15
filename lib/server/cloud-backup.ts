import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';
import {
  dirtyKey,
  docKey,
  editorsKey,
  metaKey,
  validRoomId,
  type RoomMeta,
} from '@/lib/server/room-security';
import type { SyncDocument } from '@/lib/sync-model';

const ACK_BACKUP = `
local board = redis.call('GET', KEYS[1])
if board and cjson.decode(board).revision == tonumber(ARGV[1]) then
  return redis.call('ZREM', KEYS[2], ARGV[2])
end
return 0
`;

const UNLOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

function backupClients() {
  const redis = getRedis();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!redis || !url || !serviceKey) {
    throw new Error('Redis or Supabase backup credentials missing');
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { redis, supabase };
}

export async function backupRoom(id: string) {
  const { redis, supabase } = backupClients();
  const lock = `sketch:backup:lock:${id}`;
  const marker = randomBytes(12).toString('hex');
  const acquired = await redis.set(lock, marker, { nx: true, ex: 60 });
  if (!acquired) throw new Error('Another backup is already running');
  try {
    return await writeSnapshot();
  } finally {
    await redis.eval(UNLOCK, [lock], [marker]);
  }

  async function writeSnapshot() {
    const [doc, meta, editorHashes] = await Promise.all([
      redis.get<SyncDocument>(docKey(id)),
      redis.get<RoomMeta>(metaKey(id)),
      redis.smembers(editorsKey(id)),
    ]);
    if (!doc || !meta) throw new Error('Room not found');
    const bytes = gzipSync(Buffer.from(JSON.stringify(doc)));
    const objectPath = `${id}/latest.json.gz`;
    const { error: uploadError } = await supabase.storage
      .from('sketch-board-backups')
      .upload(objectPath, bytes, {
        contentType: 'application/gzip',
        upsert: true,
      });
    if (uploadError) throw uploadError;
    const { error: rowError } = await supabase.from('sketch_board_backups').upsert({
      room_id: id,
      revision: doc.revision,
      object_path: objectPath,
      owner_hash: meta.ownerHash,
      editor_hashes: editorHashes,
      backed_up_at: new Date().toISOString(),
    }, { onConflict: 'room_id' });
    if (rowError) throw rowError;
    // A concurrent edit must keep this room scheduled for the next checkpoint.
    const removed = await redis.eval(
      ACK_BACKUP,
      [docKey(id), dirtyKey],
      [String(doc.revision), id],
    );
    return { id, revision: doc.revision, saved: Number(removed) === 1 };
  }
}


/**
 * Checkpoint a bounded batch of dirty rooms for the scheduled maintenance job.
 *
 * Individual failures are returned instead of stopping the whole batch. Failed
 * rooms remain in Redis's dirty set and can be retried on the next invocation.
 */
export type DirtyBackupResult =
  | Awaited<ReturnType<typeof backupRoom>>
  | { id: string; saved: false; error: string };

export async function backupDirtyRooms(batchSize = 5): Promise<DirtyBackupResult[]> {
  const redis = getRedis();
  if (!redis) throw new Error('Redis is not configured');

  // Keep maintenance requests bounded to avoid serverless timeouts.
  const limit = Number.isFinite(batchSize)
    ? Math.max(1, Math.min(10, Math.floor(batchSize)))
    : 5;
  const ids = await redis.zrange(dirtyKey, 0, limit - 1) as string[];
  const results: DirtyBackupResult[] = [];

  for (const id of ids) {
    if (!validRoomId(id)) {
      console.error('[backups:flush] Invalid dirty room ID');
      results.push({ id, saved: false, error: 'Invalid room ID' });
      continue;
    }

    try {
      results.push(await backupRoom(id));
    } catch (error) {
      // Never log credentials, room access tokens, or backend error messages.
      console.error('[backups:flush] Room backup failed', {
        roomId: id,
        category: error instanceof Error ? error.name : 'unknown',
      });
      results.push({ id, saved: false, error: 'Backup failed; retry on next run' });
    }
  }

  return results;
}
