// Daily price snapshot (Vercel Cron, 07:00 UTC) — the source of every "Price
// Reduced" badge on the site, for FYI exclusives AND co-brokerage boats.
//
// The feeds have no previous-price field (see api/_lib/priceHistory.ts), so
// this records each active boat's asking price per DocumentID —
// { price, currency, normPrice, firstSeen, lastChanged, previousPrice } — and
// when today's price is lower than the stored one, keeps the old price as
// previousPrice and stamps lastChanged. The site shows the reduction for 90
// days. Reductions only exist from the first snapshot forward.
//
// A price is compared in the listing's own currency: the USD NormPrice of a
// euro boat moves with the exchange rate every day and would invent drops.
//
// Also keeps `price:drops` (FYI exclusives, the portal's Price Drops page) in
// the shape that page already reads. No-ops when KV isn't configured.

import { MANUAL_LISTINGS } from '../_lib/manualListings.js';
import { plsConfigured, plsFetchAll, plsSearch, PLS_CARD_FIELDS } from '../_lib/plsFeed.js';
import { listPrice, usdEquivalent } from '../_lib/price.js';
import {
  getAllPriceRecords, kvConfigured, kvGetJson, kvSetJson, reductionOf, writePriceRecords,
  REDUCED_WINDOW_DAYS, type PriceRecord, type Reduction,
} from '../_lib/priceHistory.js';
import { applyListingOverrides, dropRemovedListings, manualReductions } from '../_lib/listingOverrides.js';

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const PAGE_ROWS = 500;
const MAX_PAGES = 6;
/** A change smaller than this is rounding, not a reduction. */
const MIN_DROP = 0.005;
/** Boats gone from the feed this long are forgotten. */
const GONE_TTL_DAYS = 180;
/** Card rows fetched for newly reduced co-brokerage boats, per run. */
const NEW_CARDS_PER_RUN = 80;
const REDUCED_CARDS_CAP = 600;

// The portal's Price Drops page (exclusives only) — unchanged rules.
const DROPS_MIN_PCT = 2;
const DROPS_TTL_DAYS = 60;
const DROPS_CAP = 200;

/** PLS fields for the snapshot: no Images — this pages ~9,000 boats. */
const SNAPSHOT_FIELDS = 'DocumentID,Price,NormPrice,PriceHideInd,MakeString,LengthOverall,NominalLength';

export const maxDuration = 300;

type VercelRequest = { method?: string; query: Record<string, string | string[]>; headers: Record<string, string | undefined> };
type VercelResponse = { status(c: number): VercelResponse; json(b: unknown): VercelResponse };

