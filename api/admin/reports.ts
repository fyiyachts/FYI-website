import { fail, ok, methodNotAllowed } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { hsRequest, listLeads, type FyiLead } from '../_lib/fyiHubspotLeads.js';

// GET /api/admin/reports?days=7|30|90|365&refresh=1   (admins only)
//
// Live HubSpot-backed dashboard for the admin "FYI Dashboard" page — the FYI
// port of valhalla-yacht-sales' /api/portal/reports. Time-windowed lead
// metrics with a prior-window trend, plus breakdowns by source / owner /
// status / brand / state and a recent-leads feed.
//
// Exact counts come from cheap `total`-only searches; breakdowns are computed
// over the newest ≤500 window contacts (flagged when that samples a larger
// window). Cached in KV for 5 minutes per window.

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
const CACHE_TTL = 300; // 5 min — dashboards want fresher data than the 1h stats page
export const maxDuration = 60;

export const ALLOWED_WINDOW_DAYS = [7, 30, 90, 365] as const;

// Same "responded / engaged" definition as api/admin/stats.ts — keep in sync.
const ENGAGED_STATUSES = [
  'RP - (IN TOUCH W BROKER)', 'Qualified', 'Deal pending', 'Purchased with FYI',
  'Listed with FYI', 'Boat owner', 'Later Buyer', 'Later Seller',
];

type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };
type Group = { filters: Filter[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hsCount(filterGroups: Group[]): Promise<number> {
  const r = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/contacts/search', {
    filterGroups,
    limit: 1,
  });
  if (!r.ok) throw new Error(`HubSpot count search failed (${r.status})`);
  return typeof r.json?.total === 'number' ? r.json.total : 0;
}

interface CountRow { label: string; value: number; pct: number }

function countBy(rows: FyiLead[], pick: (l: FyiLead) => string | null): CountRow[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const key = pick(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([label, value]) => ({
      label,
      value,
      pct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

async function computeReports(windowDays: number) {
  const day = 24 * 3600_000;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * day).toISOString();
  const priorStart = new Date(now.getTime() - 2 * windowDays * day).toISOString();

  const inWindow: Filter = { propertyName: 'createdate', operator: 'GTE', value: windowStart };
  const inPrior: Filter[] = [
    { propertyName: 'createdate', operator: 'GTE', value: priorStart },
    { propertyName: 'createdate', operator: 'LT', value: windowStart },
  ];

  // Exact counts (cheap total-only searches), throttled in small batches so
  // together with the sample pagination we stay under the search rate limit.
  const totalContacts = await hsCount([{ filters: [] }]);
  const newLeads = await hsCount([{ filters: [inWindow] }]);
  await sleep(250);
  const newLeadsPrior = await hsCount([{ filters: inPrior }]);
  const reachedOut = await hsCount([
    { filters: [inWindow, { propertyName: 'notes_last_contacted', operator: 'HAS_PROPERTY' }] },
  ]);
  await sleep(250);
  const responded = await hsCount([
    { filters: [inWindow, { propertyName: 'hs_lead_status', operator: 'IN', values: ENGAGED_STATUSES }] },
    { filters: [inWindow, { propertyName: 'hs_sales_email_last_replied', operator: 'HAS_PROPERTY' }] },
  ]);

  // Breakdown sample: the newest ≤500 contacts of the window.
  const sample = await listLeads(HS_TOKEN, { since: windowStart, limit: 500 });
  const leads = sample.leads;
  const unassigned = leads.filter((l) => !l.ownerId).length;

  return {
    generatedAt: now.toISOString(),
    totals: {
      contacts: totalContacts,
      windowDays,
      newLeads,
      newLeadsPrior,
      reachedOut,
      responded,
      unassignedInSample: unassigned,
    },
    sample: { size: leads.length, of: newLeads, truncated: newLeads > leads.length },
    bySource: countBy(leads, (l) => l.source),
    ownerLeaderboard: countBy(leads, (l) => l.distributedTo).slice(0, 15),
    byStatus: countBy(leads, (l) => l.status).slice(0, 12),
    byBrand: countBy(leads, (l) => l.brand).slice(0, 12),
    byState: countBy(leads, (l) => (l.state ? l.state.toUpperCase() : null)).slice(0, 12),
    recentLeads: leads.slice(0, 8),
  };
}

async function kvGet(key: string): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch { return null; }
}

async function kvSet(key: string, value: any): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/set/${encodeURIComponent(key)}?EX=${CACHE_TTL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  } catch { /* cache is best-effort */ }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (!requireAdmin(req, res)) return;
  if (!HS_TOKEN) return fail(res, 'HubSpot token not configured (HUBSPOT_ACCESS_TOKEN)', 500);

  const parsedDays = Number(req.query?.days);
  const windowDays = (ALLOWED_WINDOW_DAYS as readonly number[]).includes(parsedDays)
    ? parsedDays
    : 30;
  const cacheKey = `admin:reports:v1:${windowDays}`;

  try {
    const refresh = req.query?.refresh === '1' || req.query?.refresh === 'true';
    if (!refresh) {
      const cached = await kvGet(cacheKey);
      if (cached) return ok(res, { ...cached, cached: true });
    }
    const reports = await computeReports(windowDays);
    await kvSet(cacheKey, reports);
    return ok(res, { ...reports, cached: false });
  } catch (err) {
    console.error('[admin/reports] error:', err);
    return fail(res, err);
  }
}
