// Whole-fleet access (active + sold) for the broker team pages. Unlike
// briannaInventory (active-only), this pulls the full BoatsGroup history —
// ~1,100 rows — so broker pages can show sold boats too. The upstream ignores
// `page` but honors `start`, so we page with start offsets (see the
// pagination gotcha logged in the brain, 2026-07-15).

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const CACHE_TTL_MS = 15 * 60 * 1000; // sold history moves slowly
const PAGE_ROWS = 400;
const MAX_PAGES = 6; // safety valve: 2,400 rows >> current ~1,126

export interface FleetBoat {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  lengthFt?: number;
  priceUsd?: number;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  image?: string;
  status: 'Active' | 'Sold' | string;
  rep?: string;       // SalesRep.Name — the listing broker
  /** SoldDate from the feed (ISO). Populated on every sold row in FYI's book
   *  (checked 2026-09-03: 993/993, spanning 2011–2026), so sold galleries can
   *  order by when the boat actually closed instead of by model year. */
  soldDate?: string;
}

let cache: { boats: FleetBoat[]; fetchedAt: number } | null = null;

/** Sold galleries lead with a rolling 24-month window (client, 2026-09-03 —
 *  widened from 12 so the opening cards are bigger boats). Mirrors
 *  soldWindowStart() in components/public/publicData.ts — the client bundle and
 *  the API cannot share a module, so keep the two in step. */
export const SOLD_WINDOW_MONTHS = 24;

export function soldWindowStart(now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - SOLD_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

function normalize(it: Record<string, any>): FleetBoat {
  const loc = it.BoatLocation || {};
  const images: string[] = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  return {
    id: String(it.DocumentID || ''),
    name: it.BoatName || [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim() || 'Yacht',
    make: it.MakeString || undefined,
    model: it.Model || undefined,
    year: it.ModelYear ? Number(it.ModelYear) : undefined,
    lengthFt: num(it.LengthOverall ?? it.NominalLength),
    priceUsd: it.PriceHideInd ? undefined : num(it.NormPrice ?? it.Price),
    category: it.BoatCategoryCode || undefined,
    city: loc.BoatCityName && loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : undefined,
    state: loc.BoatStateCode || undefined,
    country: loc.BoatCountryID || undefined,
    image: images[0],
    status: it.SalesStatus || 'Active',
    soldDate: it.SoldDate ? String(it.SoldDate) : undefined,
    rep: (it.SalesRep && it.SalesRep.Name) ? String(it.SalesRep.Name).trim() : undefined,
  };
}

export async function fetchFleet(): Promise<FleetBoat[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.boats;
  const seen = new Set<string>();
  const boats: FleetBoat[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(UPSTREAM);
    url.searchParams.set('key', KEY);
    url.searchParams.set('salesstatus', 'active,sold');
    url.searchParams.set('rows', String(PAGE_ROWS));
    url.searchParams.set('start', String(page * PAGE_ROWS));
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`fleet feed failed (${res.status})`);
    const data: any = await res.json();
    const items: any[] = Array.isArray(data?.results) ? data.results : [];
    let added = 0;
    for (const it of items) {
      const b = normalize(it);
      if (!b.id || seen.has(b.id)) continue;
      seen.add(b.id);
      boats.push(b);
      added++;
    }
    if (items.length < PAGE_ROWS || added === 0) break;
  }
  const deduped = dedupeFleet(boats);
  cache = { boats: deduped, fetchedAt: Date.now() };
  return deduped;
}

// The BoatsGroup feed carries the same physical boat more than once under
// different DocumentIDs (e.g. relisted after a sale, or YachtCo + BoatsGroup
// overlap) — FYI flagged this on 2026-07-17 (a boat showing as Active AND
// Sold). Two rows count as the same boat when make+model+year+length match
// AND their names don't disagree (same-name or either name blank — distinct
// names like "Blackjack" vs "Black Ice" are genuinely different hulls of the
// same model). Active rows win over Sold; otherwise the first row wins.
function dedupeFleet(boats: FleetBoat[]): FleetBoat[] {
  const byKey = new Map<string, FleetBoat[]>();
  for (const b of boats) {
    const key = [
      (b.make || '').toLowerCase().trim(),
      (b.model || '').toLowerCase().trim(),
      b.year ?? '',
      b.lengthFt != null ? Math.round(b.lengthFt) : '',
    ].join('|');
    const group = byKey.get(key);
    if (group) group.push(b); else byKey.set(key, [b]);
  }

  const dropped = new Set<string>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const kept: FleetBoat[] = [];
    // Active rows first so a Sold duplicate of a live listing is what drops.
    const ordered = [...group].sort((a, b) =>
      (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1));
    for (const b of ordered) {
      const name = (b.name || '').toLowerCase().trim();
      const clash = kept.some(k => {
        const kName = (k.name || '').toLowerCase().trim();
        return !name || !kName || name === kName;
      });
      if (clash) dropped.add(b.id); else kept.push(b);
    }
  }
  return dropped.size ? boats.filter(b => !dropped.has(b.id)) : boats;
}

// Loose name key so "Hiram Concepcion" (feed) matches "Hiram Conception"
// (website) and case/spacing differences never split a broker in two.
export const repKey = (name: string): string =>
  name.toLowerCase().replace(/[^a-z]/g, '').replace(/tion$/, 'cion');
