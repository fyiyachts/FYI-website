// Manual fixes to specific listings, for while BoatWizard can't be edited.
//
// Two kinds, both keyed by DocumentID:
//   • HIDDEN_PHOTOS — photos the site doesn't show (they stay in BoatWizard).
//   • PRICES — a new asking price, shown with a "Price Reduced" from the old one.
//   • PHOTO_SETS — the client's own photos in place of the feed's, after the
//     feed's first few, in an order that is one list to edit.
// Both retire themselves: a hidden photo no longer in the feed matches
// nothing, and a price override only applies while the feed still shows the
// old price — once BoatWizard is updated (to this price or any other), the
// feed wins. Delete an entry once BoatWizard is fixed.
//
// Applied wherever an FYI listing's feed row is read: api/yachts/proxy.ts
// (listing page, cards, gallery, brochure), api/listing.ts (the page crawlers
// get), the daily price snapshot, similar boats, Brianna, llms-inventory,
// share links and the listing overview. The reductions are merged into the
// price-history readers (api/_lib/priceHistory.ts), so badges, cards and the
// listing page show them at once — not only after the next daily snapshot.

import { priceCurrency } from './price.js';
import type { Reduction } from './priceHistory.js';

/* ------------------------------------------------ hidden photos */

// Matched by file name, not position: if BoatWizard adds, removes or reorders
// photos, a position would start hiding the wrong one. The file name is the
// last part of the photo's URL (unchanged by /images/ vs /resize/ or a query).

/** The 2012 Azimut Grande 105 "SALE VITA": photos 12, 13, 14, 21, 25 and 26 as of 2026-11-16 (147 photos). */
const SALE_VITA_HIDDEN = [
  '2012-azimut-grande-105-power-9679457-20250505141117367-1_XLARGE.jpg', // #12
  '2012-azimut-grande-105-power-9679457-20250505141127579-1_XLARGE.jpg', // #13
  '2012-azimut-grande-105-power-9679457-20250505141138470-1_XLARGE.jpg', // #14
  '2012-azimut-grande-105-power-9679457-20250505141412399-1_XLARGE.jpg', // #21
  '2012-azimut-grande-105-power-9679457-20250505141515008-1_XLARGE.jpg', // #25
  '2012-azimut-grande-105-power-9679457-20250505141525302-1_XLARGE.jpg', // #26
];

/** DocumentID → file names of the photos to hide. */
const HIDDEN_PHOTOS: Record<string, readonly string[]> = {
  // Two listings of the same boat, deliberately; same photos, same order.
  '10391316': SALE_VITA_HIDDEN, // 2012 Azimut Grande 32M
  '10277901': SALE_VITA_HIDDEN, // 2012 Azimut 105
};

/* ------------------------------------------------ prices */

interface PriceOverride {
  /** New asking price, USD. */
  price: number;
  /** The price BoatWizard still shows, USD. The override applies only while the feed shows exactly this. */
  was: number;
  /** Day of the reduction (YYYY-MM-DD): the "Reduced <date>" on the site. */
  since: string;
}

/** DocumentID → price override. USD listings only. */
const PRICES: Record<string, PriceOverride> = {
  '10354522': { price: 2_595_000, was: 2_695_000, since: '2026-11-16' }, // 2020 Azimut S8
  // 2012 Azimut 105 "SALE VITA": the two deliberate listings of the same boat (client, 2026-11-20).
  '10277901': { price: 4_999_500, was: 5_275_000, since: '2026-11-20' }, // 2012 Azimut 105
  '10391316': { price: 4_999_500, was: 5_275_000, since: '2026-11-20' }, // 2012 Azimut Grande 32M
};

/* ------------------------------------------------ replacement photo sets */

// The client's photos, shown after the feed's first `keepFirst` photos instead
// of the rest of the feed's. Files live in public/listings/<dir>/ as
// <prefix>-NN.webp, NN being the number the broker gave the photo, so `order`
// is the broker's numbers in display order: to reorder the gallery, reorder
// this list (add a number to show a new file, drop one to hide it).

interface PhotoSet {
  keepFirst: number;
  dir: string;
  prefix: string;
  order: number[];
}

const PHOTO_SETS: Record<string, PhotoSet> = {
  // 1988 Burger Classic Motoryacht "Victory" (client, 2026-11-20, "New Burger
  // Pics" 1–26). 3 and 16 are byte-identical copies of 2 and 15, left out.
  '10387454': {
    keepFirst: 2,
    dir: 'burger-victory',
    prefix: 'victory',
    order: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  },
};

/* ------------------------------------------------ applying */

const OVERRIDDEN_IDS = [...new Set([...Object.keys(HIDDEN_PHOTOS), ...Object.keys(PRICES), ...Object.keys(PHOTO_SETS)])];

const fileName = (url: string): string => url.split(/[?#]/)[0].split('/').pop() || '';

const photoUrl = (x: unknown): string =>
  typeof x === 'string' ? x : (x as { Uri?: string; url?: string } | null)?.Uri || (x as { url?: string } | null)?.url || '';

const amount = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** True while the feed row still carries the old (pre-override) USD price. */
function feedShowsOldPrice(item: Record<string, any>, o: PriceOverride): boolean {
  return priceCurrency(item.Price) === 'USD' && amount(item.Price) === o.was;
}

/** Apply this listing's overrides to one feed row, in place. Returns the row. */
export function applyListingOverrides<T extends Record<string, any>>(item: T): T {
  const id = String(item?.DocumentID ?? '');
  if (!id) return item;
  const row = item as Record<string, any>;

  const hidden = HIDDEN_PHOTOS[id];
  if (hidden && Array.isArray(row.Images)) {
    const set = new Set(hidden);
    row.Images = row.Images.filter((x: unknown) => !set.has(fileName(photoUrl(x))));
  }

  const set = PHOTO_SETS[id];
  if (set && Array.isArray(row.Images)) {
    const kept = row.Images.slice(0, set.keepFirst);
    const caption = [row.ModelYear, row.MakeString, row.Model].filter(Boolean).join(' ');
    row.Images = [
      ...kept,
      ...set.order.map((n) => ({
        Caption: caption,
        Uri: `/listings/${set.dir}/${set.prefix}-${String(n).padStart(2, '0')}.webp`,
      })),
    ].map((img: Record<string, any>, i: number) => ({ ...img, Priority: String(i) }));
  }

  const p = PRICES[id];
  if (p && !row.PriceHideInd && feedShowsOldPrice(row, p)) {
    row.Price = `${p.price.toFixed(2)} USD`;
    row.NormPrice = p.price;
  }
  return item;
}

/**
 * The same for a feed response body (JSON text with `results`). Untouched —
 * not even re-serialised — unless it mentions one of the listings.
 */
export function applyListingOverridesInBody(body: string): string {
  if (!OVERRIDDEN_IDS.some((id) => body.includes(id))) return body;
  try {
    const data = JSON.parse(body);
    if (!Array.isArray(data?.results)) return body;
    data.results.forEach(applyListingOverrides);
    return JSON.stringify(data);
  } catch {
    return body;
  }
}

/** The manual price reductions, as the price history reports them. */
export function manualReductions(): Record<string, Reduction> {
  const out: Record<string, Reduction> = {};
  for (const [id, p] of Object.entries(PRICES)) {
    if (p.was <= p.price) continue;
    out[id] = {
      previous: p.was,
      price: p.price,
      currency: 'USD',
      date: p.since,
      pct: Math.max(1, Math.round(((p.was - p.price) / p.was) * 100)),
    };
  }
  return out;
}
