const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '../lib/sticker-render.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const sandbox = { exports: {}, require };
vm.runInNewContext(compiled, sandbox);
const { normalizeSvg, svgSize, stickerPngDataUrl } = sandbox.exports;

test('reads sticker dimensions from viewBox even without explicit width and height', () => {
  const size = svgSize('<svg viewBox="0 0 180 210"></svg>');
  assert.equal(size.width, 180);
  assert.equal(size.height, 210);
});

test('normalizes SVG namespace and explicit dimensions for browser decoding', () => {
  const source = normalizeSvg('<svg viewBox="0 0 80 90"><path d="M1 2"/></svg>');
  assert.match(source, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(source, /width="80"/);
  assert.match(source, /height="90"/);
});

test('does not duplicate dimensions on already well-formed artwork', () => {
  const source = normalizeSvg('<svg width="160" height="120" viewBox="0 0 160 120"/>');
  assert.equal((source.match(/\bwidth=/g) || []).length, 1);
  assert.equal((source.match(/\bheight=/g) || []).length, 1);
});

test('rejects unsafe or non-svg input', () => {
  assert.throws(() => normalizeSvg('<script>alert(1)</script>'));
  assert.throws(() => normalizeSvg('<svg onload="bad()"></svg>'));
});

test('rejects arbitrary external or local file paths', async () => {
  await assert.rejects(stickerPngDataUrl('https://example.com/sticker.svg'));
  await assert.rejects(stickerPngDataUrl('/secret/sticker.svg'));
});
