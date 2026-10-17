// Weekly Torah reading (parshah) schedule.
//
// The year is split into segments bounded by fixed anchors, and each segment's
// portions are fitted into its available Shabbatot by joining "double" portions
// in a fixed priority order:
//
//   Tishrei (before Sukkot)    Vayeilech / Ha'azinu
//   Bereshit .. Shavuot        leap year: one portion per Shabbat, no joins.
//                              Non-leap year, two segments:
//                              Bereshit..Tzav (the Shabbat before Pesach),
//                              joining Vayakhel-Pekudei if needed; then
//                              Shmini..Bamidbar (the Shabbat before Shavuot),
//                              joining Tazria-Metzora, Achrei Mot-Kedoshim,
//                              Behar-Bechukotai in that order as needed
//   Shavuot .. Tisha b'Av      ..Masei; join Matot-Masei, then Chukat-Balak
//   Tisha b'Av .. Rosh Hashana Devarim (Shabbat on or before 9 Av) .. Nitzavim,
//                              joining Nitzavim-Vayeilech when the next Tishrei
//                              has only one free Shabbat before Sukkot.
//
// Portions are numbered 1 (Bereshit) .. 54 (Vezot Haberakhah), matching the
// ids p01..p54 in data/parshiyot.psv.

import {
  dayOfWeek, hebrewFromFixed, fixedFromHebrew, hebrewNewYear, isHebrewLeap,
} from './hebrewdate.js';

const SHABBAT = 6;
const VAYAKHEL = 22, TZAV = 25, TAZRIA = 27, ACHREI_MOT = 29, BEHAR = 32, BAMIDBAR = 34,
  NASO = 35, CHUKAT = 39, MATOT = 42, MASEI = 43, DEVARIM = 44, NITZAVIM = 51,
  VAYEILECH = 52, HAAZINU = 53;

/** Shabbat on or after fixed day rd. */
export function shabbatOnOrAfter(rd) {
  return rd + ((SHABBAT - dayOfWeek(rd) + 7) % 7);
}
/** Shabbat on or before fixed day rd. */
export function shabbatOnOrBefore(rd) {
  return rd - ((dayOfWeek(rd) - SHABBAT + 7) % 7);
}

/**
 * Name of the festival that falls on a given Hebrew date and displaces the
 * weekly reading, or null.
 */
export function festivalOn({ month, day }, israel) {
  if (month === 'Tishrei') {
    if (day === 1 || day === 2) return 'Rosh Hashanah';
    if (day === 10) return 'Yom Kippur';
    if (day === 15 || (day === 16 && !israel)) return 'Sukkot';
    if (day >= 16 && day <= 21) return 'Sukkot (Chol HaMoed)';
    if (day === 22) return israel ? 'Shmini Atzeret / Simchat Torah' : 'Shmini Atzeret';
    if (day === 23 && !israel) return 'Simchat Torah';
  } else if (month === 'Nisan') {
    if (day === 15 || (day === 16 && !israel)) return 'Pesach';
    if (day >= 16 && day <= 20) return 'Pesach (Chol HaMoed)';
    if (day === 21 || (day === 22 && !israel)) return 'Pesach';
  } else if (month === 'Sivan') {
    if (day === 6 || (day === 7 && !israel)) return 'Shavuot';
  }
  return null;
}

/** Non-festival Shabbatot in the inclusive fixed-day range [from, to]. */
function freeShabbatot(from, to, israel) {
  const out = [];
  for (let d = shabbatOnOrAfter(from); d <= to; d += 7) {
    if (!festivalOn(hebrewFromFixed(d), israel)) out.push(d);
  }
  return out;
}

/**
 * Fit portions first..last into the given Shabbatot, joining pairs (identified
 * by their first portion number) in priority order until they fit.
 * Returns an array of portion-number arrays, one per Shabbat.
 */
function fit(first, last, slots, joinPriority) {
  const count = last - first + 1;
  const needed = count - slots.length;
  const usable = joinPriority.filter((p) => p >= first && p + 1 <= last);
  if (needed < 0 || needed > usable.length) {
    throw new Error(`Cannot fit portions ${first}-${last} into ${slots.length} Shabbatot`);
  }
  const joined = new Set(usable.slice(0, needed));
  const readings = [];
  for (let p = first; p <= last; p++) {
    if (joined.has(p)) { readings.push([p, p + 1]); p++; } else readings.push([p]);
  }
  return readings;
}

