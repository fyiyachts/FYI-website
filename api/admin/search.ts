import { fail, ok, methodNotAllowed } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import {
  SCOPE_ANALYTICS_READONLY,
  SCOPE_WEBMASTERS_READONLY,
  getAccessToken,
  gFetch,
  listSites,
  loadServiceAccount,
  pickSite,
} from '../_lib/googleAuth.js';

// GET /api/admin/search   (admins only)
//
// Search Console + GA4 review for the Internal Stats page, powered by the
// Google service-account key stored on this Vercel project. The key never
// leaves the server; this route mints a short-lived OAuth token from it
// (api/_lib/googleAuth.ts) and reads two APIs:
//   - Search Console: last-28-day totals + top queries/pages for the
//     fyiyachts.com property/properties the service account can see.
//   - GA4 (best-effort): channel/session summary via the Data API. If the
//     service account hasn't been added to the GA4 property yet, the response
//     says so and names the exact email to grant Viewer access to.
//
// Read-only scopes on purpose: this route only reports. Sitemap submission
// and other write operations live in api/admin/seo.ts, which asks for the
// read/write Search Console scope.

export const maxDuration = 30;

const gJson = gFetch;

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function searchConsole(token: string) {
  const entries = await listSites(token);
  const site = pickSite(entries);
  if (!site) {
    return { error: `Service account sees no fyiyachts.com property in Search Console (visible: ${entries.map((s) => s.siteUrl).join(', ') || 'none'})` };
  }
  const end = new Date(Date.now() - 2 * 86400_000); // GSC data lags ~2 days
  const start = new Date(end.getTime() - 28 * 86400_000);
  const range = { startDate: iso(start), endDate: iso(end) };
  const base = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`;
  const [totals, byQuery, byPage] = await Promise.all([
    gJson(token, base, { ...range }),
    gJson(token, base, { ...range, dimensions: ['query'], rowLimit: 15 }),
    gJson(token, base, { ...range, dimensions: ['page'], rowLimit: 15 }),
  ]);
  const rows = (r: any) => (r.rows || []).map((x: any) => ({
    key: x.keys?.[0] ?? '', clicks: x.clicks ?? 0, impressions: x.impressions ?? 0,
    ctr: x.ctr ?? 0, position: x.position ?? 0,
  }));
  return {
    site: site.siteUrl,
    range,
    totals: rows({ rows: totals.rows ? totals.rows : [] })[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    topQueries: rows(byQuery),
    topPages: rows(byPage),
  };
}

async function ga4(token: string) {
  const summaries = await gJson(token, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  const props = (summaries.accountSummaries || []).flatMap((a: any) =>
    (a.propertySummaries || []).map((p: any) => ({ property: p.property, displayName: p.displayName })));
  if (!props.length) return { error: 'Service account has no GA4 property access yet.' };
  const prop = props.find((p: any) => /fyi/i.test(p.displayName)) || props[0];
  const report = await gJson(token, `https://analyticsdata.googleapis.com/v1beta/${prop.property}:runReport`, {
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });
  return {
    property: prop.displayName,
    channels: (report.rows || []).map((r: any) => ({
      channel: r.dimensionValues?.[0]?.value ?? '',
      sessions: Number(r.metricValues?.[0]?.value ?? 0),
      users: Number(r.metricValues?.[1]?.value ?? 0),
    })),
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (!requireAdmin(req, res)) return;

  const loaded = loadServiceAccount();
  if ('error' in loaded) return fail(res, loaded.error, 500);

  try {
    const token = await getAccessToken(loaded.creds, [SCOPE_WEBMASTERS_READONLY, SCOPE_ANALYTICS_READONLY]);
    // GSC and GA4 fail independently — one missing grant must not blank the other.
    const [gsc, analytics] = await Promise.all([
      searchConsole(token).catch((e) => ({ error: String(e?.message || e) })),
      ga4(token).catch((e) => ({ error: String(e?.message || e) })),
    ]);
    return ok(res, {
      serviceAccount: loaded.creds.client_email, // the email to grant GSC/GA4 access to
      envName: loaded.envName,
      searchConsole: gsc,
      ga4: analytics,
    });
  } catch (err) {
    console.error('[admin/search] error:', err);
    return fail(res, err);
  }
}
