// Browser UI. In the built file this runs after hebrewdate.js, sedra.js and data.js,
// with PARSHIYOT_PSV, BOOKS_PSV and TEXTS_CEX defined by the build.

import {
  fixedFromGregorian, fixedFromIso, isoFromFixed, gregorianFromFixed, hebrewFromFixed,
  formatHebrewDate, formatHebrewDateHe,
} from './hebrewdate.js';
import { readingForWeek } from './sedra.js';
import { parsePsv, parseCitation, parseCex, segmentVerses, segmentUrn, stripCantillation } from './data.js';

const PREFS_KEY = 'parshah.prefs';

function startApp() {
  const parshiyot = new Map(parsePsv(PARSHIYOT_PSV).map((r) => [r.id, r]));
  const bookUrns = new Map(parsePsv(BOOKS_PSV).map((r) => [r.book, r.urn]));
  let corpus = null; // parsed on first use
  let openText = null; // 'torah' | 'haftarah' | null
  let current = null;  // { torah, haftarah } citations for the displayed week
  const $ = (id) => document.getElementById(id);
  const dateInput = $('date');

  const prefs = loadPrefs();
  setSegmented('location', prefs.israel ? 'israel' : 'diaspora');
  setSegmented('tradition', prefs.sephardi ? 'sephardi' : 'ashkenazi');
  $('cantillation').checked = prefs.cantillation !== false;
  $('cantillation').addEventListener('change', () => { savePrefs(); renderText(); });

  const hashDate = /^#(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
  dateInput.value = hashDate ? hashDate[1] : todayIso();

  dateInput.addEventListener('change', render);
  $('today').addEventListener('click', () => { dateInput.value = todayIso(); render(); });
  $('prev').addEventListener('click', () => shiftWeek(-7));
  $('next').addEventListener('click', () => shiftWeek(7));
  for (const group of ['location', 'tradition']) {
    for (const btn of document.querySelectorAll(`[data-group="${group}"] button`)) {
      btn.addEventListener('click', () => { setSegmented(group, btn.dataset.value); savePrefs(); render(); });
    }
  }
  for (const btn of document.querySelectorAll('button.cite')) {
    btn.addEventListener('click', () => {
      openText = openText === btn.dataset.kind ? null : btn.dataset.kind;
      renderText();
      if (openText) $('text-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  $('text-close').addEventListener('click', () => { openText = null; renderText(); });
  window.addEventListener('hashchange', () => {
    const m = /^#(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
    if (m && m[1] !== dateInput.value) { dateInput.value = m[1]; render(); }
  });
  render();

  function shiftWeek(days) {
    const rd = validRd();
    if (rd === null) return;
    dateInput.value = isoFromFixed(rd + days);
    render();
  }

  function validRd() {
    try {
      const rd = fixedFromIso(dateInput.value);
      const { year } = gregorianFromFixed(rd);
      return year >= 1 && year <= 9999 ? rd : null;
    } catch { return null; }
  }

  function render() {
    const rd = validRd();
    if (rd === null) { $('result').hidden = true; return; }
    $('result').hidden = false;
    if (location.hash !== '#' + dateInput.value) history.replaceState(null, '', '#' + dateInput.value);

    const israel = getSegmented('location') === 'israel';
    const sephardi = getSegmented('tradition') === 'sephardi';

    // Selected date
    const hd = hebrewFromFixed(rd);
    $('civil').textContent = formatCivil(rd);
    $('hebrew').textContent = formatHebrewDate(hd);
    $('hebrew-he').textContent = formatHebrewDateHe(hd);
    $('evening').textContent = `From sunset, the Hebrew date is ${formatHebrewDate(hebrewFromFixed(rd + 1))}.`;

    // The week's reading
    const week = readingForWeek(rd, israel);
    $('shabbat').textContent =
      `${rd === week.shabbat ? 'This Shabbat' : 'Shabbat'}: ${formatCivil(week.shabbat)} · ${formatHebrewDate(hebrewFromFixed(week.shabbat))}`;

    if (week.festival) {
      $('parshah-name').textContent = week.festival;
      $('parshah-he').textContent = '';
      $('festival-note').hidden = false;
      $('readings').hidden = true;
      $('cite-hint').hidden = true;
      current = null;
      renderText();
      return;
    }
    const p = parshiyot.get(week.id);
    $('parshah-name').textContent = p.label;
    $('parshah-he').textContent = p.hebrew;
    $('festival-note').hidden = true;
    $('readings').hidden = false;
    $('torah').textContent = p.parshah;
    $('haftarah').textContent = sephardi ? p.haftarah_sephardi : p.haftarah_ashkenazi;
    $('haftarah-label').textContent = `Haftarah (${sephardi ? 'Sephardi' : 'Ashkenazi'})`;
    $('cite-hint').hidden = false;
    current = {
      torah: { title: `${p.label}: ${p.parshah}`, citation: p.parshah },
      haftarah: {
        title: `Haftarah for ${p.label} (${sephardi ? 'Sephardi' : 'Ashkenazi'}): ${$('haftarah').textContent}`,
        citation: $('haftarah').textContent,
      },
    };
    renderText();
  }

  function renderText() {
    const panel = $('text-panel');
    for (const btn of document.querySelectorAll('button.cite')) {
      btn.setAttribute('aria-expanded', String(btn.dataset.kind === openText && !!current));
    }
    if (!openText || !current) { panel.hidden = true; return; }
    if (!corpus) corpus = parseCex(TEXTS_CEX);
    const { title, citation } = current[openText];
    $('text-title').textContent = title;
    const showTeamim = $('cantillation').checked;
    const body = $('text-body');
    body.replaceChildren();
    for (const seg of parseCitation(citation)) {
      const block = el('div', 'segment');
      const label = `${seg.book} ${seg.from.chapter}:${seg.from.verse}` +
        (seg.to === seg.from ? '' : `-${seg.to.chapter}:${seg.to.verse}`);
      const h = el('h4', null, label);
      h.lang = 'en';
      block.append(h, el('code', 'urn', segmentUrn(seg, bookUrns)));
      let para = null, chapter = null;
      for (const v of segmentVerses(seg, bookUrns, corpus)) {
        if (v.chapter !== chapter) { para = el('p'); block.append(para); chapter = v.chapter; }
        const num = el('span', 'vn', `${v.chapter}:${v.verse}`);
        num.dir = 'ltr';
        para.append(num, document.createTextNode((showTeamim ? v.text : stripCantillation(v.text)) + ' '));
      }
      body.append(block);
    }
    panel.hidden = false;
  }

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        israel: getSegmented('location') === 'israel',
        sephardi: getSegmented('tradition') === 'sephardi',
        cantillation: $('cantillation').checked,
      }));
    } catch { /* storage unavailable: preferences just aren't remembered */ }
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function todayIso() {
  const now = new Date();
  return isoFromFixed(fixedFromGregorian(now.getFullYear(), now.getMonth() + 1, now.getDate()));
}

function formatCivil(rd) {
  const { year, month, day } = gregorianFromFixed(rd);
  const d = new Date(Date.UTC(2000, month - 1, day));
  d.setUTCFullYear(year);
  return d.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

function setSegmented(group, value) {
  for (const btn of document.querySelectorAll(`[data-group="${group}"] button`)) {
    btn.setAttribute('aria-pressed', String(btn.dataset.value === value));
  }
}
function getSegmented(group) {
  return document.querySelector(`[data-group="${group}"] button[aria-pressed="true"]`).dataset.value;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
  else startApp();
}
