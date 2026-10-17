// Extracts from the compnov corpus every verse cited in data/parshiyot.psv,
// in the versions named in data/books.psv, and writes them to data/texts.cex.
//
// Usage: node src/extract-texts.js [path-or-url-of-compnov.cex]
// Default source: the compnov.cex file on GitHub.
import { readFileSync, writeFileSync } from 'node:fs';
import { parsePsv, parseCitation, parseCex, segmentVerses } from './data.js';

const DEFAULT_SOURCE = 'https://raw.githubusercontent.com/neelsmith/compnov/refs/heads/main/corpus/compnov.cex';
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const source = process.argv[2] || DEFAULT_SOURCE;
async function load(src) {
  if (!/^https?:/.test(src)) return readFileSync(src, 'utf8');
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${src}`);
  return res.text();
}
const cexText = await load(source);

const parshiyot = parsePsv(read('data/parshiyot.psv'));
const bookUrns = new Map(parsePsv(read('data/books.psv')).map((r) => [r.book, r.urn]));
const corpus = parseCex(cexText, new Set(bookUrns.values()));

// Collect every cited verse
const wanted = new Map(); // work URN -> Set of refs
for (const row of parshiyot) {
  for (const col of ['parshah', 'haftarah_ashkenazi', 'haftarah_sephardi']) {
    for (const seg of parseCitation(row[col])) {
      const work = bookUrns.get(seg.book);
      if (!wanted.has(work)) wanted.set(work, new Set());
      for (const v of segmentVerses(seg, bookUrns, corpus)) wanted.get(work).add(v.ref);
    }
  }
}

// Write in books.psv order, each book in document order
const lines = [
  '// Verses cited in parshiyot.psv, extracted from the compnov corpus by src/extract-texts.js.',
  `// Source: ${source}`,
  '',
  '#!ctsdata',
];
let count = 0;
for (const work of bookUrns.values()) {
  const refs = wanted.get(work);
  if (!refs) continue;
  const w = corpus.get(work);
  w.refs.forEach((ref, i) => {
    if (refs.has(ref)) { lines.push(`${work}${ref}|${w.texts[i]}`); count++; }
  });
}
writeFileSync(new URL('data/texts.cex', root), lines.join('\n') + '\n');
console.log(`Wrote data/texts.cex: ${count} verses from ${wanted.size} books`);
