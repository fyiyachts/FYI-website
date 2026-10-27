// Co-brokerage listings (BoatsGroup PLS), searched, sorted and paged by PLS.
// Same row shape as /api/yachts/proxy so the front end reads both feeds with
// one normalizer. Every row carries ListingType: 'cobrokerage'.
//
// Takes the site's own filter params (the /yachts-for-sale URL keys) and maps
// them to PLS. Formats verified against the live service 2026-10-27:
//   length=48:52|feet  price=500000:1000000|USD  year=2020:2100  (min:max —
//   "48-52" style ranges error or are ignored), class=Motor Yachts,
//   condition=New|Used, sort=Price|desc, rows+start for paging.
//   The default is sort=Length|desc (longest first, the site-wide order).
//   "Newest" is sort=ItemReceivedDate|desc (date first listed);
//   LastModificationDate orders by last edit instead, so it is not used.
//
// FYI's own boats are also in PLS under the same DocumentID. They are dropped
// here so they only ever show as FYI Exclusives.

import { plsSearch, plsConfigured, PLS_CARD_FIELDS } from '../_lib/plsFeed.js';

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  end(): VercelResponse;
};

const DEFAULT_ROWS = 24;
const MAX_ROWS = 48;

const SORTS: Record<string, string> = {
  newest: 'ItemReceivedDate|desc',
  'price-desc': 'Price|desc',
  'price-asc': 'Price|asc',
  'length-desc': 'Length|desc',
};

// The home-page search and older links use loose type names; PLS wants its
// exact class names (the same ones the FilterBar offers from the feed).
const CLASS_ALIASES: Record<string, string> = {
  'motor yacht': 'Motor Yachts',
  'center console': 'Center Consoles',
  'sport fish': 'Sports Fishing Boats',
  catamaran: 'Power Catamarans',
  cruiser: 'Cruisers',
  trawler: 'Trawlers',
};

const first = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? '';

const digits = (v: string): string => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? String(Math.round(n)) : '';
};

/* ------------------------------------------------ FYI's own DocumentIDs */

const INVENTORY_URL = 'https://api.boats.com/inventory/search';
const FYI_KEY = process.env.BOATS_API_KEY || '';
const FYI_IDS_TTL_MS = 10 * 60 * 1000;
let fyiIds: Set<string> = new Set();
let fyiIdsAt = 0;

async function ownIds(): Promise<Set<string>> {
  if (!FYI_KEY || Date.now() - fyiIdsAt < FYI_IDS_TTL_MS) return fyiIds;
  try {
    const url = new URL(INVENTORY_URL);
    url.searchParams.set('key', FYI_KEY);
    url.searchParams.set('salesstatus', 'active');
    url.searchParams.set('fields', 'DocumentID');
    url.searchParams.set('rows', '400'); // FYI's book is ~135 active boats
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    });
    const data: any = res.ok ? await res.json() : null;
    if (Array.isArray(data?.results)) {
      fyiIds = new Set(data.results.map((r: any) => String(r.DocumentID)));
      fyiIdsAt = Date.now();
    }
  } catch {
    // Keep the last good set; a miss only risks showing a boat twice.
  }
  return fyiIds;
}

/* ------------------------------------------------ free-text → make */

/**
 * PLS matches `make` word by word, OR'd: make=Ferretti Yachts returns every
 * make containing "Yachts" (757 boats, against 42 Ferretti). A quoted phrase
 * matches exactly ("Ferretti Yachts" → 42), so multi-word makes are quoted.
 */
