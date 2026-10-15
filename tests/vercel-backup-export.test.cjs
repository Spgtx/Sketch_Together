const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const root = join(__dirname, '..');
const source = (path) => readFileSync(join(root, path), 'utf8');

test('maintenance route imports an existing scheduled backup export', () => {
  const route = source('app/api/maintenance/flush/route.ts');
  const backup = source('lib/server/cloud-backup.ts');
  assert.match(route, /import \{ backupDirtyRooms \} from/);
  assert.match(backup, /export async function backupDirtyRooms\(/);
  assert.match(backup, /zrange\(dirtyKey,/);
  assert.match(backup, /await backupRoom\(id\)/);
});

test('the retired Ably route cannot break the Supabase build', () => {
  assert.equal(existsSync(join(root, 'app/api/ably/token/route.ts')), false);
});
