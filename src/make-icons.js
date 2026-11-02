// Makes the app icons from a square source image. Run with `npm run icons`
// (optionally: `npm run icons -- <source> <outDir>`). Needs sharp, a
// devDependency; the build itself does not.
//
// Writes icon-<size>.png for each size in SIZES and apple-touch-icon-180.png.
// The source is resized whole (centre-cropped to a square if it isn't one);
// the small sizes get a light sharpen so the columns of text stay legible.
// PNGs are palette-quantised (256 colours) to keep the inlined page small.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SIZES = [16, 32, 48, 64, 128, 192, 512];
export const APPLE = 180;

export async function makeIcons(src, outDir) {
  mkdirSync(outDir, { recursive: true });
  const written = [];
  const one = async (size, name) => {
    let img = sharp(src).resize(size, size, { fit: 'cover', position: 'centre' });
    if (size <= 48) img = img.sharpen({ sigma: 0.5 });
    const file = join(outDir, name);
    await img.png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 }).toFile(file);
    written.push(file);
  };
  for (const s of SIZES) await one(s, `icon-${s}.png`);
  await one(APPLE, `apple-touch-icon-${APPLE}.png`);
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = (p) => fileURLToPath(new URL(p, import.meta.url));
  const src = process.argv[2] ?? here('icons/nitzavim-1024.jpg');
  const out = process.argv[3] ?? here('icons/');
  const files = await makeIcons(src, out);
  console.log(`Wrote ${files.length} icons to ${out}`);
}
