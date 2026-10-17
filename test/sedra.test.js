// Compares our parshah schedule with @hebcal/core (used only as a test oracle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate, Sedra } from '@hebcal/core';
import * as H from '../src/hebrewdate.js';
import { readingForShabbat, readingForWeek, shabbatOnOrAfter, portionId } from '../src/sedra.js';
import { parsePsv } from '../src/data.js';

const parshiyot = parsePsv(readFileSync(new URL('../data/parshiyot.psv', import.meta.url), 'utf8'));
const idByLabel = new Map(parshiyot.map((r) => [r.label, r.id]));

for (const israel of [false, true]) {
  test(`every Shabbat 1900-2100 matches Hebcal (${israel ? 'Israel' : 'Diaspora'})`, () => {
    const start = shabbatOnOrAfter(H.fixedFromGregorian(1900, 1, 1));
    const end = H.fixedFromGregorian(2100, 12, 31);
    const sedras = new Map();
    for (let d = start; d <= end; d += 7) {
      const g = H.gregorianFromFixed(d);
      const hd = new HDate(new Date(g.year, g.month - 1, g.day));
      const y = hd.getFullYear();
      if (!sedras.has(y)) sedras.set(y, new Sedra(y, israel));
      const theirs = sedras.get(y).lookup(hd);
      const ours = readingForShabbat(d, israel);
      const where = `${H.isoFromFixed(d)} (${israel ? 'IL' : 'DI'})`;
      if (theirs.chag) {
        assert.ok(ours.festival, `${where}: expected festival, got ${JSON.stringify(ours)}`);
      } else {
        const expected = theirs.parsha.join('-');
        assert.ok(ours.portions, `${where}: expected ${expected}, got ${JSON.stringify(ours)}`);
        assert.equal(portionId(ours.portions), idByLabel.get(expected), `${where}: expected ${expected}`);
      }
    }
  });
}

test('every portion id produced exists in parshiyot.psv', () => {
  const ids = new Set(parshiyot.map((r) => r.id));
  for (const israel of [false, true]) {
    for (let d = shabbatOnOrAfter(H.fixedFromGregorian(2000, 1, 1)); d < H.fixedFromGregorian(2100, 1, 1); d += 7) {
      const r = readingForShabbat(d, israel);
      if (r.portions) assert.ok(ids.has(portionId(r.portions)), portionId(r.portions));
    }
  }
});

test('week runs Sunday to Shabbat', () => {
  const sun = H.fixedFromIso('2026-10-11'), sat = H.fixedFromIso('2026-10-17');
  for (let d = sun; d <= sat; d++) assert.equal(readingForWeek(d, false).shabbat, sat);
  assert.equal(readingForWeek(sat + 1, false).shabbat, sat + 7);
  assert.equal(readingForWeek(sat, false).id, 'p02'); // Noach
});
