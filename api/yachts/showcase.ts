// Small, CDN-cacheable boat sets for page furniture — so the browser never
// pulls whole inventories for a strip of three cards.
//
// Before (2026-10-28) every listing page view made ~8 proxy calls: "More like
// this" fetched the whole active book (rows=400), the sold strip and the
// nav's Sell panel each fetched the whole sold book (3 × rows=400), and the
// nav's Yachts panel fetched rows=300. A few boats in a row tripped the
// proxy's per-IP limit and the listing lookup itself got a 429.
//
// Now the server builds each set from fetchFleet() (FYI's book, active + sold,
// cached 15 min per instance) plus the hand-entered listings, and returns a
// few compact rows. ?sections= picks what to build:
//   similar   — up to 3 active boats like ?id= (make match, length band)
//   sold      — 3 sold boats for the listing page strip (rolling window first,
//               largest first — same rule as the sold gallery)
//   menuSold  — 3 sold 80ft+ boats for the nav's Sell panel
//   menuTop   — FYI's 7 highest-asking active boats for the nav's Yachts panel

import { fetchFleet, normalizeFleetItem, soldWindowStart, type FleetBoat } from '../_lib/fyiFleet.js';
import { MANUAL_LISTINGS } from '../_lib/manualListings.js';

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  json(b: unknown): VercelResponse;
};

export const maxDuration = 30;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? '';

/** The compact card row every section returns; the client formats it. */
function card(b: FleetBoat) {
  return {
    id: b.id,
    name: b.name, // BoatName, or year/make/model when the boat has none
    year: b.year,
    make: b.make,
    model: b.model,
    lengthFt: b.lengthFt,
    priceUsd: b.priceUsd,
    image: b.image,
  };
}

const withinWindow = (soldDate: string | undefined, from: string) => !!soldDate && soldDate.slice(0, 10) >= from;

/** Similar active boats: same make +2, length within 0.6×–1.5× +1. Hand-entered first, as the proxy lists them. */
function similar(active: FleetBoat[], id: string, make: string, len: number): FleetBoat[] {
  const band = len > 0 ? [len * 0.6, len * 1.5] : null;
  return active
    .filter((b) => b.id !== id && b.image)
    .map((b, i) => {
      let score = 0;
      if (make && (b.make || '').toLowerCase() === make.toLowerCase()) score += 2;
      if (band && b.lengthFt && b.lengthFt >= band[0] && b.lengthFt <= band[1]) score += 1;
      return { b, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .slice(0, 3)
    .map((x) => x.b);
}

/** Listing-page sold strip: rolling window first, largest first, then the rest of the book. */
function soldStrip(sold: FleetBoat[]): FleetBoat[] {
  const from = soldWindowStart();
  const recent = (b: FleetBoat) => (withinWindow(b.soldDate, from) ? 0 : 1);
  return sold
    .filter((b) => b.image)
    .sort((a, b) => recent(a) - recent(b)
      || (b.lengthFt ?? 0) - (a.lengthFt ?? 0)
      || (b.soldDate ?? '').localeCompare(a.soldDate ?? ''))
    .slice(0, 3);
}

/**
 * Nav Sell panel: sold boats over 80ft — the rolling window first, then
 * younger than 15 model-years, then the rest; each group largest first.
 */
function menuSold(sold: FleetBoat[]): FleetBoat[] {
  const from = soldWindowStart();
  const minYear = new Date().getFullYear() - 15;
  const big = sold.filter((b) => b.image && (b.lengthFt ?? 0) > 80);
  const byLength = (a: FleetBoat, b: FleetBoat) =>
    (b.lengthFt ?? 0) - (a.lengthFt ?? 0)
    || (b.soldDate ?? '').localeCompare(a.soldDate ?? '')
    || (b.year ?? 0) - (a.year ?? 0);
  const inWindow = big.filter((b) => withinWindow(b.soldDate, from)).sort(byLength);
  const older = big.filter((b) => !withinWindow(b.soldDate, from));
  const strict = older.filter((b) => (b.year ?? 0) > minYear).sort(byLength);
  const rest = older.filter((b) => (b.year ?? 0) <= minYear).sort(byLength);
  return [...inWindow, ...strict, ...rest].slice(0, 3);
}

/** Nav Yachts panel: the highest-asking active boats that have a photo. */
function menuTop(active: FleetBoat[]): FleetBoat[] {
  return active
    .filter((b) => b.image && (b.priceUsd ?? 0) > 0)
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, 7);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sections = new Set(first(req.query.sections).split(',').map((s) => s.trim()).filter(Boolean));
  const id = first(req.query.id).replace(/[^0-9]/g, '');
  const make = first(req.query.make).slice(0, 60);
  const len = Number(first(req.query.len)) || 0;

  try {
    const fleet = await fetchFleet();
    const manual = MANUAL_LISTINGS.map(normalizeFleetItem);
    const active = [...manual, ...fleet.filter((b) => b.status === 'Active')];
    const sold = fleet.filter((b) => b.status !== 'Active');

    const out: Record<string, ReturnType<typeof card>[]> = {};
    if (sections.has('similar')) out.similar = similar(active, id, make, len).map(card);
    if (sections.has('sold')) out.sold = soldStrip(sold).map(card);
    if (sections.has('menuSold')) out.menuSold = menuSold(sold).map(card);
    if (sections.has('menuTop')) out.menuTop = menuTop(active).map(card);

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json(out);
  } catch (err: any) {
    console.error('[yachts/showcase] error:', err?.message || err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Request failed' });
  }
}
