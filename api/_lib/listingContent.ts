// Listing descriptions, cleaned for display. Shared by the server render
// (api/listing.ts — what crawlers read) and the React listing page, so both
// show exactly the same text. Dependency-free: it runs in Node and in the
// browser, on strings only (no DOM).
//
// The feed gives two fields:
//   GeneralBoatDescription      — HTML; a string OR an array of strings.
//   AdditionalDetailDescription — an array of HTML sections, each starting
//                                 "<strong>Section Title</strong><br>".
// Both arrive with pasted-in inline styles, fonts, spans, links and the
// occasional script. Everything is reduced to a small tag allowlist with no
// attributes at all, so the result is safe to inject as HTML.
//
// PlsDisclaimer (the co-brokerage "centrally listed by …" line) never passes
// through this module: it is shown exactly as BoatsGroup sends it.

/** Tags kept, attribute-free. Everything else is dropped and its text kept. */
const ALLOWED = new Set([
  'p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'h3', 'h4',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);
const INLINE = new Set(['strong', 'b', 'em', 'i']);
/** Not allowed, but renamed rather than dropped so structure survives. */
const RENAME: Record<string, string> = { h1: 'h3', h2: 'h3', h5: 'h4', h6: 'h4' };
/** Not allowed; closing one ends a line. */
const BLOCKISH = new Set(['div', 'section', 'article', 'header', 'footer', 'blockquote', 'pre', 'center']);
/** Removed together with everything inside them. */
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|svg|head|title|form|select|textarea|video|audio|template)\b[\s\S]*?<\/\1\s*>/gi;

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

const escText = (s: string): string =>
  s
    .replace(/&nbsp;|&#160;|&#xa0;| /gi, ' ')
    // A bare ampersand is escaped; an existing entity is left alone.
    .replace(/&(?!#\d+;|#x[0-9a-f]+;|[a-z][a-z0-9]{1,30};)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

type Token = { text: string } | { tag: string; close: boolean };

function tokenize(html: string): Token[] {
  const src = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROP_WITH_CONTENT, '')
    .replace(/\r\n?/g, '\n');
  const out: Token[] = [];
  let last = 0;
  TAG_RE.lastIndex = 0;
  for (let m = TAG_RE.exec(src); m; m = TAG_RE.exec(src)) {
    if (m.index > last) out.push({ text: escText(src.slice(last, m.index)) });
    last = m.index + m[0].length;
    const close = m[1] === '/';
    let tag = m[2].toLowerCase();
    tag = RENAME[tag] ?? tag;
    if (ALLOWED.has(tag)) {
      if (tag === 'br') { if (!close) out.push({ tag, close: false }); } else out.push({ tag, close });
    } else if (BLOCKISH.has(tag) && close) {
      out.push({ tag: 'br', close: false });
    }
    // Any other tag (span, font, a, img, …) is dropped; its text stays.
  }
  if (last < src.length) out.push({ text: escText(src.slice(last)) });
  return out;
}

/** Tokens → HTML with every tag closed and nothing closed that was not open. */
function serialize(tokens: Token[]): string {
  const stack: string[] = [];
  let out = '';
  for (const t of tokens) {
    if ('text' in t) { out += t.text; continue; }
    if (t.tag === 'br') { out += '<br>'; continue; }
    if (!t.close) {
      // A paragraph cannot hold another block: close it first.
      if (!INLINE.has(t.tag) && stack[stack.length - 1] === 'p') { stack.pop(); out += '</p>'; }
      stack.push(t.tag);
      out += `<${t.tag}>`;
      continue;
    }
    const at = stack.lastIndexOf(t.tag);
    if (at === -1) continue;
    while (stack.length > at) out += `</${stack.pop()}>`;
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

function tidy(html: string): string {
  let s = html.replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n');
  let prev = '';
  // Empty wrappers left behind by stripped tags or removed sentences.
  while (prev !== s) {
    prev = s;
    s = s.replace(/<(p|li|strong|b|em|i|h3|h4|ul|ol|td|th|tr|thead|tbody|table)>(?:\s|<br>)*<\/\1>/g, (m, tag) =>
      (tag === 'td' || tag === 'th' ? m.replace(/\s|<br>/g, '') : ''));
  }
  return s
    .replace(/(?:\s*<br>\s*){3,}/g, '<br><br>')
    .replace(/<(p|li|h3|h4|td|th)>(?:\s|<br>)+/g, '<$1>')
    .replace(/(?:\s|<br>)+<\/(p|li|h3|h4|td|th)>/g, '</$1>')
    .replace(/(<\/(?:p|ul|ol|h3|h4|table)>)(?:\s|<br>)+/g, '$1')
    .replace(/(?:\s|<br>)+(<(?:p|ul|ol|h3|h4|table)>)/g, '$1')
    .replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, '');
}

/* ------------------------------------------------ contact-info filter */

const EMAIL_RE = /[A-Z0-9._%+-]+\s?@\s?[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/i;
// 305-796-3649, (305) 796-3649, 305.796.3649, +1 305 796 3649, +33 6 12 34 56 78
const PHONE_RE = /(?:\(\d{3}\)\s?|\b\d{3}[-.])\d{3}[-.\s]\d{4}\b|\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b/;
const CONTACT_PHRASES = [
  /contact\s+(?:the\s+|our\s+|your\s+)?listing\s+(?:broker|agent)/i,
  /\bfor\s+(?:further|more|additional)\s+(?:information|info|details)\b[^.!?]*\b(?:contact|call|e-?mail)\b/i,
  /\b[Cc]all\s+(?:(?:Capt\.?|Captain|Mr\.?|Ms\.?|Mrs\.?)\s+)?(?:[A-Z][a-zA-Z'’-]+\s+){1,3}(?:at|on|today at)\b/,
  /\b(?:listing|central)\s+(?:broker|agent)\s*:/i,
];

/** True for a sentence that names a way to reach someone other than through the site. */
export function hasContactInfo(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text) || CONTACT_PHRASES.some((re) => re.test(text));
}

/**
 * Drop the sentences / lines of a run of text that carry contact details.
 * `run` is the tokens between two block boundaries (text + inline tags).
 */
function filterRun(run: Token[]): Token[] {
  const plain = run.map((t) => ('text' in t ? t.text : '')).join('');
  if (!hasContactInfo(plain)) return run;
  // Sentence boundaries, by offset in the plain text. A full stop only ends a
  // sentence when white space follows, so "raul@fyiyachts.com" stays whole.
  const cuts: [number, number, boolean][] = [];
  const re = /[^.!?\n]*(?:[.!?]+(?=\s|$)|\n|$)|[^\n]+?(?=\n|$)/g;
  let pos = 0;
  while (pos < plain.length) {
    re.lastIndex = pos;
    const m = re.exec(plain);
    if (!m || m[0].length === 0) { cuts.push([pos, plain.length, false]); break; }
    cuts.push([pos, pos + m[0].length, false]);
    pos += m[0].length;
  }
  // Merge fragments split inside an e-mail or phone ("call 305.796. 3649"
  // is rare; "info. raul@…" is not) — a sentence is tested with its text only.
  for (const c of cuts) c[2] = hasContactInfo(plain.slice(c[0], c[1]));
  const out: Token[] = [];
  let offset = 0;
  for (const t of run) {
    if (!('text' in t)) { out.push(t); continue; }
    const start = offset;
    const end = offset + t.text.length;
    offset = end;
    let kept = '';
    for (const [a, b, drop] of cuts) {
      if (drop || b <= start || a >= end) continue;
      kept += t.text.slice(Math.max(a, start) - start, Math.min(b, end) - start);
    }
    if (kept) out.push({ text: kept });
  }
  return out;
}

function filterContact(tokens: Token[]): Token[] {
  const out: Token[] = [];
  let run: Token[] = [];
  const flush = () => { if (run.length) { out.push(...filterRun(run)); run = []; } };
  for (const t of tokens) {
    if ('text' in t || INLINE.has(t.tag)) run.push(t);
    else { flush(); out.push(t); }
  }
  flush();
  return out;
}

/* ------------------------------------------------ public API */

export interface CleanOptions {
  /** Remove sentences carrying e-mail addresses, phone numbers or "contact the listing broker". Default true. */
  stripContact?: boolean;
}

/** Feed HTML → allowlisted, attribute-free HTML. Plain text becomes paragraphs. */
export function cleanListingHtml(input: unknown, opts: CleanOptions = {}): string {
  let raw = Array.isArray(input) ? input.filter((x) => typeof x === 'string').join('\n') : typeof input === 'string' ? input : '';
  raw = raw.trim();
  if (!raw) return '';
  // Hand-entered listings carry plain text: blank lines are paragraphs.
  if (!/<[a-zA-Z/][^>]*>/.test(raw)) {
    raw = raw.split(/\n{2,}/).map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('');
  }
  let tokens = tokenize(raw);
  if (opts.stripContact !== false) tokens = filterContact(tokens);
  const html = tidy(serialize(tokens));
  // Loose text with no block wrapper reads as one paragraph.
  return html && !/^<(?:p|ul|ol|h3|h4|table)>/.test(html) && !/<(?:p|ul|ol|h3|h4|table)>/.test(html) ? `<p>${html}</p>` : html;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', deg: '°', eacute: 'é', egrave: 'è', hellip: '…', bull: '•', middot: '·', reg: '®', trade: '™', copy: '©', frac12: '½', frac14: '¼', frac34: '¾', prime: '′', Prime: '″' };

/** HTML → one line of plain text (meta descriptions, JSON-LD, search). */
export function htmlToText(html: unknown): string {
  const s = Array.isArray(html) ? html.join(' ') : String(html ?? '');
  return s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(DROP_WITH_CONTENT, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 32))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, n) => ENTITIES[n] ?? m)
    .replace(/[\s ]+/g, ' ')
    .trim();
}

const KEEP_UPPER = new Set(['VIP', 'TV', 'AV', 'AC', 'DC', 'A/C', 'AC/DC', 'GPS', 'VHF', 'AIS', 'LED', 'HVAC', 'USA', 'US', 'RIB', 'LOA', 'LWL', 'FYI', 'II', 'III', 'IV', 'CE', 'MCA', 'ABS', 'RINA', 'MTU', 'CAT', 'IPS', 'SOLAS', 'EPIRB']);
const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'a', 'an', 'with', 'by']);

/** "KEY FEATURES" → "Key Features". Titles already in mixed case are left as written. */
export function titleCase(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  if (!t || /[a-z]/.test(t)) return t;
  return t
    .split(' ')
    .map((word, i) =>
      word.split(/([/\-–—])/).map((part) => {
        if (KEEP_UPPER.has(part) || KEEP_UPPER.has(word)) return part;
        const lower = part.toLowerCase();
        if (i > 0 && SMALL_WORDS.has(lower)) return lower;
        return lower.replace(/^([^a-z]*)([a-z])/, (_, pre, ch) => pre + ch.toUpperCase());
      }).join(''))
    .join(' ');
}

export interface ListingSection { title: string; html: string }

export interface ListingContent {
  /** Cleaned GeneralBoatDescription; '' when the feed has none. */
  descriptionHtml: string;
  /** The same, as one line of plain text. */
  descriptionText: string;
  /** AdditionalDetailDescription, one entry per section, in feed order. */
  sections: ListingSection[];
  /** The feed's own "Disclaimer" section, shown once at the bottom. */
  disclaimerHtml: string;
  /** ListingTitle ("New arrival") when it is short enough to be a tag. */
  tag: string;
}

const CONTACT_SECTION_RE = /^(?:custom\s*contact\s*information|contact(?:\s*information|\s*info|\s*details|\s*us)?)$/i;
const SECTION_HEAD_RE = /^\s*(?:<p[^>]*>\s*)?<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>\s*(?:<\/p>\s*)?(?:<br\s*\/?>\s*)?/i;

export function buildListingContent(it: Record<string, any>): ListingContent {
  const descriptionHtml = cleanListingHtml(it.GeneralBoatDescription);
  const sections: ListingSection[] = [];
  let disclaimerHtml = '';
  const extra = Array.isArray(it.AdditionalDetailDescription)
    ? it.AdditionalDetailDescription
    : typeof it.AdditionalDetailDescription === 'string' ? [it.AdditionalDetailDescription] : [];
  for (const raw of extra) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const m = SECTION_HEAD_RE.exec(raw);
    const rawTitle = m ? htmlToText(m[2]).replace(/[:\s]+$/, '') : '';
    const body = m ? raw.slice(m[0].length) : raw;
    if (CONTACT_SECTION_RE.test(rawTitle)) continue;
    if (/^disclaimer$/i.test(rawTitle)) {
      // Legal text is shown as written: no sentence is filtered out of it.
      disclaimerHtml = disclaimerHtml || cleanListingHtml(body, { stripContact: false });
      continue;
    }
    const html = cleanListingHtml(body);
    if (!html) continue;
    const title = titleCase(rawTitle) || 'Additional Details';
    // "PRELIMINARY LISTING / PRELIMINARY LISTING": a heading repeated as its own body.
    if (htmlToText(html).toLowerCase() === title.toLowerCase()) continue;
    sections.push({ title, html });
  }
  const tagText = htmlToText(it.ListingTitle).replace(/^[\s*!.-]+|[\s*!.-]+$/g, '');
  return {
    descriptionHtml,
    descriptionText: htmlToText(descriptionHtml),
    sections,
    disclaimerHtml,
    tag: tagText && tagText.length <= 32 && !hasContactInfo(tagText) ? tagText : '',
  };
}