const plsMake = (make: string): string => {
  const m = make.replace(/"/g, '').trim();
  return /\s/.test(m) ? `"${m}"` : m;
};

// Words that are never a builder, so they are not worth a probe.
const STOPWORDS = new Set([
  'yacht', 'yachts', 'boat', 'boats', 'for', 'sale', 'the', 'and', 'with', 'new', 'used',
  'fly', 'flybridge', 'motor', 'sport', 'fishing', 'center', 'console', 'express',
]);

/** make → does PLS have any boats under it. Builder names change rarely. */
const makeProbe = new Map<string, boolean>();

async function isMake(candidate: string): Promise<boolean> {
  const key = candidate.toLowerCase();
  const known = makeProbe.get(key);
  if (known !== undefined) return known;
  try {
    const { numResults } = await plsSearch({ make: plsMake(candidate), rows: '0' }, { fields: 'DocumentID' });
    const hit = numResults > 0;
    if (makeProbe.size > 2_000) makeProbe.clear();
    makeProbe.set(key, hit);
    return hit;
  } catch {
    return false; // not cached: a failed probe should be retried next time
  }
}

/**
 * Split free text into a builder and keywords: "50 Azimut" → make Azimut,
 * keyword "50". Two-word phrases are tried before single words so "Sea Ray"
 * wins over "Sea". Probes run in parallel; the first candidate in that order
 * that PLS knows as a make is used.
 */
async function splitQuery(q: string): Promise<{ make?: string; keyword: string }> {
  const words = q.trim().split(/\s+/).filter(Boolean);
  const candidates: { text: string; at: number; len: number }[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    if (/^[a-z]/i.test(words[i]) && /^[a-z]/i.test(words[i + 1])) {
      candidates.push({ text: `${words[i]} ${words[i + 1]}`, at: i, len: 2 });
    }
  }
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length >= 3 && /^[a-z][a-z'&.-]*$/i.test(w) && !STOPWORDS.has(w.toLowerCase())) {
      candidates.push({ text: w, at: i, len: 1 });
    }
  }
  const picked = candidates.slice(0, 8);
  const hits = await Promise.all(picked.map((c) => isMake(c.text)));
  const found = picked.find((_, i) => hits[i]);
  if (!found) return { keyword: words.join(' ') };
  const rest = words.filter((_, i) => i < found.at || i >= found.at + found.len);
  return { make: found.text, keyword: rest.join(' ') };
}

/* ------------------------------------------------ handler */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) p[k.toLowerCase()] = first(v).trim();

  const rows = Math.min(Math.max(parseInt(p.rows, 10) || DEFAULT_ROWS, 1), MAX_ROWS);
  const start = Math.max(parseInt(p.start, 10) || 0, 0);

  if (!plsConfigured()) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(200).json({ numResults: 0, results: [], start, rows, note: 'BOATS_PLS_API_KEY not set' });
  }

  const pls: Record<string, string | undefined> = {
    rows: String(rows),
    start: String(start),
    // Default: longest first, the site-wide inventory order.
    sort: SORTS[p.sort] ?? SORTS['length-desc'],
    state: p.state || undefined,
    country: p.country || undefined,
  };

  let make = p.make;
  let keyword = p.q || '';
  if (keyword && !make) {
    const split = await splitQuery(keyword);
    make = split.make ?? '';
    keyword = split.keyword;
  }
  if (make) pls.make = plsMake(make);
  if (keyword) pls.keyword = keyword;

  if (p.type) pls.class = CLASS_ALIASES[p.type.toLowerCase()] ?? p.type;

  const minLen = digits(p.minlen || '');
  const maxLen = digits(p.maxlen || '');
  if (minLen || maxLen) pls.length = `${minLen || 0}:${maxLen || 1000}|feet`;

  const minPrice = digits(p.minprice || '');
  const maxPrice = digits(p.maxprice || '');
  if (minPrice || maxPrice) pls.price = `${minPrice || 0}:${maxPrice || 1000000000}|USD`;

  const year = digits(p.year || '');
  if (year) pls.year = `${year}:2100`;

  const condition = (p.condition || '').toLowerCase();
  if (condition === 'new') pls.condition = 'New';
  else if (condition === 'used') pls.condition = 'Used';

  try {
    const [data, own] = await Promise.all([
      plsSearch(pls, { fields: PLS_CARD_FIELDS, cardOnly: true }),
      ownIds(),
    ]);
    const results = data.results.filter((r) => !own.has(String(r.DocumentID)));
    const dropped = data.results.length - results.length;
    // Co-brokerage inventory changes a few times a day; let the CDN answer
    // repeat queries so visitors never wait on BoatsGroup.
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      // The drop is only known for this page, so the total is corrected by
      // what was seen here; FYI boats on later pages may still be counted.
      // `dropped` lets a client that pages on keep its own running total.
      numResults: Math.max(data.numResults - dropped, 0),
      dropped,
      results,
      start,
      rows,
      // Paging runs on PLS offsets, which count the dropped rows too.
      nextStart: start + rows,
      hasMore: start + rows < data.numResults,
      ...(make ? { make } : {}),
      ...(keyword ? { keyword } : {}),
    });
  } catch (err: any) {
    console.error('[yachts/cobrokerage] error:', err?.message || err);
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    return res.status(502).json({ error: 'Request failed', results: [], numResults: 0, start, rows });
  }
}
