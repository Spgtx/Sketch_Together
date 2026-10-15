const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'lib', 'art-strokes.ts');
const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const compiled = new Module(filename, module.exports);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(js, filename);
const { quadraticPath, pressureStrokePath, hexWithOpacity } = compiled.exports;

test('pressure stroke outlines produce a closed valid vector path', () => {
  const pathData = pressureStrokePath([
    { x: 10, y: 11, pressure: 0.2 },
    { x: 20, y: 18, pressure: 0.5 },
    { x: 30, y: 11, pressure: 0.95 },
  ], 12);
  assert.match(pathData, /^M /);
  assert.match(pathData, /L /);
  assert.match(pathData, / Z$/);
  assert.doesNotMatch(pathData, /NaN|Infinity/);
});

test('pressure rendering handles a single tap', () => {
  const pathData = pressureStrokePath([{ x: 7, y: 8, pressure: 0.5 }], 12);
  assert.match(pathData, /^M /);
  assert.match(pathData, /a /);
  assert.match(pathData, /Z$/);
});

test('invalid coordinates are ignored and invalid width is rejected', () => {
  assert.equal(pressureStrokePath([{ x: 5, y: 6 }], 0), '');
  assert.equal(pressureStrokePath([{ x: NaN, y: 6 }], 5), '');
});

test('three-point quadratic curve is stable and accepts updated handles', () => {
  const original = [
    { x: 0, y: 1 },
    { x: 20, y: 40 },
    { x: 80, y: 2 },
  ];
  assert.equal(quadraticPath(original), 'M 0 1 Q 20 40 80 2');
  original[1].y = 60;
  assert.equal(quadraticPath(original), 'M 0 1 Q 20 60 80 2');
  assert.equal(quadraticPath(original.slice(0, 2)), '');
});

test('opacity helper clamps alpha and preserves unknown color input', () => {
  assert.equal(hexWithOpacity('#ff8033', 0.5), 'rgba(255, 128, 51, 0.5)');
  assert.equal(hexWithOpacity('#ff8033', 0), 'rgba(255, 128, 51, 0.05)');
  assert.equal(hexWithOpacity('#ff8033', 10), 'rgba(255, 128, 51, 1)');
  assert.equal(hexWithOpacity('rgba(1,2,3,0.5)', 0.5), 'rgba(1,2,3,0.5)');
});

test('a drawn curve remains a normal serializable object for room sync', () => {
  const nodes = [
    { x: 11, y: 25 },
    { x: 39, y: 4 },
    { x: 68, y: 55 },
  ];
  const object = {
    id: 'vector-curve-01',
    type: 'path',
    path: quadraticPath(nodes),
    vectorNodes: nodes,
  };
  const sync = JSON.parse(JSON.stringify(object));
  assert.deepEqual(sync.vectorNodes, nodes);
  assert.match(sync.path, /^M 11 25 Q/);
});
