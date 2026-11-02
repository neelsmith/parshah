// Icon <link> tags for the build: the PNGs made by `npm run icons` are
// inlined as data: URIs so dist/index.html stays a single file.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Files inlined into the page (the larger sizes are kept for other uses).
export const PAGE_ICONS = [
  { file: 'icon-16.png', rel: 'icon', sizes: '16x16' },
  { file: 'icon-32.png', rel: 'icon', sizes: '32x32' },
  { file: 'icon-48.png', rel: 'icon', sizes: '48x48' },
  { file: 'icon-192.png', rel: 'icon', sizes: '192x192' },
  { file: 'apple-touch-icon-180.png', rel: 'apple-touch-icon', sizes: '180x180' },
];

// Returns { html, missing }: the <link> tags for the icons found in dir and
// the names of any that are missing.
export function iconLinks(dir) {
  const tags = [];
  const missing = [];
  for (const { file, rel, sizes } of PAGE_ICONS) {
    const path = join(dir, file);
    if (!existsSync(path)) { missing.push(file); continue; }
    const b64 = readFileSync(path).toString('base64');
    tags.push(`<link rel="${rel}" type="image/png" sizes="${sizes}" href="data:image/png;base64,${b64}">`);
  }
  return { html: tags.join('\n'), missing };
}
