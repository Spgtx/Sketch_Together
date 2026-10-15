const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'lib', 'cloud-room-client.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const instance = new Module(filename, module.exports);
instance.filename = filename;
instance.paths = Module._nodeModulePaths(path.dirname(filename));
instance._compile(output, filename);
const { createCloudRoom, saveOwnerAccess, uploadLocalDocument } = instance.exports;
const id = 'abcdef1234567890abcdef12';
const token = 'x'.repeat(43);
const ok = (obj, status = 200) => new Response(JSON.stringify(obj), { status });

afterEach(() => {
  delete global.fetch;
  delete global.localStorage;
  delete global.crypto;
});

test('cloud creation returns an owner capability and never uses a local fallback', async () => {
  global.fetch = async () => ok({ id, token, policy: 'protected' }, 201);
  const room = await createCloudRoom();
  assert.equal(room.id, id);
  assert.equal(room.token, token);
  assert.equal(room.policy, 'protected');
});

test('room creation shows Redis and rate limit errors instead of local mode', async () => {
  global.fetch = async () => ok({ error: 'Room creation limit reached' }, 429);
  await assert.rejects(createCloudRoom(), /Room creation limit reached.*429/);
  global.fetch = async () => ok({ error: 'Cloud storage is not configured' }, 503);
  await assert.rejects(createCloudRoom(), /Cloud storage is not configured.*503/);
});

test('malformed success does not create a board without owner access', async () => {
  global.fetch = async () => ok({ id, token: '' }, 201);
  await assert.rejects(createCloudRoom(), /owner credential/);
});

test('owner token is stored for the new room, never derived from its ID', () => {
  const data = new Map();
  global.localStorage = { setItem(key, value) { data.set(key, value); } };
  assert.equal(saveOwnerAccess({ id, token, policy: 'protected' }), true);
  assert.equal(data.get(`sketchtogether:room-access:${id}`), token);
});

test('upload preserves server-side validation and requires a confirmed revision', async () => {
  const requests = [];
  global.crypto = { randomUUID: () => 'abc123456789' };
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return ok({ revision: 1 });
  };
  await uploadLocalDocument({ id, token, policy: 'protected' }, { objects: [] });
  assert.match(requests[0].url, /\/api\/sync\//);
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${token}`);
  const operation = JSON.parse(requests[0].options.body);
  assert.equal(operation.kind, 'replace');
  assert.equal(operation.baseRevision, 0);
});

test('failed artwork upload remains a failure rather than reporting cloud success', async () => {
  global.crypto = { randomUUID: () => 'abc123456789' };
  global.fetch = async () => ok({ error: 'Board too large' }, 413);
  await assert.rejects(
    uploadLocalDocument({ id, token, policy: 'protected' }, { objects: [] }),
    /Could not save artwork to Redis: Board too large/,
  );
});
