// Dynamic sitemap for the live yacht inventory — /sitemap-listings.xml is
// rewritten here by vercel.json.
//
// Every listing at /listing/:id is fully server-rendered by api/listing.ts
// (title, meta description, canonical, Open Graph, Product/BreadcrumbList
// JSON-LD), but the build-time sitemap in scripts/prerender.mjs only knows
// the static routes — so until this route existed the entire live catalogue
// was absent from sitemap.xml and reached Google only through internal
// links. These are the highest-intent pages on the site; they belong in the
// sitemap.
//
// The feed is the source of truth for what exists, so the sitemap is
// generated per request rather than at build time: boats are added and sold
// between deploys. <lastmod> carries the feed's own LastModificationDate,
// not the build date — a per-URL freshness signal Google can actually trust.

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  send(b: string): VercelResponse;
  end(): VercelResponse;
};

import { MANUAL_LISTINGS } from './_lib/manualListings.js';

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');

const ROWS_PER_PAGE = 200;
const MAX_PAGES = 10;           // 2,000 listings; the catalogue runs ~140
const SITEMAP_URL_CAP = 50_000; // sitemaps.org hard limit
const UPSTREAM_TIMEOUT_MS = 10_000;

export const maxDuration = 30;

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Feed dates arrive as YYYY-MM-DD; anything else is dropped rather than guessed. */
const lastmod = (v: unknown): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ''));
  return m ? m[1] : null;
};

async function fetchPage(page: number): Promise<{ results: Record<string, any>[]; numResults: number }> {
  const url = new URL(UPSTREAM);
  url.searchParams.set('key', KEY);
  url.searchParams.set('salesstatus', 'active');
  url.searchParams.set('rows', String(ROWS_PER_PAGE));
  if (page > 1) url.searchParams.set('page', String(page));
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`boats.com ${res.status}`);
  const body = (await res.json()) as { results?: Record<string, any>[]; numResults?: number };
  return { results: body.results ?? [], numResults: Number(body.numResults ?? 0) };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');

  try {
    const first = await fetchPage(1);
    const all = [...MANUAL_LISTINGS, ...first.results];
    const pages = Math.min(MAX_PAGES, Math.ceil(first.numResults / ROWS_PER_PAGE) || 1);
    for (let p = 2; p <= pages && all.length < SITEMAP_URL_CAP; p++) {
      const next = await fetchPage(p);
      if (!next.results.length) break;
      all.push(...next.results);
    }

    // The feed can carry the same hull under more than one DocumentID; a
    // sitemap listing the same URL twice is a (minor) validity warning.
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const it of all) {
      const id = String(it.DocumentID ?? '').replace(/[^0-9]/g, '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const mod = lastmod(it.LastModificationDate) ?? lastmod(it.ItemReceivedDate);
      urls.push(
        `  <url><loc>${esc(`${SITE}/listing/${id}`)}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>`,
      );
      if (urls.length >= SITEMAP_URL_CAP) break;
    }

    // Serve from the edge: Google and Bing refetch sitemaps often, and this
    // route would otherwise hit the boats.com API on every crawl. A stale copy
    // for an hour is harmless; SWR keeps the last good copy answering for a
    // day if upstream goes down mid-window.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    );
  } catch (err: any) {
    // Deliberately NOT an empty 200: an empty <urlset> reads as "these pages
    // are gone" and shows up in Search Console as a sitemap with 0 URLs.
    // A 503 tells the crawler to come back and keeps the last fetch on record.
    console.error('[sitemap-listings] upstream failed:', err?.message || err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- inventory feed unavailable; retry shortly -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
    );
  }
}
