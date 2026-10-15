const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'lib', 'room-links.ts');
const javascript = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const instance = new Module(filename, module.exports);
instance.filename = filename;
instance.paths = Module._nodeModulePaths(path.dirname(filename));
instance._compile(javascript, filename);
const links = instance.exports;

const id = 'ab1234567890';
const owner = 'owner-capability-test';
const guest = 'editor-capability-test';
const revoked = 'revoked-capability-test';
let storage;
let session;
let requests;
let url;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

beforeEach(() => {
  storage = new Map();
  session = null;
  requests = [];
  url = { origin: 'https://sketch.example', pathname: `/room/${id}`, search: '', hash: '' };
  global.location = url;
  global.history = {
    replaceState(_state, _title, relative) {
      const updated = new URL(relative, url.origin);
      url.pathname = updated.pathname;
      url.search = updated.search;
      url.hash = updated.hash;
    },
  };
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  global.fetch = async (endpoint, opts = {}) => {
    requests.push({ endpoint, opts });
    if (endpoint.endsWith('/join')) {
      const { token } = JSON.parse(opts.body);
      if (token === owner) session = 'owner';
      else if (token === guest) session = 'editor';
      else return json({ error: 'Invalid token' }, 403);
      return json({ role: session });
    }
    if (endpoint.endsWith('/share')) {
      if (session === 'owner' || opts.headers?.Authorization === `Bearer ${owner}`) {
        return json({ token: guest });
      }
      return json({ error: 'Only room owners can invite editors' }, 403);
    }
    if (endpoint.startsWith('/api/sync/')) {
      return session ? json({ revision: 1 }) : json({ error: 'Denied' }, 403);
    }
    throw new Error(`Unexpected endpoint ${endpoint}`);
  };
});

afterEach(() => {
  delete global.location;
  delete global.history;
  delete global.localStorage;
  delete global.fetch;
});

test('owner can recover a lost session and create an editor invitation', async () => {
  storage.set(links.accessKey(id), owner);
  const invitation = await links.editorInviteUrl(id);
  assert.match(invitation, /#access=editor-capability-test$/);
  assert.equal(session, 'owner');
  assert.equal(requests[1].opts.headers.Authorization, `Bearer ${owner}`);
});

test('editor can reshare their own invitation, not mint a new one', async () => {
  storage.set(links.accessKey(id), guest);
  const invitation = await links.editorInviteUrl(id);
  assert.match(invitation, /#access=editor-capability-test$/);
  assert.equal(session, 'editor');
  assert.equal(requests.filter((r) => r.endpoint.endsWith('/share')).length, 2);
});

test('an unauthenticated client cannot create an invite', async () => {
  await assert.rejects(links.editorInviteUrl(id), /Owner access is missing/);
});

test('a revoked stored token cannot create an invitation', async () => {
  storage.set(links.accessKey(id), revoked);
  await assert.rejects(links.editorInviteUrl(id), /Owner access is missing/);
});

test('an owner opening a guest link retains the owner capability', async () => {
  storage.set(links.accessKey(id), owner);
  url.hash = `#access=${guest}`;
  assert.equal(await links.enterRoom(id), true);
  assert.equal(session, 'owner');
  assert.equal(storage.get(links.accessKey(id)), owner);
  assert.equal(url.hash, '');
});

test('an invited guest can enter a room with no stored token', async () => {
  url.hash = `#access=${guest}`;
  assert.equal(await links.enterRoom(id), true);
  assert.equal(session, 'editor');
  assert.equal(storage.get(links.accessKey(id)), guest);
  assert.equal(url.hash, '');
});

test('a valid cookie works even when a stored token is revoked', async () => {
  storage.set(links.accessKey(id), revoked);
  session = 'owner';
  assert.equal(await links.enterRoom(id), true);
  assert.equal(session, 'owner');
});

test('a guest cannot recover access to a room without their invitation', async () => {
  storage.set(links.accessKey(id), revoked);
  assert.equal(await links.enterRoom(id), false);
});
