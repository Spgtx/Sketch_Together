const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'lib', 'raster-paint.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename, module.exports);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const {
  BLEND_MODES, floodFillPixels, insidePaintArea, paintStroke, validBlendMode,
} = loaded.exports;

test('blend controls accept supported compositing operations only', () => {
  assert.ok(validBlendMode('multiply'));
  assert.ok(validBlendMode('overlay'));
  assert.ok(!validBlendMode('destination-out'));
  assert.equal(BLEND_MODES.length, 6);
});

test('pixel painting uses destination-out for a true pixel eraser', () => {
  const state = { composite: '', operations: [] };
  const context = {
    save() { state.operations.push('save'); },
    restore() { state.operations.push('restore'); },
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {},
    fill() {}, stroke() { state.composite = this.globalCompositeOperation; },
  };
  paintStroke({ getContext: () => context }, [
    { x: 2, y: 3 }, { x: 8, y: 6 },
  ], 12, '#ff0088', 0.7, true);
  assert.equal(state.composite, 'destination-out');
  assert.equal(context.globalAlpha, 1);
  assert.deepEqual(state.operations, ['save', 'restore']);
});

test('bucket fills only a contiguous region, leaving other colors untouched', () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 0, 0, 0, 0, 0, 200, 0, 0, 255,
    0, 0, 0, 0, 200, 0, 0, 255, 200, 0, 0, 255,
  ]);
  const count = floodFillPixels(pixels, 3, 2,
    { x: 0, y: 0 }, '#336699', 0.5, 5);
  assert.equal(count, 3);
  assert.deepEqual(Array.from(pixels.slice(0, 4)), [51, 102, 153, 128]);
  assert.deepEqual(Array.from(pixels.slice(8, 12)), [200, 0, 0, 255]);
});

test('bucket filling is stable on already filled pixels and invalid targets', () => {
  const data = new Uint8ClampedArray([12, 34, 56, 255]);
  assert.equal(floodFillPixels(data, 1, 1, { x: 0, y: 0 }, '#0c2238', 1), 0);
  assert.equal(floodFillPixels(data, 1, 1, { x: 3, y: 0 }, '#ff00ff', 1), 0);
  assert.equal(floodFillPixels(data, 1, 1, { x: 0, y: 0 }, 'bad', 1), 0);
});

test('raster painting area is bounded and does not invent infinite pixels', () => {
  assert.ok(insidePaintArea({ x: 100, y: 100 }));
  assert.ok(!insidePaintArea({ x: -1, y: 5 }));
  assert.ok(!insidePaintArea({ x: 5000, y: 5 }));
});

test('raster image metadata can be serialized as a versioned room object', () => {
  const layer = {
    id: 'pixel-layer-01',
    type: 'image',
    src: 'data:image/png;base64,eA==',
    rasterLayer: { name: 'Highlights', blend: 'screen' },
    globalCompositeOperation: 'screen',
  };
  const result = JSON.parse(JSON.stringify(layer));
  assert.deepEqual(result.rasterLayer, { name: 'Highlights', blend: 'screen' });
  assert.equal(result.id, layer.id);
});
