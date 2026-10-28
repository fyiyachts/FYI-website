// Server-side inventory access for the Brianna chatbot. Reads the same
// BoatsGroup (boats.com) feed the portal uses (see api/yachts/proxy.ts) and
// exposes a filter/sort search the model can call as a tool. The active
// catalogue is small (~150 listings), so we fetch it whole and filter here.

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
// The phone receptionist's tool budget is 15s (ElevenLabs
// search_fyi_inventory.response_timeout_secs). A slow upstream must fail fast
// and fall back to the last good feed rather than hang until the gateway 504s
// — a caller mid-sentence gets no second chance.
const UPSTREAM_TIMEOUT_MS = 8000;

import { formatMoney, listPrice } from './price.js';

export interface InventoryBoat {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  lengthFt?: number;
  priceUsd?: number;
  /** Asking price as shown, in the listing's own currency ("€845,000"). */
  priceLabel: string;
  category?: string;   // Power | Sail
  classCode?: string;
  condition?: string;  // New | Used
  hullMaterial?: string;
  city?: string;
  state?: string;
  country?: string;
  cabins?: number;
  engines?: string;
  cruiseSpeed?: string;
  maxSpeed?: string;
  image?: string;
  images?: string[];   // gallery — up to a handful, for the expandable card
  description?: string;
}

let feedCache: { boats: InventoryBoat[]; fetchedAt: number } | null = null;

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const stripHtml = (s: string): string =>
  s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function normalize(it: Record<string, any>): InventoryBoat {
  const loc = it.BoatLocation || {};
  const images: string[] = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  const engines = Array.isArray(it.Engines) && it.Engines.length
    ? `${it.Engines.length}x ${[it.Engines[0]?.Make, it.Engines[0]?.Model].filter(Boolean).join(' ')}`.trim()
    : undefined;
  const desc = typeof it.GeneralBoatDescription === 'string' ? stripHtml(it.GeneralBoatDescription) : '';
  return {
    id: String(it.DocumentID || ''),
    name: it.BoatName || [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim() || 'Yacht',
    make: it.MakeString || undefined,
    model: it.Model || undefined,
    year: it.ModelYear ? Number(it.ModelYear) : undefined,
    lengthFt: num(it.LengthOverall ?? it.NominalLength),
    priceUsd: it.PriceHideInd ? undefined : num(it.NormPrice ?? it.Price),
    priceLabel: formatMoney(listPrice(it)),
    category: it.BoatCategoryCode || undefined,
    classCode: Array.isArray(it.BoatClassCode) ? it.BoatClassCode.join(', ') : it.BoatClassCode || undefined,
    condition: it.SaleClassCode || undefined,
    hullMaterial: it.BoatHullMaterialCode || undefined,
    city: loc.BoatCityName && loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : undefined,
    state: loc.BoatStateCode || undefined,
    country: loc.BoatCountryID || undefined,
    cabins: it.CabinsCountNumeric ? Number(it.CabinsCountNumeric) : undefined,
    engines,
    cruiseSpeed: it.CruisingSpeedMeasure || undefined,
    maxSpeed: it.MaximumSpeedMeasure || undefined,
    image: images[0],
    images: images.slice(0, 6),
    description: desc ? desc.slice(0, 700) : undefined,
  };
}

export async function fetchInventory(): Promise<InventoryBoat[]> {
  if (feedCache && Date.now() - feedCache.fetchedAt < FEED_CACHE_TTL_MS) return feedCache.boats;
  const url = new URL(UPSTREAM);
  url.searchParams.set('key', KEY);
  url.searchParams.set('salesstatus', 'active');
  url.searchParams.set('rows', '300');
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`inventory feed failed (${res.status})`);
    const data: any = await res.json();
    const items: any[] = Array.isArray(data?.results) ? data.results : [];
    const boats = items.map(normalize).filter((b) => b.id);
    // An empty upstream response is a feed hiccup, not a sold-out brokerage —
    // keep the last good catalogue rather than telling callers we have nothing.
    if (!boats.length && feedCache) return feedCache.boats;
    feedCache = { boats, fetchedAt: Date.now() };
    return boats;
  } catch (err) {
    if (feedCache) {
      console.warn('[inventory] upstream failed, serving stale feed:', err);
      return feedCache.boats;
    }
    throw err;
  }
}