const num = (v: unknown): number | undefined => {
  const n = parseFloat(String(v ?? '').replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

async function fetchExclusives(): Promise<Record<string, any>[]> {
  const seen = new Set<string>();
  const out: Record<string, any>[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(UPSTREAM);
    url.searchParams.set('key', KEY);
    url.searchParams.set('salesstatus', 'active');
    url.searchParams.set('rows', String(PAGE_ROWS));
    url.searchParams.set('start', String(page * PAGE_ROWS));
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`inventory feed HTTP ${res.status}`);
    const data = (await res.json()) as { results?: Record<string, any>[] };
    const items = Array.isArray(data.results) ? data.results : [];
    items.forEach(applyListingOverrides); // manual price fixes count as the real price
    for (const it of dropRemovedListings(items)) { // a listing taken off the site counts as gone
      const id = String(it.DocumentID || '');
      if (id && !seen.has(id)) { seen.add(id); out.push(it); }
    }
    if (items.length < PAGE_ROWS) break;
  }
  return out;
}

const firstImage = (it: Record<string, any>): string =>
  (Array.isArray(it.Images) ? it.Images : []).map((x: any) => (typeof x === 'string' ? x : x?.Uri || '')).filter(Boolean)[0] || '';

/** The slice of a feed row a grid card needs (what /api/yachts/cobrokerage returns). */
function cardRow(it: Record<string, any>, type: 'e' | 'c'): Record<string, any> {
  const keep = ['DocumentID', 'SalesStatus', 'MakeString', 'Model', 'ModelYear', 'BoatName', 'Price', 'OriginalPrice',
    'NormPrice', 'PriceHideInd', 'LengthOverall', 'NominalLength', 'NormNominalLength', 'BoatLocation',
    'BoatCategoryCode', 'BoatClassCode', 'SaleClassCode', 'LastModificationDate', 'ItemReceivedDate', 'CompanyName'];
  const row: Record<string, any> = {};
  for (const k of keep) if (it[k] != null) row[k] = it[k];
  const img = Array.isArray(it.Images) ? it.Images[0] : undefined;
  row.Images = img ? [img] : [];
  if (type === 'c') row.ListingType = 'cobrokerage';
  return row;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!kvConfigured()) return res.status(200).json({ ok: true, configured: false });
  const nowIso = new Date((req.query?.now as string) || Date.now()).toISOString().slice(0, 10);

  try {
    // 1. Today's boats. A feed that fails is skipped whole: its boats are
    //    neither updated nor marked gone.
    const [exclusiveRows, co] = await Promise.all([
      fetchExclusives().then((rows) => [...MANUAL_LISTINGS, ...rows]).catch((err) => {
        console.error('[price-snapshot] exclusives failed:', err?.message || err);
        return null;
      }),
      plsConfigured()
        ? plsFetchAll(SNAPSHOT_FIELDS).catch((err) => {
            console.error('[price-snapshot] co-brokerage failed:', err?.message || err);
            return null;
          })
        : Promise.resolve(null),
    ]);
    if (!exclusiveRows && !co) return res.status(502).json({ ok: false, error: 'both feeds failed' });

    const todayRows = new Map<string, { it: Record<string, any>; type: 'e' | 'c' }>();
    for (const it of exclusiveRows ?? []) {
      const id = String(it.DocumentID || '');
      if (id) todayRows.set(id, { it, type: 'e' });
    }
    for (const it of co?.results ?? []) {
      const id = String(it.DocumentID || '');
      // FYI's own boats are in PLS too: the exclusive version wins.
      if (id && !todayRows.has(id)) todayRows.set(id, { it, type: 'c' });
    }

    // 2. Diff against the stored history.
    const history = await getAllPriceRecords();
    const changed = new Map<string, PriceRecord>();
    const removed: string[] = [];
    const reduced: Record<string, Reduction> = {};
    const newlyReduced: string[] = [];
    const manual_ = manualReductions();

    for (const [id, { it, type }] of todayRows) {
      const shown = listPrice(it); // undefined when hidden or absent
      const prev = history.get(id);
      const base: PriceRecord = prev ? { ...prev } : { firstSeen: nowIso, type };
      const rec: PriceRecord = {
        ...base,
        type,
        price: shown?.amount,
        currency: shown?.currency,
        normPrice: usdEquivalent(it),
        make: it.MakeString || base.make,
        lengthFt: num(it.LengthOverall ?? it.NominalLength) ?? base.lengthFt,
      };
      delete rec.gone;

      const before = prev?.price;
      const beforeCurrency = prev?.currency;
      // A "reduction" dated the day the boat was first recorded cannot have
      // been observed: it came from the old price:snapshot key, which the
      // first run used as a seed and which turned out to be of unknown age
      // (2026-11-13). Its date would be wrong, so it is dropped.
      if (rec.previousPrice && rec.lastChanged && rec.lastChanged === rec.firstSeen) {
        delete rec.previousPrice;
        delete rec.lastChanged;
      }

      if (shown && before && beforeCurrency === shown.currency) {
        if (shown.amount <= before * (1 - MIN_DROP)) {
          rec.previousPrice = before;
          rec.lastChanged = nowIso;
          newlyReduced.push(id);
        } else if (shown.amount > before) {
          delete rec.previousPrice; // back up: no longer "reduced"
          rec.lastChanged = nowIso;
        }
      } else if (shown && beforeCurrency && beforeCurrency !== shown.currency) {
        // Re-priced in another currency: nothing to compare against.
        delete rec.previousPrice;
        rec.lastChanged = nowIso;
      }
      if (!shown) delete rec.previousPrice; // hidden price: never a "was"
      // A reduction entered by hand (api/_lib/listingOverrides.ts) is this
      // boat's history while it is shown: correcting the override's price
      // must not read as a price change.
      const manual = manual_[id];
      if (manual && shown && shown.currency === manual.currency && shown.amount === manual.price) {
        rec.previousPrice = manual.previous;
        rec.lastChanged = manual.date;
      }

      if (!prev || JSON.stringify(prev) !== JSON.stringify(rec)) changed.set(id, rec);
      const r = reductionOf(rec, nowIso);
      if (r) reduced[id] = r;
    }

    // 3. Boats no longer in a feed that was read in full: mark gone (the 410
    //    page uses make/length to suggest similar boats), forget after a while.
    const goneCutoff = new Date(Date.parse(nowIso) - GONE_TTL_DAYS * 864e5).toISOString().slice(0, 10);
    for (const [id, rec] of history) {
      if (todayRows.has(id)) continue;
      const feedRead = rec.type === 'e' ? !!exclusiveRows : !!co;
      if (!feedRead) { const r = reductionOf(rec, nowIso); if (r) reduced[id] = r; continue; }
      if (!rec.gone) changed.set(id, { ...rec, gone: nowIso });
      else if (rec.gone < goneCutoff) removed.push(id);
    }

    await writePriceRecords(changed, removed);

    // 4. Card rows for the "Price reduced" filter. Exclusive rows are in hand;
    //    co-brokerage cards are fetched once, when the boat is first reduced.
    const oldCards = (await kvGetJson<Record<string, any>[]>('price:reduced:cards').catch(() => null)) || [];
    const cardById = new Map<string, Record<string, any>>(oldCards.map((c) => [String(c.DocumentID), c]));
    const need: string[] = [];
    for (const id of Object.keys(reduced)) {
      const row = todayRows.get(id);
      if (!row) continue;
      if (row.type === 'e') cardById.set(id, cardRow(row.it, 'e'));
      else if (!cardById.has(id) || newlyReduced.includes(id)) need.push(id);
      else {
        // Keep the stored card's photo; refresh its price from today's row.
        const card = cardById.get(id)!;
        card.Price = row.it.Price; card.NormPrice = row.it.NormPrice; card.PriceHideInd = row.it.PriceHideInd;
      }
    }
    const fetchNow = need.slice(0, NEW_CARDS_PER_RUN);
    for (let i = 0; i < fetchNow.length; i += 5) {
      const rows = await Promise.all(fetchNow.slice(i, i + 5).map((id) =>
        plsSearch({ documentid: id, rows: '1' }, { fields: PLS_CARD_FIELDS, cardOnly: true })
          .then((r) => r.results.find((x) => String(x.DocumentID) === id))
          .catch(() => undefined)));
      rows.forEach((row, k) => { if (row) cardById.set(fetchNow[i + k], cardRow(row, 'c')); });
    }
    const cards = Object.keys(reduced)
      .filter((id) => cardById.has(id) && todayRows.has(id))
      .sort((a, b) => (reduced[b].date < reduced[a].date ? -1 : reduced[b].date > reduced[a].date ? 1 : reduced[b].pct - reduced[a].pct))
      .slice(0, REDUCED_CARDS_CAP)
      .map((id) => cardById.get(id)!);

    await kvSetJson('price:reduced', { updated: nowIso, items: reduced });
    await kvSetJson('price:reduced:cards', cards);

    // 5. The portal's Price Drops list (exclusives), same shape as before.
    if (exclusiveRows) {
      const existing = (await kvGetJson<any[]>('price:drops').catch(() => null)) || [];
      const byId = new Map<string, any>(existing.map((d) => [String(d.id), d]));
      for (const id of newlyReduced) {
        const row = todayRows.get(id);
        const r = reduced[id];
        if (!row || row.type !== 'e' || !r || r.currency !== 'USD' || r.pct < DROPS_MIN_PCT) continue;
        byId.set(id, {
          id, make: row.it.MakeString || '', model: row.it.Model || '', year: Number(row.it.ModelYear) || 0,
          image: firstImage(row.it), oldPrice: r.previous, newPrice: r.price, pct: r.pct, date: nowIso,
        });
      }
      const cutoff = new Date(Date.parse(nowIso) - DROPS_TTL_DAYS * 864e5).toISOString().slice(0, 10);
      const drops = [...byId.values()]
        .filter((d) => d.date >= cutoff && todayRows.get(String(d.id))?.type === 'e' && reduced[String(d.id)])
        .sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.pct - a.pct))
        .slice(0, DROPS_CAP);
      await kvSetJson('price:drops', drops);
    }

    return res.status(200).json({
      ok: true,
      date: nowIso,
      tracked: todayRows.size,
      exclusives: exclusiveRows ? exclusiveRows.length : 'feed failed',
      cobrokerage: co ? co.results.length : plsConfigured() ? 'feed failed' : 'not configured',
      firstRun: history.size === 0,
      written: changed.size,
      pruned: removed.length,
      newReductions: newlyReduced.length,
      showingReduced: Object.keys(reduced).length,
      windowDays: REDUCED_WINDOW_DAYS,
    });
  } catch (err: any) {
    console.error('[price-snapshot] failed:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'snapshot failed' });
  }
}
