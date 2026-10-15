const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTs(file) {
  const filename = path.join(__dirname, '..', 'lib', file);
  const source = fs.readFileSync(filename, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const instance = new Module(filename, module.exports);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance._compile(javascript, filename);
  return instance.exports;
}

const model = loadTs('sync-model.ts');
const geometry = loadTs('connector-geometry.ts');
const makeOp = (kind, id, baseVersion, extras = {}) => ({
  kind,
  id,
  baseVersion,
  opId: `test-operation-${crypto.randomUUID()}`,
  actor: 'test-client-abcdef',
  policy: 'protected',
  ...extras,
});
const shape = (id) => ({ id, type: 'rect', left: 10, top: 15, width: 50 });

test('independent shapes do not conflict', () => {
  let doc = model.freshDocument();
  const a = model.applyChange(doc, makeOp('add', 'A', -1, { object: shape('A') }));
  doc = a.document;
  const b = model.applyChange(doc, makeOp('add', 'B', -1, { object: shape('B') }));
  assert.equal(b.accepted, true);
  assert.deepEqual(Object.keys(b.document.objects).sort(), ['A', 'B']);
});

test('protected mode refuses stale edit to same object', () => {
  let doc = model.applyChange(model.freshDocument(), makeOp(
    'add', 'A', -1, { object: shape('A') },
  )).document;
  const stale = makeOp('modify', 'A', 1, { object: { ...shape('A'), left: 22 } });
  doc = model.applyChange(doc, makeOp(
    'modify', 'A', 1, { object: { ...shape('A'), left: 88 } },
  )).document;
  const rejected = model.applyChange(doc, stale);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.document.objects.A.left, 88);
});

test('classic mode accepts same-object last-write-wins', () => {
  let doc = model.applyChange(model.freshDocument(), makeOp(
    'add', 'A', -1, { object: shape('A') },
  )).document;
  doc = model.applyChange(doc, makeOp(
    'modify', 'A', 1, { object: { ...shape('A'), left: 88 } },
  )).document;
  doc.policy = 'classic'; // Only the owner may switch the server's stored policy.
  const classic = model.applyChange(doc, makeOp(
    'modify', 'A', 1, {
      policy: 'classic',
      object: { ...shape('A'), left: 12 },
    },
  ));
  assert.equal(classic.accepted, true);
  assert.equal(classic.document.objects.A.left, 12);
});

test('untrusted client policy cannot override protected room', () => {
  const doc = model.applyChange(model.freshDocument(), makeOp(
    'add', 'A', -1, { object: shape('A') },
  )).document;
  const stale = model.applyChange(doc, makeOp('modify', 'A', -1, {
    policy: 'classic', object: { ...shape('A'), left: 900 },
  }));
  assert.equal(stale.accepted, false);
});

test('shared objects reject remote URL images and excessive nesting', () => {
  assert.equal(model.safeCanvasData({ type: 'image', src: 'https://evil.test/p.png' }), false);
  assert.equal(model.safeCanvasData({ type: 'image', src: 'data:image/png;base64,YQ==' }), true);
  assert.equal(model.safeCanvasData({ text: 'hello', nested: { width: 12 } }), true);
  let deep = { text: 'start' };
  for (let i = 0; i < 15; i++) deep = { child: deep };
  assert.equal(model.safeCanvasData(deep), false);
});

test('repeated delivery of the same operation is idempotent', () => {
  const op = makeOp('add', 'A', -1, { object: shape('A') });
  const first = model.applyChange(model.freshDocument(), op);
  const again = model.applyChange(first.document, op);
  assert.equal(again.duplicate, true);
  assert.equal(again.document.revision, 1);
});

test('tombstones reject offline resurrection of deleted object', () => {
  let doc = model.applyChange(model.freshDocument(), makeOp(
    'add', 'A', -1, { object: shape('A') },
  )).document;
  doc = model.applyChange(doc, makeOp('remove', 'A', 1)).document;
  const stale = model.applyChange(doc, makeOp(
    'modify', 'A', 1, { object: shape('A') },
  ));
  assert.equal(stale.accepted, false);
  assert.equal(stale.document.objects.A, undefined);
});

test('full board replacements compare the entire revision', () => {
  let doc = model.applyChange(model.freshDocument(), makeOp(
    'add', 'A', -1, { object: shape('A') },
  )).document;
  const attempt = model.applyChange(doc, makeOp('replace', undefined, undefined, {
    baseRevision: 0,
    state: { objects: [] },
  }));
  assert.equal(attempt.accepted, false);
  assert.ok(doc.objects.A);
});

test('connector geometry clips at shape edge', () => {
  assert.deepEqual(geometry.edgeAnchor(
    { left: 0, top: 0, width: 100, height: 50 }, { x: 200, y: 25 },
  ), { x: 100, y: 25 });
});

test('connector paths include elbow corners and an arrowhead', () => {
  const path = geometry.connectorPath({ x: 10, y: 20 }, { x: 110, y: 120 }, 'elbow');
  assert.match(path, /L 60 20 L 60 120 L 110 120/);
  assert.ok(path.split('M ').length >= 3);
});