export interface SearchParams {
  /** Exact DocumentID — used when the visitor is on a listing page and the
   *  chat needs THAT boat rather than a keyword guess. Wins over everything. */
  document_id?: string;
  query?: string;
  make?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  min_length_ft?: number;
  max_length_ft?: number;
  min_year?: number;
  max_year?: number;
  condition?: string;
  sort?: 'price_asc' | 'price_desc' | 'length_desc' | 'year_desc';
  /** Set only when the visitor explicitly asked for the cheapest/entry-level
   *  boats. It is what lets price_asc survive a max_price cap — see the sort
   *  block below. */
  cheapest_first?: boolean;
  limit?: number;
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'under', 'over', 'around', 'near', 'between', 'less', 'than',
  'about', 'new', 'used', 'boat', 'boats', 'yacht', 'yachts', 'vessel', 'vessels', 'foot', 'feet', 'ft',
]);

const haystack = (b: InventoryBoat): string =>
  [b.name, b.make, b.model, b.category, b.classCode, b.city, b.state, b.description]
    .filter(Boolean).join(' ').toLowerCase();

export async function searchInventory(
  params: SearchParams,
): Promise<{ totalActive: number; matches: InventoryBoat[]; queryMatched: boolean }> {
  const all = await fetchInventory();
  let boats = all;
  // False once a keyword search finds nothing — the results are then a
  // consolation set, not answers, and the caller must say so.
  let queryMatched = true;

  // Exact id lookup short-circuits: when the page context names a listing we
  // want that hull, not a fuzzy keyword match. Falls through to the normal
  // filters if the id isn't in the active feed (sold/withdrawn).
  if (params.document_id) {
    const exact = all.filter((b) => b.id === String(params.document_id));
    if (exact.length) return { totalActive: all.length, matches: exact, queryMatched: true };
  }

  if (params.make) {
    const mk = params.make.toLowerCase();
    boats = boats.filter((b) => (b.make || '').toLowerCase().includes(mk));
  }
  if (params.category) {
    const c = params.category.toLowerCase();
    boats = boats.filter((b) => (b.category || '').toLowerCase() === c);
  }
  if (params.condition) {
    const c = params.condition.toLowerCase();
    boats = boats.filter((b) => (b.condition || '').toLowerCase() === c);
  }
  if (params.min_price != null) boats = boats.filter((b) => b.priceUsd != null && b.priceUsd >= params.min_price!);
  if (params.max_price != null) boats = boats.filter((b) => b.priceUsd != null && b.priceUsd <= params.max_price!);
  if (params.min_length_ft != null) boats = boats.filter((b) => b.lengthFt != null && b.lengthFt >= params.min_length_ft!);
  if (params.max_length_ft != null) boats = boats.filter((b) => b.lengthFt != null && b.lengthFt <= params.max_length_ft!);
  if (params.min_year != null) boats = boats.filter((b) => b.year != null && b.year >= params.min_year!);
  if (params.max_year != null) boats = boats.filter((b) => b.year != null && b.year <= params.max_year!);

  if (params.query) {
    const tokens = params.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
    if (tokens.length) {
      const matched = boats.filter((b) => { const hay = haystack(b); return tokens.some((t) => hay.includes(t)); });
      // Keyword tokens narrow when they hit; when nothing matches, keep the
      // structured-filter result set so Brianna still has inventory to show —
      // but flag it, or she reads unrelated hulls back as if they were the
      // vessel the caller named (seen on a live call asking for "Darlington").
      if (matched.length) boats = matched;
      else queryMatched = false;
    }
  }

  // A budget cap means "show me the best boat this money buys", so a capped
  // search is ordered high-to-low unless the visitor actually asked for the
  // cheapest. Without this, "vessels under $2M" came back led by the smallest,
  // least expensive hulls in the band (client, 2026-09-03) — either because the
  // model sent price_asc or because a later filter reshuffled the set.
  const budgetCapped = params.max_price != null;
  const wantsCheapest = params.sort === 'price_asc' && params.cheapest_first === true;
  const sort = budgetCapped && !wantsCheapest ? 'price_desc' : params.sort;

  switch (sort) {
    case 'price_asc': boats = [...boats].sort((a, b) => (a.priceUsd ?? Infinity) - (b.priceUsd ?? Infinity)); break;
    case 'price_desc': boats = [...boats].sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0)); break;
    case 'length_desc': boats = [...boats].sort((a, b) => (b.lengthFt ?? 0) - (a.lengthFt ?? 0)); break;
    case 'year_desc': boats = [...boats].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
    default: boats = [...boats].sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0));
  }

  const limit = Math.min(Math.max(params.limit ?? 5, 1), 8);
  return { totalActive: all.length, matches: boats.slice(0, limit), queryMatched };
}
