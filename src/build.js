// Builds dist/index.html: a single self-contained file with the CSS, the JS
// modules and the data files inlined. Run with `npm run build`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const { version } = JSON.parse(read('package.json'));
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Bad version in package.json: ${version}`);

// Strip ES module syntax so the modules can be concatenated into one script.
function stripModule(src) {
  return src
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, '');
}

const modules = ['src/hebrewdate.js', 'src/sedra.js', 'src/data.js', 'src/app.js'];
const script = [
  '(() => {',
  "'use strict';",
  `const PARSHIYOT_PSV = ${JSON.stringify(read('data/parshiyot.psv'))};`,
  `const BOOKS_PSV = ${JSON.stringify(read('data/books.psv'))};`,
  `const TEXTS_CEX = ${JSON.stringify(read('data/texts.cex'))};`,
  ...modules.map((m) => `// ---- ${m} ----\n${stripModule(read(m))}`),
  '})();',
].join('\n');

if (/^\s*(import|export)\b/m.test(script)) throw new Error('Unstripped import/export left in bundle');
const safe = script.replace(/<\/script/gi, '<\\/script');

const html = read('src/index.html')
  .replace('/*STYLE*/', () => read('src/style.css'))
  .replace('/*SCRIPT*/', () => safe)
  .replaceAll('{{VERSION}}', version);

mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/index.html', root), html);
console.log(`Wrote dist/index.html, version ${version} (${(html.length / 1024).toFixed(1)} KB)`);
