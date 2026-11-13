import { useEffect, useState } from 'react';
import { fetchJsonShared } from './sharedFetch';

// "Price Reduced" data for cards and listing pages.
//
// The feeds have no previous-price field, so reductions come from the daily
// price snapshot (api/cron/price-snapshot.ts → KV → /api/yachts/price-drops):
// a map of DocumentID → { previous, price, currency, date, pct } for every
// boat whose price went down in the last 90 days. One shared request per
// session, whichever component asks first.

export interface Reduction {
  previous: number;
  price: number;
  currency: string;
  /** Day the price went down (YYYY-MM-DD). */
  date: string;
  pct: number;
}

export type ReducedMap = Record<string, Reduction>;

const EMPTY: ReducedMap = {};

export function fetchReducedPrices(): Promise<ReducedMap> {
  return fetchJsonShared<{ reduced?: ReducedMap }>('/api/yachts/price-drops')
    .then((d) => (d && typeof d.reduced === 'object' && d.reduced ? d.reduced : EMPTY))
    .catch(() => EMPTY);
}

/** The reduced-price map; empty until loaded, and on any error. */
export function useReducedPrices(): ReducedMap {
  const [map, setMap] = useState<ReducedMap>(EMPTY);
  useEffect(() => {
    let alive = true;
    fetchReducedPrices().then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, []);
  return map;
}

/**
 * The reduction to show against a displayed price, or undefined. Only when the
 * recorded reduction is in the same currency and still above today's price —
 * and never for a hidden price (no `shown`).
 */
export function reductionFor(
  map: ReducedMap,
  id: string,
  shown: { amount: number; currency: string } | undefined | null,
): Reduction | undefined {
  const r = map[id];
  if (!r || !shown || r.currency !== shown.currency || r.previous <= shown.amount) return undefined;
  return r;
}
