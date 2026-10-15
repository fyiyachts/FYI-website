import { fetchFleet, repKey, soldWindowStart, type FleetBoat } from '../_lib/fyiFleet.js';

// GET /api/team/data            → per-broker listing counts (keyed by repKey)
// GET /api/team/data?rep=Name   → that broker's boats, active + sold
//
// The roster itself (photos, titles, languages) lives client-side in
// components/team/fyiTeam.ts; this endpoint only supplies what the feed
// knows: who has which listings. Auth: same-origin portal use; data is the
// public listings feed, so no session check is required.

export default async function handler(req: any, res: any) {
  // Public listings data — served cross-origin so the fyiyachts.com
  // broker-listings embed (public/broker-listings.js) can fetch it.
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const fleet = await fetchFleet();
    const repParam = typeof req.query?.rep === 'string' ? req.query.rep : '';

    if (repParam) {
      const key = repKey(repParam);
      const mine = fleet.filter((b) => b.rep && repKey(b.rep) === key);
      const active = mine.filter((b) => b.status === 'Active');
      const sold = mine.filter((b) => b.status !== 'Active');
      // Active: newest model year first.
      //
      // Sold: the broker's WHOLE history, with the last 12 months first and
      // largest-to-smallest within each part (client, 2026-09-03). Filtering to
      // the window instead was too blunt — 55 of FYI's 993 sold rows are inside
      // it and only 13 of 56 reps have one, so most profiles lost their track
      // record entirely. The profile shows 9 cards before "show more", so the
      // window leads the visible grid either way.
      const byYear = (a: FleetBoat, b: FleetBoat) => (b.year ?? 0) - (a.year ?? 0);
      const from = soldWindowStart();
      const recent = (b: FleetBoat) => ((b.soldDate ?? '').slice(0, 10) >= from ? 0 : 1);
      const bySold = (a: FleetBoat, b: FleetBoat) =>
        recent(a) - recent(b)
        || (b.lengthFt ?? 0) - (a.lengthFt ?? 0)
        || (b.soldDate ?? '').localeCompare(a.soldDate ?? '');
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json({ active: active.sort(byYear), sold: sold.sort(bySold) });
    }

    const counts: Record<string, { rep: string; active: number; sold: number }> = {};
    for (const b of fleet) {
      if (!b.rep) continue;
      const key = repKey(b.rep);
      counts[key] ??= { rep: b.rep, active: 0, sold: 0 };
      if (b.status === 'Active') counts[key].active++;
      else counts[key].sold++;
    }
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ counts });
  } catch (err) {
    console.error('[team/data] failed:', err);
    return res.status(502).json({ error: 'Listings feed unavailable — please try again shortly.' });
  }
}
