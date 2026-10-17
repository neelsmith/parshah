// Parsing helpers for the pipe-delimited data files in data/.

/** Parse a pipe-delimited file with a header row into an array of objects. */
export function parsePsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0].split('|');
  return lines.slice(1).map((line) => {
    const cells = line.split('|');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

/**
 * Parse a citation such as "Isaiah 6:1-7:6; Isaiah 9:5-9:6" into segments
 * [{book, from: {chapter, verse}, to: {chapter, verse}}].
 */
export function parseCitation(citation) {
  return citation.split('; ').map((seg) => {
    const m = /^(.*\D) (\d+):(\d+)(?:-(\d+):(\d+))?$/.exec(seg);
    if (!m) throw new Error(`Bad citation segment: ${seg}`);
    const from = { chapter: +m[2], verse: +m[3] };
    const to = m[4] ? { chapter: +m[4], verse: +m[5] } : from;
    return { book: m[1], from, to };
  });
}

/** CTS URN for a citation segment, given a map book -> book-level URN. */
export function segmentUrn(seg, bookUrns) {
  const base = bookUrns.get(seg.book);
  if (!base) throw new Error(`No URN for book ${seg.book}`);
  const a = `${seg.from.chapter}.${seg.from.verse}`, b = `${seg.to.chapter}.${seg.to.verse}`;
  return a === b ? base + a : `${base}${a}-${b}`;
}

/**
 * Parse the ctsdata blocks of a CEX file into a corpus:
 * Map from version-level URN (ending in ":") to
 * { refs: [passage refs in document order], texts: [...], index: Map ref -> position }.
 * Only books whose URN is in `onlyUrns` (a Set) are kept, when given.
 */
export function parseCex(text, onlyUrns = null) {
  const corpus = new Map();
  let inData = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#!')) { inData = line.trim() === '#!ctsdata'; continue; }
    if (!inData || !line.startsWith('urn:')) continue;
    const bar = line.indexOf('|');
    const urn = line.slice(0, bar);
    const colon = urn.lastIndexOf(':');
    const work = urn.slice(0, colon + 1), ref = urn.slice(colon + 1);
    if (onlyUrns && !onlyUrns.has(work)) continue;
    if (!corpus.has(work)) corpus.set(work, { refs: [], texts: [], index: new Map() });
    const w = corpus.get(work);
    w.index.set(ref, w.refs.length);
    w.refs.push(ref);
    w.texts.push(line.slice(bar + 1));
  }
  return corpus;
}

/**
 * Verses of one citation segment, in document order:
 * [{ ref: "6.1", chapter, verse, text }].
 */
export function segmentVerses(seg, bookUrns, corpus) {
  const base = bookUrns.get(seg.book);
  const w = base && corpus.get(base);
  if (!w) throw new Error(`No text for book ${seg.book}`);
  const a = w.index.get(`${seg.from.chapter}.${seg.from.verse}`);
  const b = w.index.get(`${seg.to.chapter}.${seg.to.verse}`);
  if (a === undefined || b === undefined || b < a) {
    throw new Error(`Cannot resolve ${seg.book} ${seg.from.chapter}:${seg.from.verse}-${seg.to.chapter}:${seg.to.verse}`);
  }
  const out = [];
  for (let i = a; i <= b; i++) {
    const [chapter, verse] = w.refs[i].split('.');
    out.push({ ref: w.refs[i], chapter: +chapter, verse: +verse, text: w.texts[i] });
  }
  return out;
}

/**
 * Remove cantillation marks (te'amim) from pointed Hebrew, keeping consonants,
 * vowel points, dagesh, shin/sin dots, rafe, maqaf and sof pasuq.
 * Removes U+0591-U+05AF (accents), U+05BD (meteg) and U+05C0 (paseq).
 */
export function stripCantillation(text) {
  return text
    .replace(/[\u0591-\u05AF\u05BD]/g, '')
    .replace(/\s*\u05C0\s*/g, ' ')
    .replace(/ {2,}/g, ' ');
}
