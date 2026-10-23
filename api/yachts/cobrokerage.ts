// Co-brokerage listings (BoatsGroup PLS). Same response shape as
// /api/yachts/proxy ({numResults, results}) so the front end reads both feeds
// with one normalizer. Every row carries ListingType: 'cobrokerage'.
// FYI's own boats are also in PLS; the client drops them by DocumentID so
// they only ever show as FYI Exclusives.

import { plsSearch, plsConfigured, PLS_CARD_FIELDS } from '../_lib/plsFeed.js';

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  end(): VercelResponse;
};

const MAX_ROWS = 500;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!plsConfigured()) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(200).json({ numResults: 0, results: [], note: 'BOATS_PLS_API_KEY not set' });
  }

  const q: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.query)) q[k.toLowerCase()] = first(v);
  const rows = Math.min(Math.max(Number(q.rows) || 48, 1), MAX_ROWS);
  q.rows = String(rows);
  const detail = q.detail === '1';

  try {
    const data = await plsSearch(q, detail ? {} : { fields: PLS_CARD_FIELDS, cardOnly: true });
    // Co-brokerage inventory changes a few times a day; let the CDN answer
    // repeat queries so visitors never wait on BoatsGroup.
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[yachts/cobrokerage] error:', err?.message || err);
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    return res.status(502).json({ error: 'Request failed', results: [], numResults: 0 });
  }
}
