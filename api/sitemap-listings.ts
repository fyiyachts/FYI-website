// The site's sitemaps for the live yacht inventory, generated from the feeds.
// vercel.json rewrites these URLs here:
//
//   /sitemap.xml                               ?type=index
//       The sitemap INDEX (the URL submitted to Search Console / Bing):
//       sitemap-pages.xml (static routes, written at build by
//       scripts/prerender.mjs) + the listing sitemaps below.
//   /sitemap-listings-exclusive.xml            ?type=exclusive
//       FYI's own listings (~137) and the hand-entered ones.
//   /sitemap-listings-cobrokerage-<n>.xml      ?type=cobrokerage&page=<n>
//       Co-brokerage listings (~9,100), at most 5,000 URLs per file.
//   /sitemap-listings.xml                      (no type)
//       The old single listings sitemap: still answers, as the exclusive set.
//
// Every listing at /listing/:id is server-rendered and indexable
// (api/listing.ts). <lastmod> is the feed's own LastModificationDate. A boat
// that leaves a feed leaves its sitemap on the next refresh.
//
// Cached at the CDN for 6 hours (then served stale while refreshing, up to a
// day), so ~9,100 URLs do not mean a BoatsGroup call on every crawl.

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  send(b: string): VercelResponse;
  end(): VercelResponse;
};

import { MANUAL_LISTINGS } from './_lib/manualListings.js';
import { plsConfigured, plsFetchAll, plsSearch } from './_lib/plsFeed.js';
import { dropRemovedListings } from './_lib/listingOverrides.js';

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');

const ROWS_PER_PAGE = 500;
const MAX_PAGES = 10;                 // 5,000 exclusives; the book runs ~140
const URLS_PER_SITEMAP = 5_000;       // client cap; sitemaps.org allows 50,000
const MAX_COBROKERAGE_SITEMAPS = 20;  // 100,000 boats — a guard, not a target
const UPSTREAM_TIMEOUT_MS = 15_000;
const SITEMAP_FIELDS = 'DocumentID,LastModificationDate,ItemReceivedDate';

const CACHE_OK = 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400';

export const maxDuration = 60;

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? '';

/** Feed dates arrive as YYYY-MM-DD; anything else is dropped rather than guessed. */
const lastmod = (v: unknown): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ''));
  return m ? m[1] : null;
};

const urlset = (rows: Record<string, any>[], skip?: Set<string>): { xml: string; count: number } => {
  // The feed can carry the same hull under more than one DocumentID; a
  // sitemap listing the same URL twice is a validity warning.
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const it of rows) {
    const id = String(it.DocumentID ?? '').replace(/[^0-9]/g, '');
    if (!id || seen.has(id) || skip?.has(id)) continue;
    seen.add(id);
    const mod = lastmod(it.LastModificationDate) ?? lastmod(it.ItemReceivedDate);
    urls.push(`  <url><loc>${esc(`${SITE}/listing/${id}`)}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>`);
  }
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    count: urls.length,
  };
};

/** FYI's active listings: id + dates only (the upstream honours `start`, not `page`). */
async function fetchExclusives(): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [...MANUAL_LISTINGS];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(UPSTREAM);
    url.searchParams.set('key', KEY);
    url.searchParams.set('salesstatus', 'active');
    url.searchParams.set('rows', String(ROWS_PER_PAGE));
    url.searchParams.set('start', String(page * ROWS_PER_PAGE));
    url.searchParams.set('fields', SITEMAP_FIELDS);
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`boats.com ${res.status}`);
    const body = (await res.json()) as { results?: Record<string, any>[]; numResults?: number };
    const rows = body.results ?? [];
    all.push(...dropRemovedListings(rows)); // never a listing taken off the site
    if (rows.length < ROWS_PER_PAGE || all.length >= Number(body.numResults ?? 0) + MANUAL_LISTINGS.length) break;
  }
  return all;
}

/** How many co-brokerage sitemap files the feed needs right now. */
let lastCoFiles = 2; // ~9,100 boats; replaced by the live count on first success
async function cobrokerageFiles(): Promise<{ files: number; live: boolean }> {
  if (!plsConfigured()) return { files: 0, live: true };
  try {
    const { numResults } = await plsSearch({ rows: '0' }, { fields: 'DocumentID' });
    lastCoFiles = Math.min(Math.max(Math.ceil(numResults / URLS_PER_SITEMAP), 1), MAX_COBROKERAGE_SITEMAPS);
    return { files: lastCoFiles, live: true };
  } catch (err: any) {
    console.error('[sitemap] co-brokerage count failed:', err?.message || err);
    return { files: lastCoFiles, live: false };
  }
}

const unavailable = (res: VercelResponse, what: string, err: any) => {
  // Deliberately NOT an empty 200: an empty <urlset> reads as "these pages
  // are gone". A 503 tells the crawler to come back and keeps the last fetch.
  console.error(`[sitemap] ${what} failed:`, err?.message || err);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '600');
  return res.status(503).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<!-- inventory feed unavailable; retry shortly -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
  );
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  const type = first(req.query?.type) || 'exclusive';

  if (type === 'index') {
    const { files, live } = await cobrokerageFiles();
    const today = new Date().toISOString().slice(0, 10);
    const children = [
      'sitemap-pages.xml',
      'sitemap-listings-exclusive.xml',
      ...Array.from({ length: files }, (_, i) => `sitemap-listings-cobrokerage-${i + 1}.xml`),
    ];
    // The index always answers 200 — it also carries the static pages. If the
    // count could not be read, the last known layout is served briefly.
    res.setHeader('Cache-Control', live ? CACHE_OK : 'public, max-age=0, s-maxage=300');
    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
        children.map((c) => `  <sitemap><loc>${SITE}/${c}</loc><lastmod>${today}</lastmod></sitemap>`).join('\n')
      }\n</sitemapindex>\n`,
    );
  }

  if (type === 'cobrokerage') {
    const page = parseInt(first(req.query?.page), 10) || 1;
    if (page < 1 || page > MAX_COBROKERAGE_SITEMAPS || !plsConfigured()) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
      return res.status(404).send('<?xml version="1.0" encoding="UTF-8"?>\n<!-- no such sitemap -->\n');
    }
    try {
      // FYI's own boats are in the co-brokerage feed too; they belong to the
      // exclusive sitemap only.
      const [co, own] = await Promise.all([
        plsFetchAll(SITEMAP_FIELDS, { start: (page - 1) * URLS_PER_SITEMAP, limit: URLS_PER_SITEMAP }),
        fetchExclusives(),
      ]);
      if (!co.results.length) {
        // Past the end of the feed (it shrank since the index was built).
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
        return res.status(404).send('<?xml version="1.0" encoding="UTF-8"?>\n<!-- no such sitemap -->\n');
      }
      const { xml } = urlset(co.results, new Set(own.map((r) => String(r.DocumentID))));
      res.setHeader('Cache-Control', CACHE_OK);
      return res.status(200).send(xml);
    } catch (err) {
      return unavailable(res, `cobrokerage-${page}`, err);
    }
  }

  try {
    const { xml } = urlset(await fetchExclusives());
    res.setHeader('Cache-Control', CACHE_OK);
    return res.status(200).send(xml);
  } catch (err) {
    return unavailable(res, 'exclusive', err);
  }
}
