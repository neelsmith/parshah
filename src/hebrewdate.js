// Hebrew calendar arithmetic.
// Days are counted as "fixed" day numbers (R.D.): day 1 = Monday, 1 January 1 CE (proleptic Gregorian).
// Algorithms follow Dershowitz & Reingold, "Calendrical Calculations".

const HEBREW_EPOCH = -1373427; // R.D. of 1 Tishrei AM 1

const floorDiv = (a, b) => Math.floor(a / b);
const mod = (a, b) => ((a % b) + b) % b;

// ---------- Gregorian ----------

export function isGregorianLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Fixed day number from a Gregorian year, month (1-12) and day. */
export function fixedFromGregorian(year, month, day) {
  const y = year - 1;
  let f = 365 * y + floorDiv(y, 4) - floorDiv(y, 100) + floorDiv(y, 400)
    + floorDiv(367 * month - 362, 12) + day;
  if (month > 2) f -= isGregorianLeap(year) ? 1 : 2;
  return f;
}

/** {year, month (1-12), day} from a fixed day number. */
export function gregorianFromFixed(rd) {
  const d0 = rd - 1;
  const n400 = floorDiv(d0, 146097), d1 = mod(d0, 146097);
  const n100 = floorDiv(d1, 36524), d2 = mod(d1, 36524);
  const n4 = floorDiv(d2, 1461), d3 = mod(d2, 1461);
  const n1 = floorDiv(d3, 365);
  let year = 400 * n400 + 100 * n100 + 4 * n4 + n1;
  if (!(n100 === 4 || n1 === 4)) year += 1;
  const priorDays = rd - fixedFromGregorian(year, 1, 1);
  const correction = rd < fixedFromGregorian(year, 3, 1) ? 0 : (isGregorianLeap(year) ? 1 : 2);
  const month = floorDiv(12 * (priorDays + correction) + 373, 367);
  const day = rd - fixedFromGregorian(year, month, 1) + 1;
  return { year, month, day };
}

/** Parse "YYYY-MM-DD" into a fixed day number. */
export function fixedFromIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Bad ISO date: ${iso}`);
  return fixedFromGregorian(+m[1], +m[2], +m[3]);
}

export function isoFromFixed(rd) {
  const { year, month, day } = gregorianFromFixed(rd);
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(year, 4)}-${p(month, 2)}-${p(day, 2)}`;
}

/** Day of week, 0 = Sunday ... 6 = Shabbat. */
export function dayOfWeek(rd) {
  return mod(rd, 7);
}

// ---------- Hebrew ----------

export function isHebrewLeap(y) {
  return mod(7 * y + 1, 19) < 7;
}

function elapsedDays(y) {
  const monthsElapsed = floorDiv(235 * y - 234, 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  const day = 29 * monthsElapsed + floorDiv(partsElapsed, 25920);
  return mod(3 * (day + 1), 7) < 3 ? day + 1 : day;
}

function yearLengthCorrection(y) {
  const ny0 = elapsedDays(y - 1), ny1 = elapsedDays(y), ny2 = elapsedDays(y + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

/** Fixed day number of 1 Tishrei of Hebrew year y. */
export function hebrewNewYear(y) {
  return HEBREW_EPOCH + elapsedDays(y) + yearLengthCorrection(y);
}

export function daysInHebrewYear(y) {
  return hebrewNewYear(y + 1) - hebrewNewYear(y);
}

/**
 * Month keys in civil (Tishrei-first) order for year y.
 * Non-leap years have "Adar"; leap years have "Adar I" and "Adar II".
 */
export function monthsOfYear(y) {
  const adar = isHebrewLeap(y) ? ['Adar I', 'Adar II'] : ['Adar'];
  return ['Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', ...adar,
    'Nisan', 'Iyyar', 'Sivan', 'Tammuz', 'Av', 'Elul'];
}

export function daysInHebrewMonth(y, month) {
  const len = daysInHebrewYear(y);
  switch (month) {
    case 'Cheshvan': return len % 10 === 5 ? 30 : 29;
    case 'Kislev': return len % 10 === 3 ? 29 : 30;
    case 'Tishrei': case 'Shevat': case 'Adar I': case 'Nisan': case 'Sivan': case 'Av': return 30;
    default: return 29; // Tevet, Adar, Adar II, Iyyar, Tammuz, Elul
  }
}

/** Fixed day number of day `day` of `month` in Hebrew year y. Month "Adar" in a leap year means Adar II. */
export function fixedFromHebrew(y, month, day) {
  if (month === 'Adar' && isHebrewLeap(y)) month = 'Adar II';
  let rd = hebrewNewYear(y);
  for (const m of monthsOfYear(y)) {
    if (m === month) return rd + day - 1;
    rd += daysInHebrewMonth(y, m);
  }
  throw new Error(`No month ${month} in year ${y}`);
}

/** {year, month, day} for a fixed day number. */
export function hebrewFromFixed(rd) {
  let y = floorDiv(rd - HEBREW_EPOCH, 366) + 1; // lower bound estimate
  while (hebrewNewYear(y + 1) <= rd) y++;
  let start = hebrewNewYear(y);
  for (const m of monthsOfYear(y)) {
    const n = daysInHebrewMonth(y, m);
    if (rd < start + n) return { year: y, month: m, day: rd - start + 1 };
    start += n;
  }
  throw new Error('unreachable');
}

// ---------- Display ----------

export const HEBREW_MONTH_NAMES = {
  Tishrei: 'תשרי', Cheshvan: 'חשון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט',
  Adar: 'אדר', 'Adar I': 'אדר א׳', 'Adar II': 'אדר ב׳', Nisan: 'ניסן', Iyyar: 'אייר',
  Sivan: 'סיון', Tammuz: 'תמוז', Av: 'אב', Elul: 'אלול',
};

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/** Hebrew numeral (gematria) for 1..999, with geresh/gershayim punctuation. */
export function gematriya(n) {
  n = n % 1000;
  let s = '';
  while (n >= 400) { s += 'ת'; n -= 400; }
  s += HUNDREDS[Math.floor(n / 100)]; n %= 100;
  if (n === 15) s += 'טו';
  else if (n === 16) s += 'טז';
  else s += TENS[Math.floor(n / 10)] + ONES[n % 10];
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
}

/** e.g. "15 Cheshvan 5787" */
export function formatHebrewDate({ year, month, day }) {
  return `${day} ${month} ${year}`;
}

/** e.g. "ט״ו חשון תשפ״ז" */
export function formatHebrewDateHe({ year, month, day }) {
  return `${gematriya(day)} ${HEBREW_MONTH_NAMES[month]} ${gematriya(year)}`;
}
