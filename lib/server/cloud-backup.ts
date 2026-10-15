import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';
import {
  dirtyKey,
  docKey,
  editorsKey,
  metaKey,
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

