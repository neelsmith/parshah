// Compares our calendar arithmetic with @hebcal/core (used only as a test oracle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HDate, gematriya as hcGematriya } from '@hebcal/core';
import * as H from '../src/hebrewdate.js';

// Hebcal month names -> ours
const MONTHS = {
  Tishrei: 'Tishrei', Cheshvan: 'Cheshvan', Kislev: 'Kislev', Tevet: 'Tevet', "Sh'vat": 'Shevat',
  Adar: 'Adar', 'Adar I': 'Adar I', 'Adar II': 'Adar II', Nisan: 'Nisan', Iyyar: 'Iyyar',
  Sivan: 'Sivan', Tamuz: 'Tammuz', Av: 'Av', Elul: 'Elul',
};

test('Gregorian round trip and day of week, 1800-2200', () => {
  const start = H.fixedFromGregorian(1800, 1, 1), end = H.fixedFromGregorian(2200, 12, 31);
  for (let rd = start; rd <= end; rd++) {
    const g = H.gregorianFromFixed(rd);
    assert.equal(H.fixedFromGregorian(g.year, g.month, g.day), rd);
    const js = new Date(Date.UTC(g.year, g.month - 1, g.day));
    assert.equal(H.dayOfWeek(rd), js.getUTCDay());
  }
});

test('ISO helpers', () => {
  assert.equal(H.isoFromFixed(H.fixedFromIso('2026-10-17')), '2026-10-17');
  assert.equal(H.dayOfWeek(H.fixedFromIso('2026-10-17')), 6);
});

test('Hebrew date of every day 1900-2100 matches Hebcal', () => {
  const start = H.fixedFromGregorian(1900, 1, 1), end = H.fixedFromGregorian(2100, 12, 31);
  for (let rd = start; rd <= end; rd++) {
    const g = H.gregorianFromFixed(rd);
    const hd = new HDate(new Date(g.year, g.month - 1, g.day));
    const ours = H.hebrewFromFixed(rd);
    const theirs = { year: hd.getFullYear(), month: MONTHS[hd.getMonthName()], day: hd.getDate() };
    assert.deepEqual(ours, theirs, `on ${H.isoFromFixed(rd)}`);
    assert.equal(H.fixedFromHebrew(ours.year, ours.month, ours.day), rd);
  }
});

test('Year lengths 5000-6500 are valid and match Hebcal', () => {
  for (let y = 5000; y <= 6500; y++) {
    const len = H.daysInHebrewYear(y);
    assert.ok([353, 354, 355, 383, 384, 385].includes(len), `year ${y}: ${len}`);
    assert.equal(len, HDate.daysInYear(y), `year ${y}`);
    assert.ok([1, 2, 4, 6].includes(H.dayOfWeek(H.hebrewNewYear(y))), `Rosh Hashanah ${y}`);
  }
});

test('gematriya matches Hebcal for 1-999', () => {
  for (let n = 1; n < 1000; n++) assert.equal(H.gematriya(n), hcGematriya(n), `n=${n}`);
  assert.equal(H.gematriya(5787), 'תשפ״ז');
});