/** Free Shabbatot in Tishrei of year y before Sukkot (1 or 2 of them). */
function tishreiSlots(y, israel) {
  return freeShabbatot(fixedFromHebrew(y, 'Tishrei', 1), fixedFromHebrew(y, 'Tishrei', 14), israel);
}

const cache = new Map();

/**
 * Map from fixed day of each Shabbat in Hebrew year y (1 Tishrei .. 29 Elul)
 * to a reading: { portions: [n] | [n, n+1] } or { festival: name }.
 */
export function scheduleForYear(y, israel) {
  const key = `${y}:${israel ? 'IL' : 'DI'}`;
  if (cache.has(key)) return cache.get(key);

  const sched = new Map();
  const assign = (slots, readings) => slots.forEach((d, i) => sched.set(d, { portions: readings[i] }));
  const H = (m, d) => fixedFromHebrew(y, m, d);

  // Festival Shabbatot
  for (let d = shabbatOnOrAfter(hebrewNewYear(y)); d < hebrewNewYear(y + 1); d += 7) {
    const f = festivalOn(hebrewFromFixed(d), israel);
    if (f) sched.set(d, { festival: f });
  }

  // Tishrei: Vayeilech (if not joined to Nitzavim last year) and Ha'azinu
  const tSlots = tishreiSlots(y, israel);
  assign(tSlots, tSlots.length === 2 ? [[VAYEILECH], [HAAZINU]] : [[HAAZINU]]);

  let next;
  const bereshitStart = H('Tishrei', israel ? 23 : 24);
  if (isHebrewLeap(y)) {
    // Leap year: one portion per Shabbat from Bereshit until Shavuot
    const s1 = freeShabbatot(bereshitStart, H('Sivan', 5), israel);
    assign(s1, s1.map((_, i) => [1 + i]));
    next = 1 + s1.length;
  } else {
    // Bereshit .. Tzav, the Shabbat before Pesach
    const s1 = freeShabbatot(bereshitStart, H('Nisan', 14), israel);
    assign(s1, fit(1, TZAV, s1, [VAYAKHEL]));
    // Shmini .. Bamidbar, the Shabbat before Shavuot
    const s2 = freeShabbatot(H('Nisan', 15), H('Sivan', 5), israel);
    assign(s2, fit(TZAV + 1, BAMIDBAR, s2, [TAZRIA, ACHREI_MOT, BEHAR]));
    next = NASO;
  }

  // Shavuot .. Devarim
  const devarimDay = shabbatOnOrBefore(H('Av', 9));
  const s3 = freeShabbatot(H('Sivan', 6), devarimDay - 1, israel);
  assign(s3, fit(next, MASEI, s3, [MATOT, CHUKAT]));

  // Devarim .. Rosh Hashanah
  const s4 = freeShabbatot(devarimDay, H('Elul', 29), israel);
  const joinNitzavim = tishreiSlots(y + 1, israel).length === 1;
  assign(s4, fit(DEVARIM, joinNitzavim ? VAYEILECH : NITZAVIM, s4, [NITZAVIM]));

  cache.set(key, sched);
  return sched;
}

/** Reading for the Shabbat that is fixed day `shabbat`. */
export function readingForShabbat(shabbat, israel) {
  if (dayOfWeek(shabbat) !== SHABBAT) throw new Error('Not a Shabbat');
  const { year } = hebrewFromFixed(shabbat);
  const r = scheduleForYear(year, israel).get(shabbat);
  if (!r) throw new Error(`No reading computed for Shabbat ${shabbat}`);
  return r;
}

/** Portion id(s) as used in data/parshiyot.psv: [27] -> "p27", [27,28] -> "p27p28". */
export function portionId(portions) {
  return portions.map((p) => 'p' + String(p).padStart(2, '0')).join('');
}

/** Reading for the Sunday–Shabbat week containing fixed day rd. */
export function readingForWeek(rd, israel) {
  const shabbat = shabbatOnOrAfter(rd);
  const reading = readingForShabbat(shabbat, israel);
  return { shabbat, ...reading, id: reading.portions ? portionId(reading.portions) : null };
}
