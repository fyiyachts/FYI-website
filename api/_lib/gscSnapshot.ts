import {
  SCOPE_WEBMASTERS_READONLY,
  getAccessToken,
  gFetch,
  listSites,
  loadServiceAccount,
  pickSite,
} from './googleAuth.js';

// Daily Search Console → Supabase snapshot (called from api/cron/seo-sync.ts).
//
// The GSC UI exports are lossy (1,000 rows, no query×page join) and only a
// human can pull them; the Search Analytics API has neither problem but the
// service-account key lives only in this project's env. This module closes
// the loop: pull the last-28-day Search Analytics picture through the key and
// persist it to the `gsc_snapshots` table in the project's Supabase
// (SUPABASE_URL), which dashboards can read directly. One capture per
// day; re-runs the same day upsert over themselves.
//
// Kinds stored per capture:
//   totals      — one row, no dimensions
//   date        — daily clicks/impressions across the window (trend line)
//   query       — top 1,000 queries
//   page        — top 1,000 pages
//   query_page  — top 2,500 query×page pairs (the join the UI never exports)

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const iso = (d: Date) => d.toISOString().slice(0, 10);

interface SnapshotRow {
  captured_on: string;
  site: string;
  window_start: string;
  window_end: string;
  kind: 'totals' | 'date' | 'query' | 'page' | 'query_page';
  key1: string;
  key2: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** PostgREST upsert in batches; unique (captured_on, site, kind, key1, key2). */
async function upsertRows(rows: SnapshotRow[]): Promise<void> {
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/gsc_snapshots?on_conflict=captured_on,site,kind,key1,key2`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows.slice(i, i + BATCH)),
      },
    );
    if (!res.ok) throw new Error(`gsc_snapshots upsert failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

export async function snapshotSearchAnalytics(): Promise<Record<string, unknown>> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return { ok: false, error: 'Supabase env vars not configured.' };
  const loaded = loadServiceAccount();
  if ('error' in loaded) return { ok: false, error: loaded.error };

  const token = await getAccessToken(loaded.creds, [SCOPE_WEBMASTERS_READONLY]);
  const site = pickSite(await listSites(token));
  if (!site) return { ok: false, error: 'Service account has no fyiyachts.com property in Search Console.' };

  // GSC data lags ~2 days; a 28-day window matches the UI default.
  const end = new Date(Date.now() - 2 * 86400_000);
  const start = new Date(end.getTime() - 28 * 86400_000);
  const range = { startDate: iso(start), endDate: iso(end) };
  const base = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`;

  const pulls: Array<{ kind: SnapshotRow['kind']; dimensions?: string[]; rowLimit?: number }> = [
    { kind: 'totals' },
    { kind: 'date', dimensions: ['date'] },
    { kind: 'query', dimensions: ['query'], rowLimit: 1000 },
    { kind: 'page', dimensions: ['page'], rowLimit: 1000 },
    { kind: 'query_page', dimensions: ['query', 'page'], rowLimit: 2500 },
  ];

  const capturedOn = iso(new Date());
  const rows: SnapshotRow[] = [];
  for (const p of pulls) {
    const data = await gFetch(token, base, {
      ...range,
      ...(p.dimensions ? { dimensions: p.dimensions } : {}),
      ...(p.rowLimit ? { rowLimit: p.rowLimit } : {}),
    });
    for (const r of data.rows || []) {
      rows.push({
        captured_on: capturedOn,
        site: site.siteUrl,
        window_start: range.startDate,
        window_end: range.endDate,
        kind: p.kind,
        key1: String(r.keys?.[0] ?? ''),
        key2: String(r.keys?.[1] ?? ''),
        clicks: Math.round(r.clicks ?? 0),
        impressions: Math.round(r.impressions ?? 0),
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      });
    }
  }

  await upsertRows(rows);
  const byKind = rows.reduce<Record<string, number>>((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {});
  return { ok: true, property: site.siteUrl, range, rows: rows.length, byKind };
}
