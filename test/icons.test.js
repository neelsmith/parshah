import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconLinks, PAGE_ICONS } from '../src/icons.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const iconsDir = fileURLToPath(new URL('../src/icons/', import.meta.url));

test('iconLinks inlines each icon as a data URI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'icons-'));
  for (const { file } of PAGE_ICONS) writeFileSync(join(dir, file), PNG);
  const { html, missing } = iconLinks(dir);
  assert.deepEqual(missing, []);
  assert.equal(html.match(/<link /g).length, PAGE_ICONS.length);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="data:image\/png;base64,iVBORw0KGgo=">/);
  assert.match(html, /rel="apple-touch-icon"[^>]*sizes="180x180"/);
});

test('iconLinks reports missing icons and skips them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'icons-'));
  writeFileSync(join(dir, 'icon-16.png'), PNG);
  const { html, missing } = iconLinks(dir);
  assert.equal(html.match(/<link /g).length, 1);
  assert.equal(missing.length, PAGE_ICONS.length - 1);
  assert.ok(missing.includes('apple-touch-icon-180.png'));
});

test('the generated icons are in src/icons', () => {
  for (const { file } of PAGE_ICONS) {
    const path = join(iconsDir, file);
    assert.ok(existsSync(path), `${file} missing: run npm run icons`);
    assert.deepEqual(readFileSync(path).subarray(0, 8), PNG);
  }
});

// Only runs where sharp is installed (npm install).
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* not installed */ }

test('makeIcons writes every size at the right dimensions', { skip: !sharp && 'sharp not installed' }, async () => {
  const { makeIcons, SIZES, APPLE } = await import('../src/make-icons.js');
  const src = join(mkdtempSync(join(tmpdir(), 'src-')), 'wide.png');
  await sharp({ create: { width: 300, height: 200, channels: 3, background: '#c9b' } }).png().toFile(src);
  const out = mkdtempSync(join(tmpdir(), 'out-'));
  const files = await makeIcons(src, out);
  assert.equal(files.length, SIZES.length + 1);
  for (const s of SIZES) {
    const m = await sharp(join(out, `icon-${s}.png`)).metadata();
    assert.equal(m.width, s); assert.equal(m.height, s); assert.equal(m.format, 'png');
  }
  const a = await sharp(join(out, `apple-touch-icon-${APPLE}.png`)).metadata();
  assert.equal(a.width, APPLE);
});
