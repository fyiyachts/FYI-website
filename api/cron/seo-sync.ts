import {
  SCOPE_WEBMASTERS,
  getAccessToken,
  gFetch,
  listSites,
  loadServiceAccount,
  pickSite,
} from '../_lib/googleAuth.js';
import { snapshotSearchAnalytics } from '../_lib/gscSnapshot.js';

// Daily SEO sync cron (06:15 UTC, vercel.json). Two jobs, each independent:
//
//   1. Re-submit sitemap.xml to Google Search Console. Google re-crawls a
//      sitemap on its own schedule, but a submission is a "read this now"
//      nudge — worth one call a day on a site whose inventory turns over.
//   2. Snapshot the last-28-day Search Analytics picture into Supabase
//      (`gsc_snapshots`) so agents and dashboards can read GSC data without
//      the service-account key or a human export (api/_lib/gscSnapshot.ts).
//
// The IndexNow push to Bing/Yandex used to be a third job here, one nightly
// batch. It is now api/cron/indexnow.ts, hourly, changed listings only.
//
// Guarded by CRON_SECRET like every other cron here.

const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_SECRET || '';

export const maxDuration = 60;

const SITEMAP = `${SITE}/sitemap.xml`;

async function submitSitemapToGoogle(): Promise<Record<string, unknown>> {
  const loaded = loadServiceAccount();
  if ('error' in loaded) return { ok: false, error: loaded.error };

  const token = await getAccessToken(loaded.creds, [SCOPE_WEBMASTERS]);
  const site = pickSite(await listSites(token));
  if (!site) return { ok: false, error: 'Service account has no fyiyachts.com property in Search Console.' };

  await gFetch(
    token,
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/sitemaps/${encodeURIComponent(SITEMAP)}`,
    undefined,
    'PUT',
  );
  return { ok: true, property: site.siteUrl, sitemap: SITEMAP };
}

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization || '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const [google, snapshot] = await Promise.all([
    submitSitemapToGoogle().catch((e) => ({ ok: false, error: String(e?.message || e) })),
    snapshotSearchAnalytics().catch((e) => ({ ok: false, error: String(e?.message || e) })),
  ]);

  console.log('[cron/seo-sync]', JSON.stringify({ google, snapshot }));
  return res.status(200).json({ ranAt: new Date().toISOString(), google, snapshot });
}
