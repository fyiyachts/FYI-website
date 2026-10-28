type VercelRequest = { body: any; query: Record<string, string | string[]>; method?: string; headers: Record<string, string | undefined> };
type VercelResponse = {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  send(body: string): VercelResponse;
  json(body: unknown): VercelResponse;
  end(): VercelResponse;
};

import { findManualListing, manualListingsFor } from '../_lib/manualListings.js';
import { plsConfigured, plsGetById } from '../_lib/plsFeed.js';

// BoatsGroup (boats.com) inventory feed. Key is a query param (no auth header).
// Set BOATS_API_KEY to FYI's own BoatsGroup inventory key.
const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const DEFAULT_ROWS = '200';

// Humans + desired search/AI crawlers get a generous deadline; unwanted scrapers
// that never render the page get a short one so a miss does not pin the lambda
// for ~10s (2026-09-12: Meta/Baidu fleet → ~2K calls, P75 ~10s, 36% errors).
const UPSTREAM_TIMEOUT_HUMAN_MS = 8_000;
const UPSTREAM_TIMEOUT_BOT_MS = 2_800;

// Rate limiting is PER CLIENT, not global. The previous counter was a single
// module-level window shared by every visitor on that lambda instance, so one
// burst — a crawler, or the quiz and a listing page loading together — locked
// everyone else out: 1,183 of 9,175 requests in 12h were rejected this way
// (2026-08-20), and a rejection renders an empty yacht grid.
const RATE_LIMIT_WINDOW_MS = 60_000;
// 180, up from 60 (2026-10-28): a few people behind one office IP browsing
// boats tripped 60, and the listing lookup itself then got a 429.
const MAX_REQUESTS_HUMAN = 180;
// Desired engines fire 3–6 client-rendered proxy calls per view; 8/min emptied
// those into 429s. Give them ~30/min while scrapers stay at 8.
const MAX_REQUESTS_DESIRED = 30;
const MAX_REQUESTS_BOT = 8;
const MAX_TRACKED_CLIENTS = 5_000;
const hits = new Map<string, number[]>();

// Circuit breaker — LIST queries only (rows=200/400 grids, rails, sold book).
// Consecutive *human* upstream timeouts / gateway 5xx within a window trip
// fail-fast 503s for list queries (no boats.com call). Bot short deadlines
// (2.8s) and any crawler traffic must NOT open it — a crawler fleet timing
// out must not 503 real yacht searchers for 45s.
//
// Single-listing lookups (documentid/id) never touch it: they neither count
// toward it nor get blocked by it (2026-10-28). While it was shared, slow
// rows=400 list calls opened it and every listing page then got an empty
// 503 — rendered as "This listing is no longer available" for live boats.
// In-memory, same instance lifetime as `hits`.
const BREAKER_FAIL_THRESHOLD = 5;
const BREAKER_FAIL_WINDOW_MS = 60_000;
const BREAKER_OPEN_MS = 45_000;
let breakerFails: number[] = [];
let breakerOpenUntil = 0;

// Single-listing lookups get one retry after a timeout / 5xx before giving up.
const LISTING_RETRY_DELAY_MS = 250;

// Worst case for a listing lookup: feed try + retry, then PLS try + retry.
export const maxDuration = 40;

// Error replies must never be cached: a 429 or 503 cached at the edge for even
// 10s answered every visitor of that URL with an empty result.
const NO_STORE = 'no-store';

/** Search / AI crawlers we want indexed — human timeout + higher rate budget. */
const DESIRED_CRAWLER_UA_RE =
  /googlebot|bingbot|gptbot|claudebot|oai-searchbot|openai|perplexity/i;

/** SEO / social scrapers — short deadline + tight rate limit. */
const UNWANTED_SCRAPER_UA_RE =
  /meta-externalagent|meta-webindexer|baiduspider|ahrefs|semrush|dotbot|yandexbot|bytespider|petalsearch/i;

type TrafficClass = 'human' | 'desired' | 'unwanted';

function clientKey(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw || '').split(',')[0]?.trim() || 'unknown';
}

function classifyTraffic(req: VercelRequest): TrafficClass {
  const ua = req.headers['user-agent'];
  if (!ua || !String(ua).trim()) return 'unwanted';
  const s = String(ua);
  if (DESIRED_CRAWLER_UA_RE.test(s)) return 'desired';
  if (UNWANTED_SCRAPER_UA_RE.test(s)) return 'unwanted';
  return 'human';
}

