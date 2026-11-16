// Similar active boats for a listing: same make, or within ±15% of its
// length. Used by the server-rendered listing page (internal links crawlers
// can follow) and by the "no longer available" page. FYI's own boats come
// first, then co-brokerage boats fill the row.
//
// Best effort throughout: a feed error means fewer suggestions, never a
// failed page.

import { MANUAL_LISTINGS } from './manualListings.js';
import { plsConfigured, plsSearch, PLS_CARD_FIELDS } from './plsFeed.js';
import { formatMoney, listPrice } from './price.js';
import { listingLocation } from './specFields.js';
import { applyListingOverrides } from './listingOverrides.js';

const INVENTORY_URL = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const FYI_TTL_MS = 15 * 60 * 1000;
const LENGTH_BAND = 0.15;

export interface SimilarBoat {
  id: string;
  /** "2019 Azimut Grande 27M". */
  title: string;
  boatName?: string;
  /** "$4,999,995" or "Price on request". */
  price: string;
  lengthFt?: number;
  location?: string;
  image?: string;
}

const num = (v: unknown): number | undefined => {
  const n = parseFloat(String(v ?? '').replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function toSimilar(it: Record<string, any>): SimilarBoat {
  const img = Array.isArray(it.Images) ? it.Images[0] : undefined;
  const image = typeof img === 'string' ? img : img?.Uri || undefined;
  const title = [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim();
  return {
    id: String(it.DocumentID || ''),
    title: title || String(it.BoatName || 'Yacht'),
    boatName: title && it.BoatName ? String(it.BoatName) : undefined,
    price: formatMoney(listPrice(it)),
    lengthFt: num(it.LengthOverall ?? it.NominalLength),
    location: listingLocation(it),
    image,
  };
}

let fyiCache: { rows: Record<string, any>[]; at: number } | null = null;

/** FYI's active boats as card rows, cached per instance. Empty on error. */
async function fyiActive(): Promise<Record<string, any>[]> {
  if (fyiCache && Date.now() - fyiCache.at < FYI_TTL_MS) return fyiCache.rows;
  try {
    const url = new URL(INVENTORY_URL);
    url.searchParams.set('key', KEY);
    url.searchParams.set('salesstatus', 'active');
    url.searchParams.set('rows', '400');
    url.searchParams.set('fields', PLS_CARD_FIELDS);
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    const rows = (Array.isArray(data?.results) ? data.results : []).map((r: Record<string, any>) => ({
      ...applyListingOverrides(r), Images: Array.isArray(r.Images) ? r.Images.slice(0, 1) : [],
    }));
    fyiCache = { rows: [...MANUAL_LISTINGS, ...rows], at: Date.now() };
    return fyiCache.rows;
  } catch {
    return fyiCache?.rows ?? MANUAL_LISTINGS;
  }
}

const sameMake = (a: unknown, b: unknown) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
// PLS ORs the words of an unquoted make: "Ferretti Yachts" must be quoted.
const plsMake = (make: string) => { const m = make.replace(/"/g, '').trim(); return /\s/.test(m) ? `"${m}"` : m; };

export async function findSimilarBoats(
  boat: { id: string; make?: string; lengthFt?: number },
  max = 6,
): Promise<SimilarBoat[]> {
  const { id, make, lengthFt } = boat;
  const lo = lengthFt ? lengthFt * (1 - LENGTH_BAND) : 0;
  const hi = lengthFt ? lengthFt * (1 + LENGTH_BAND) : 0;
  const inBand = (it: Record<string, any>) => {
    const len = num(it.LengthOverall ?? it.NominalLength);
    return !!lengthFt && !!len && len >= lo && len <= hi;
  };
  const gap = (it: Record<string, any>) => {
    const len = num(it.LengthOverall ?? it.NominalLength);
    return lengthFt && len ? Math.abs(len - lengthFt) : Infinity;
  };
  const rank = (rows: Record<string, any>[]) => rows
    .filter((it) => String(it.DocumentID) !== id && (sameMake(it.MakeString, make) || inBand(it)))
    .sort((a, b) =>
      Number(sameMake(b.MakeString, make)) + Number(inBand(b)) - Number(sameMake(a.MakeString, make)) - Number(inBand(a))
      || gap(a) - gap(b));

  const picked: Record<string, any>[] = rank(await fyiActive()).slice(0, max);
  const seen = new Set<string>([id, ...picked.map((it) => String(it.DocumentID))]);

  if (picked.length < max && plsConfigured() && (make || lengthFt)) {
    const searches: Promise<Record<string, any>[]>[] = [];
    const run = (q: Record<string, string>) =>
      plsSearch({ ...q, rows: '12' }, { fields: PLS_CARD_FIELDS, cardOnly: true, timeoutMs: 5_000 }).then((r) => r.results).catch(() => []);
    if (make) {
      searches.push(run(lengthFt
        ? { make: plsMake(make), length: `${Math.floor(lengthFt * 0.6)}:${Math.ceil(lengthFt * 1.5)}|feet` }
        : { make: plsMake(make) }));
    }
    if (lengthFt) searches.push(run({ length: `${Math.floor(lo)}:${Math.ceil(hi)}|feet` }));
    for (const rows of await Promise.all(searches)) {
      for (const it of rank(rows)) {
        const key = String(it.DocumentID);
        if (picked.length >= max) break;
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(it);
      }
    }
  }
  return picked.map(toSimilar);
}

/** A few of FYI's largest active boats — for a gone listing we know nothing about. */
export async function featuredBoats(max = 6): Promise<SimilarBoat[]> {
  const rows = await fyiActive();
  const len = (it: Record<string, any>) => num(it.LengthOverall ?? it.NominalLength) ?? 0;
  return [...rows].sort((a, b) => len(b) - len(a)).slice(0, max).map(toSimilar);
}
