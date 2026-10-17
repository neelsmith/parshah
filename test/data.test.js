import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePsv, parseCitation, segmentUrn } from '../src/data.js';

const read = (f) => readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8');
const parshiyot = parsePsv(read('parshiyot.psv'));
const books = new Map(parsePsv(read('books.psv')).map((r) => [r.book, r.urn]));

test('parshiyot.psv has 54 single and 7 combined rows with unique ids', () => {
  assert.equal(parshiyot.length, 61);
  assert.equal(new Set(parshiyot.map((r) => r.id)).size, 61);
});

test('every citation parses and every book has a URN', () => {
  for (const r of parshiyot) {
    for (const col of ['parshah', 'haftarah_ashkenazi', 'haftarah_sephardi']) {
      for (const seg of parseCitation(r[col])) assert.ok(segmentUrn(seg, books));
    }
  }
});

test('segment URNs', () => {
  const [a, b] = parseCitation('Isaiah 6:1-7:6; Isaiah 9:5-9:6');
  assert.equal(segmentUrn(a, books), 'urn:cts:compnov:bible.isaiah.masoretic:6.1-7.6');
  assert.equal(segmentUrn(b, books), 'urn:cts:compnov:bible.isaiah.masoretic:9.5-9.6');
  assert.equal(segmentUrn(parseCitation('Jeremiah 3:4')[0], books), 'urn:cts:compnov:bible.jeremiah.masoretic:3.4');
});

import { parseCex, segmentVerses } from '../src/data.js';
const corpus = parseCex(read('texts.cex'));

test('texts.cex has every verse of every citation, starting and ending at the cited verses', () => {
  for (const r of parshiyot) {
    for (const col of ['parshah', 'haftarah_ashkenazi', 'haftarah_sephardi']) {
      for (const seg of parseCitation(r[col])) {
        const verses = segmentVerses(seg, books, corpus);
        assert.equal(verses[0].ref, `${seg.from.chapter}.${seg.from.verse}`);
        assert.equal(verses.at(-1).ref, `${seg.to.chapter}.${seg.to.verse}`);
        for (const v of verses) assert.ok(v.text.trim().length > 0, `${seg.book} ${v.ref}`);
      }
    }
  }
});

test('texts.cex contains the whole Torah (compnov Masoretic verse counts)', () => {
  const counts = { genesis: 1533, exodus: 1213, leviticus: 859, numbers: 1289, deuteronomy: 959 };
  for (const [book, n] of Object.entries(counts)) {
    assert.equal(corpus.get(`urn:cts:compnov:bible.${book}.masoretic:`).refs.length, n, book);
  }
});

test('the 54 parshiyot cover the Torah with no gaps or overlaps', () => {
  const singles = parshiyot.filter((r) => /^p\d\d$/.test(r.id));
  const all = [];
  for (const r of singles) {
    const [seg] = parseCitation(r.parshah);
    for (const v of segmentVerses(seg, books, corpus)) all.push(`${seg.book} ${v.ref}`);
  }
  assert.equal(all.length, 1533 + 1213 + 859 + 1289 + 959);
  assert.equal(new Set(all).size, all.length);
});

test('each combined reading is exactly its two parts', () => {
  const byId = new Map(parshiyot.map((r) => [r.id, r]));
  for (const r of parshiyot.filter((x) => /^p\d\dp\d\d$/.test(x.id))) {
    const [a, b] = [byId.get(r.id.slice(0, 3)), byId.get(r.id.slice(3))];
    const first = parseCitation(a.parshah)[0], last = parseCitation(b.parshah)[0];
    assert.equal(r.parshah, `${first.book} ${first.from.chapter}:${first.from.verse}-${last.to.chapter}:${last.to.verse}`, r.id);
  }
});

test('segmentVerses spans chapters', () => {
  const v = segmentVerses(parseCitation('Isaiah 54:1-55:5')[0], books, corpus);
  assert.equal(v.length, 17 + 5);
  assert.deepEqual([v[0].chapter, v[0].verse, v.at(-1).chapter, v.at(-1).verse], [54, 1, 55, 5]);
});

import { stripCantillation } from '../src/data.js';
test('stripCantillation removes accents, meteg and paseq but keeps letters and vowels', () => {
  assert.equal(stripCantillation('בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים'), 'בְּרֵאשִׁית בָּרָא אֱלֹהִים');
  assert.equal(stripCantillation('הָאָֽרֶץ׃'), 'הָאָרֶץ׃');
  assert.equal(stripCantillation('עֹמְדִ֤ים ׀ מִמַּ֙עַל֙'), 'עֹמְדִים מִמַּעַל');
  for (const v of corpus.values()) for (const t of v.texts) {
    assert.ok(!/[֑-ֽ֯׀]/.test(stripCantillation(t)));
  }
});