function rateLimitFor(traffic: TrafficClass): number {
  if (traffic === 'desired') return MAX_REQUESTS_DESIRED;
  if (traffic === 'unwanted') return MAX_REQUESTS_BOT;
  return MAX_REQUESTS_HUMAN;
}

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  // Cheap eviction: drop everything stale once the map gets large, rather than
  // sweeping on every request.
  if (hits.size > MAX_TRACKED_CLIENTS) {
    for (const [k, ts] of hits) {
      if (!ts.length || now - ts[ts.length - 1] > RATE_LIMIT_WINDOW_MS) hits.delete(k);
    }
  }
  const ts = hits.get(key) ?? [];
  while (ts.length && now - ts[0] > RATE_LIMIT_WINDOW_MS) ts.shift();
  if (ts.length >= limit) {
    hits.set(key, ts);
    return true;
  }
  ts.push(now);
  hits.set(key, ts);
  return false;
}

function breakerIsOpen(): boolean {
  return Date.now() < breakerOpenUntil;
}

function breakerRecordFailure(): void {
  const now = Date.now();
  while (breakerFails.length && now - breakerFails[0] > BREAKER_FAIL_WINDOW_MS) {
    breakerFails.shift();
  }
  breakerFails.push(now);
  if (breakerFails.length >= BREAKER_FAIL_THRESHOLD) {
    breakerOpenUntil = now + BREAKER_OPEN_MS;
    breakerFails = [];
  }
}

function breakerRecordSuccess(): void {
  breakerFails = [];
  breakerOpenUntil = 0;
}

/** Gateway-class upstream failures worth tripping the breaker (not every 5xx). */
function isBreakerUpstreamStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const traffic = classifyTraffic(req);
  const human = traffic === 'human';

  const docParam = req.query.documentid ?? req.query.id;
  const docId = docParam ? String(Array.isArray(docParam) ? docParam[0] : docParam) : '';

  // Single-listing lookups are exempt from the per-IP limit for people and
  // wanted crawlers: one listing view is one lookup, and a 429 here is a
  // visitor told the boat won't load. Unwanted scrapers stay limited.
  const limited = !docId || traffic === 'unwanted';
  if (limited && isRateLimited(clientKey(req), rateLimitFor(traffic))) {
    res.setHeader('Cache-Control', NO_STORE);
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Rate limit exceeded.', results: [], numResults: 0 });
  }

  // Hand-entered listings (api/_lib/manualListings.ts) answer their own
  // documentid lookups — the upstream has never heard of them.
  const manual = docId ? findManualListing(docId) : undefined;
  if (manual) {
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({ numResults: 1, results: [manual] });
  }

  const url = new URL(UPSTREAM);

  // Forward ONLY params the boats.com API understands. The frontend also
  // emits WordPress-era params (e.g. sort=date_added, per_page, orderby) that
  // boats.com rejects with a 503, so anything not whitelisted is dropped.
  const FORWARD = new Set([
    // `start` is the only pagination param the upstream honors — it ignores
    // `page` (kept here because callers still send it). /sold-yachts needs it:
    // the sold book is ~1,000 rows and the newest closings are not in the
    // first page the feed returns.
    'salesstatus', 'rows', 'page', 'start', 'make', 'keyword', 'class', 'model',
    'year', 'condition', 'length', 'price', 'state', 'country', 'documentid', 'id',
  ]);
  for (const [key, value] of Object.entries(req.query)) {
    if (!FORWARD.has(key.toLowerCase())) continue;
    url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
  }

  // Server-controlled params.
  url.searchParams.set('key', KEY);
  if (!url.searchParams.has('rows')) url.searchParams.set('rows', DEFAULT_ROWS);
  // Default to active inventory unless the caller is targeting a specific listing.
  const targetsListing = url.searchParams.has('documentid') || url.searchParams.has('id');
  if (!url.searchParams.has('salesstatus') && !targetsListing) {
    url.searchParams.set('salesstatus', 'active');
  }

  // Desired crawlers share the human (8s) deadline so multi-call page views
  // are not empty 429/timeout shells; unwanted scrapers stay on 2.8s.
  const timeoutMs =
    traffic === 'unwanted' ? UPSTREAM_TIMEOUT_BOT_MS : UPSTREAM_TIMEOUT_HUMAN_MS;

  res.setHeader('Content-Type', 'application/json');

  if (targetsListing) return listingLookup(res, url, timeoutMs, traffic !== 'unwanted');

  if (breakerIsOpen()) {
    res.setHeader('Cache-Control', NO_STORE);
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ error: 'Upstream temporarily unavailable.', results: [], numResults: 0 });
  }

  try {
    const upstream = await upstreamGet(url, timeoutMs);

    // Only human requests count: crawler aborts / crawler 5xx must not open the
    // breaker for real searchers. Prefer gateway statuses over every 5xx
    // (boats.com 500s can be common/transient).
    if (human && isBreakerUpstreamStatus(upstream.status)) {
      breakerRecordFailure();
    } else if (upstream.status < 500) {
      breakerRecordSuccess();
    }

    let body = upstream.body;
    // Fold the hand-entered listings into active-inventory results, ahead of
    // the feed rows. Only on a clean JSON 200 — an error body passes through.
    const extra = upstream.ok ? manualListingsFor(url.searchParams) : [];
    if (extra.length) {
      try {
        const data = JSON.parse(body);
        if (Array.isArray(data?.results)) {
          data.results = [...extra, ...data.results];
          if (typeof data.numResults === 'number') data.numResults += extra.length;
          body = JSON.stringify(data);
        }
      } catch { /* not JSON — pass through untouched */ }
    }
    // The catalogue changes a few times a day, and the same handful of queries
    // (rows=400, salesstatus=sold) repeat constantly. Letting the CDN answer
    // those keeps both the lambda and the upstream out of the hot path — most
    // of the load that tripped the old limiter. Failures are never cached.
    res.setHeader('Cache-Control', upstream.ok ? 'public, s-maxage=120, stale-while-revalidate=600' : NO_STORE);
    res.status(upstream.status).send(body);
  } catch (err: any) {
    // Unwanted-bot deadline aborts (AbortSignal.timeout 2800ms) and desired
    // crawler failures do NOT count toward the breaker. Human timeouts
    // (AbortError) and network errors do.
    if (human) {
      breakerRecordFailure();
    }
    console.error('[yachts/proxy] list error:', err?.message || err);
    res.setHeader('Cache-Control', NO_STORE);
    res.status(502).json({ error: 'Request failed', results: [], numResults: 0 });
  }
}

