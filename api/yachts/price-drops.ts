// Serves the accumulated real price drops recorded by the daily
// api/cron/price-snapshot. Empty until the cron has two snapshots to
// compare (i.e. after it runs on two separate days).
const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

type VercelRequest = { method?: string };
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

  if (!KV_URL || !KV_TOKEN) return res.status(200).json({ drops: [], configured: false });
  try {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent('price:drops')}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const data = await r.json() as { result?: string };
    const drops = data.result ? JSON.parse(data.result) : [];
    return res.status(200).json({ drops: Array.isArray(drops) ? drops : [], configured: true });
  } catch {
    return res.status(200).json({ drops: [], configured: true });
  }
}
