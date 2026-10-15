/**
 * 301s the WordPress site's per-listing URLs onto this app's /listing/:id.
 *
 * fyiyachts.com serves individual boats as
 *   /yacht/2012-azimut-grande-105-miami-872081
 * i.e. a descriptive slug ending in the LAST SIX DIGITS of the BoatsGroup
 * DocumentID (that one is 9872081). The plugin zero-pads to six, so 10098671
 * appears as `-098671`. Verified across the live category pages on 2026-07-29:
 * every FYI-owned boat resolved, and the 140 active DocumentIDs have zero
 * last-six collisions.
 *
 * Slugs that don't resolve are third-party YATCO rows from the worldwide feed
 * (Nordhavn in Milwaukee, etc.) or boats that have since sold. Those are not
 * FYI's inventory and their IDs live in a different namespace, so they go to
 * the inventory index rather than 404.
 */

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  send(body: string): VercelResponse;
  json(body: unknown): VercelResponse;
  end(): VercelResponse;
};

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const FEED_TTL_MS = 10 * 60 * 1000;

/** Where unresolvable slugs land. Topical, indexable, and always exists. */
export const FALLBACK = '/yachts-for-sale';

let idCache: { ids: string[]; at: number } | null = null;

async function activeIds(): Promise<string[]> {
  if (idCache && Date.now() - idCache.at < FEED_TTL_MS) return idCache.ids;
  const url = new URL(UPSTREAM);
  url.searchParams.set('key', KEY);
  url.searchParams.set('salesstatus', 'active');
  url.searchParams.set('rows', '400');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const data: any = await res.json();
  const ids = (Array.isArray(data?.results) ? data.results : [])
    .map((it: any) => String(it?.DocumentID || ''))
    .filter(Boolean);
  idCache = { ids, at: Date.now() };
  return ids;
}

/**
 * Resolve a WP yacht slug to a DocumentID via its trailing six digits.
 * Exported for the unit test — keep it pure.
 */
export function resolveSlug(slug: string, ids: string[]): string | null {
  const m = /(\d{6})$/.exec(slug.replace(/\/+$/, ''));
  if (!m) return null;
  const tail = m[1];
  const hits = ids.filter(id => id.slice(-6) === tail);
  // Only redirect on an unambiguous hit — two boats sharing a tail would make
  // this a coin flip, and the index is the honest answer.
  return hits.length === 1 ? hits[0] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw || '';

  let target = FALLBACK;
  try {
    const id = resolveSlug(slug, await activeIds());
    if (id) target = `/listing/${id}`;
  } catch {
    // Feed down: still send them somewhere useful rather than erroring.
  }

  // s-maxage lets the CDN hold the resolved hop; a boat selling only means a
  // stale hop to a listing page that itself handles the sold state.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.setHeader('Location', target);
  return res.status(301).send('');
}