/** One upstream GET; the deadline covers the body read as well as the headers. */
async function upstreamGet(url: URL, timeoutMs: number): Promise<{ status: number; ok: boolean; body: string }> {
  const r = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: r.status, ok: r.ok, body: await r.text() };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn`, and once more after a short pause if it throws or answers 5xx. */
async function withRetry<T>(fn: () => Promise<T>, failed: (v: T) => boolean, retry: boolean): Promise<T> {
  try {
    const v = await fn();
    if (!retry || !failed(v)) return v;
  } catch (err) {
    if (!retry) throw err;
  }
  await sleep(LISTING_RETRY_DELAY_MS);
  return fn();
}

/**
 * Single-listing lookup (?documentid= / ?id=): FYI's feed first, then the
 * co-brokerage (PLS) feed. Never blocked by or counted toward the list
 * breaker, retried once on a timeout / 5xx, and an *error* is always answered
 * as an uncached error — only a clean "no such boat" from both feeds is an
 * empty 200. The listing page reads an empty 200 as "no longer available", so
 * an error must never look like one.
 */
async function listingLookup(res: VercelResponse, url: URL, timeoutMs: number, retry: boolean) {
  const id = url.searchParams.get('documentid') || url.searchParams.get('id') || '';
  const fail = (status: number, why: string) => {
    console.error(`[yachts/proxy] listing ${id} error:`, why);
    res.setHeader('Cache-Control', NO_STORE);
    return res.status(status).json({ error: 'Request failed', results: [], numResults: 0 });
  };

  let upstream: { status: number; ok: boolean; body: string };
  try {
    upstream = await withRetry(() => upstreamGet(url, timeoutMs), (u) => u.status >= 500, retry);
  } catch (err: any) {
    return fail(502, err?.message || String(err));
  }
  if (!upstream.ok) return fail(upstream.status >= 500 ? 502 : upstream.status, `feed HTTP ${upstream.status}`);

  let found: boolean;
  try {
    found = (JSON.parse(upstream.body)?.numResults ?? 0) > 0;
  } catch {
    return fail(502, 'feed returned non-JSON');
  }
  if (found) {
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).send(upstream.body);
  }

  // Not one of FYI's boats? It may be a co-brokerage listing (BoatsGroup
  // PLS). FYI's own version always wins: PLS is only asked when the
  // exclusives feed has no such DocumentID. A PLS failure is an error, not
  // "not found" — it used to be swallowed into an empty (cached) 200.
  if (plsConfigured()) {
    try {
      const co = await withRetry(() => plsGetById(id), () => false, retry);
      if (co) {
        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
        return res.status(200).json({ numResults: 1, results: [co] });
      }
    } catch (err: any) {
      return fail(502, `PLS: ${err?.message || err}`);
    }
  }

  // Clean answer from every feed: no such boat. Cached briefly, without
  // stale-while-revalidate, so a relisted boat reappears within a minute.
  res.setHeader('Cache-Control', 'public, s-maxage=60');
  return res.status(200).json({ numResults: 0, results: [] });
}
