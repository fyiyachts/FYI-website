// Price reductions recorded by the daily api/cron/price-snapshot (the feeds
// have no previous-price field — see api/_lib/priceHistory.ts). Empty until
// the cron has seen a price go down, i.e. from its first snapshot forward.
//
//   GET /api/yachts/price-drops          → { drops, reduced, configured }
//        drops   — FYI exclusives, the list the portal's Price Drops page reads
//        reduced — { id: { previous, price, currency, date, pct } } for every
//                  boat (exclusive + co-brokerage) inside its 90-day "Price
//                  Reduced" window: cards and listing pages badge from this
//   GET /api/yachts/price-drops?cards=1  → { numResults, results, reduced }
//        feed-shaped card rows for the "Price reduced" filter on /yachts-for-sale
import { getReducedCards, getReducedIndex, kvConfigured, kvGetJson, withManualDrops } from '../_lib/priceHistory.js';

type VercelRequest = { method?: string; query?: Record<string, string | string[]> };
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  json(b: unknown): VercelResponse;
  end(): VercelResponse;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const wantCards = !!req.query?.cards;
  // Includes hand-entered reductions (api/_lib/listingOverrides.ts) even without
  // KV, so a preview deployment shows the same "was" prices as production.
  const index = await getReducedIndex();
  if (!kvConfigured()) {
    return res.status(200).json(wantCards
      ? { numResults: 0, results: [], reduced: index.items, configured: false }
      : { drops: [], reduced: index.items, configured: false });
  }
  if (wantCards) {
    // Only boats still inside the window, hidden prices never.
    const results = (await getReducedCards()).filter((c) => index.items[String(c.DocumentID)] && !c.PriceHideInd);
    return res.status(200).json({ numResults: results.length, results, reduced: index.items, configured: true });
  }
  const drops = await kvGetJson<unknown[]>('price:drops').catch(() => null);
  return res.status(200).json({ drops: Array.isArray(drops) ? withManualDrops(drops) : [], reduced: index.items, configured: true });
}
