// Daily price-history snapshot — the only reliable source of genuine price
// drops. The boats.com feed carries no trustworthy "previous asking price"
// (its OriginalPrice is the build/base price, frequently in the vessel's
// origin currency), so a real Price Drops page must compare today's asking
// price against a stored prior snapshot. This cron records each active
// vessel's normalized USD price keyed by DocumentID, diffs it against
// yesterday's snapshot, and accumulates true reductions into `price:drops`.
// No-ops gracefully when KV isn't configured.
const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const PAGE_ROWS = 500;
const MAX_PAGES = 6;
const DROP_MIN_PCT = 2;     // ignore sub-2% noise / rounding
const DROP_TTL_DAYS = 60;
const DROP_CAP = 200;

type VercelRequest = { method?: string; query: Record<string, string | string[]>; headers: Record<string, string | undefined> };
type VercelResponse = { status(c: number): VercelResponse; json(b: unknown): VercelResponse };

async function kvGet(key: string): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    if (!res.ok) return null;
    const data = await res.json() as { result?: string };
    return data.result ? JSON.parse(data.result) : null;
  } catch { return null; }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(String(JSON.stringify(value))),
    });
  } catch { /* best effort */ }
}

async function fetchActive(): Promise<Record<string, any>[]> {
  const seen = new Set<string>();
  const out: Record<string, any>[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(UPSTREAM);
    url.searchParams.set('key', KEY);
    url.searchParams.set('salesstatus', 'active');
    url.searchParams.set('rows', String(PAGE_ROWS));
    url.searchParams.set('start', String(page * PAGE_ROWS));
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) break;
    const data = await res.json() as { results?: Record<string, any>[] };
    const items = Array.isArray(data.results) ? data.results : [];
    for (const it of items) {
      const id = String(it.DocumentID || '');
      if (id && !seen.has(id)) { seen.add(id); out.push(it); }
    }
    if (items.length < PAGE_ROWS) break;
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // today: id -> { price, make, model, year, image }
  const items = await fetchActive();
  const today: Record<string, { p: number; make: string; model: string; year: number; img: string }> = {};
  for (const it of items) {
    if (it.PriceHideInd) continue;
    const p = Number(it.NormPrice);
    if (!Number.isFinite(p) || p <= 0) continue;
    const img = (Array.isArray(it.Images) ? it.Images : [])
      .map((x: any) => (typeof x === 'string' ? x : x?.Uri || ''))
      .filter(Boolean)[0] || '';
    today[String(it.DocumentID)] = {
      p, make: it.MakeString || '', model: it.Model || '', year: Number(it.ModelYear) || 0, img,
    };
  }

  const prev = (await kvGet('price:snapshot')) as Record<string, number> | null;
  const nowIso = new Date(req.query?.now as string || Date.now()).toISOString().slice(0, 10);
  let newDrops = 0;
  if (prev) {
    const existing = ((await kvGet('price:drops')) as any[] | null) || [];
    const byId = new Map<string, any>(existing.map((d) => [d.id, d]));
    for (const [id, cur] of Object.entries(today)) {
      const old = prev[id];
      if (typeof old !== 'number' || old <= 0) continue;
      const pct = Math.round(((old - cur.p) / old) * 100);
      if (pct >= DROP_MIN_PCT) {
        byId.set(id, {
          id, make: cur.make, model: cur.model, year: cur.year, image: cur.img,
          oldPrice: old, newPrice: cur.p, pct, date: nowIso,
        });
        newDrops++;
      }
    }
    // prune stale, keep only vessels still listed, newest first, capped
    const cutoff = new Date(Date.now() - DROP_TTL_DAYS * 864e5).toISOString().slice(0, 10);
    const drops = [...byId.values()]
      .filter((d) => d.date >= cutoff && today[d.id])
      .sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.pct - a.pct))
      .slice(0, DROP_CAP);
    await kvSet('price:drops', drops);
  }

  const snapshot: Record<string, number> = {};
  for (const [id, cur] of Object.entries(today)) snapshot[id] = cur.p;
  await kvSet('price:snapshot', snapshot);

  return res.status(200).json({ ok: true, tracked: Object.keys(today).length, hadPrevious: !!prev, newDrops });
}
