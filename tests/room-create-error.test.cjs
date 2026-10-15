const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'app', 'api', 'rooms', 'route.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

let simulate = {};
let removed = [];
const redis = {
  async set(key) {
    if (simulate.failSet?.(key)) throw new Error('Network unavailable');
    return 'OK';
  },
  async del(key) {
    removed.push(key);
    return 1;
  },
};
const security = {
  allowedOrigin: () => true,
  docKey: (id) => `doc:${id}`,
  jsonError: (message, status) => Response.json({ error: message }, { status }),
  limited: async () => {
    if (simulate.failLimited) throw new Error('Redis EVAL refused');
    return simulate.allowed !== false;
  },
  metaKey: (id) => `meta:${id}`,
  newSecret: () => 'x'.repeat(43),
  noStore: (result) => result,
  secretHash: () => 'z'.repeat(64),
  setRoomCookie: () => {},
};
const nextServer = {
  NextResponse: { json: (obj, init) => Response.json(obj, init) },
};
const modules = {
  'next/server': nextServer,
  '@/lib/redis': { getRedis: () => {
    if (simulate.badRedisClient) throw new Error('Invalid URL');
    return simulate.noRedis ? null : redis;
  } },
  '@/lib/sync-model': { freshDocument: () => ({ revision: 0, objects: {} }) },
  '@/lib/server/room-security': security,
};

const instance = new Module(filename, module.exports);
instance.filename = filename;
instance.paths = Module._nodeModulePaths(path.dirname(filename));
instance.require = (name) => modules[name] || require(name);
instance._compile(output, filename);
const { POST } = instance.exports;

const originalConsoleError = console.error;
let events = [];
afterEach(() => {
  simulate = {};
  removed = [];
  events = [];
  console.error = originalConsoleError;
});

function request() {
  console.error = (...args) => events.push(args);
  return { url: 'http://localhost:3000/api/rooms' };
}

test('a Redis rate-limit exception is a safe HTTP 503, not an unhandled 500', async () => {
  simulate.failLimited = true;
  const result = await POST(request());
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /Redis rate-limit check failed/);
  assert.equal(events[0][1], 'rate-limit');
});

test('a Redis document write failure is surfaced and cleans incomplete metadata', async () => {
  simulate.failSet = (key) => key.startsWith('doc:');
  const result = await POST(request());
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /Redis room write failed/);
  assert.equal(removed.length, 1);
  assert.match(removed[0], /^meta:/);
});

test('healthy Redis room creation still returns a cloud owner credential', async () => {
  const result = await POST(request());
  assert.equal(result.status, 201);
  const room = await result.json();
  assert.match(room.id, /^[a-f\d]{24}$/);
  assert.equal(room.token.length, 43);
  assert.equal(room.policy, 'protected');
});

test('cloud creation still enforces the rate limit', async () => {
  simulate.allowed = false;
  const result = await POST(request());
  assert.equal(result.status, 429);
});

test('missing Redis configuration returns an actionable HTTP 503', async () => {
  simulate.noRedis = true;
  const result = await POST(request());
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /Redis is not configured/);
});

test('invalid Redis REST client initialization returns HTTP 503, not 500', async () => {
  simulate.badRedisClient = true;
  const result = await POST(request());
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /Redis client configuration failed/);
});
