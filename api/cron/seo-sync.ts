import {
  SCOPE_WEBMASTERS,
  getAccessToken,
  gFetch,
  listSites,
  loadServiceAccount,
  pickSite,
} from '../_lib/googleAuth.js';
import { submitToIndexNow } from '../_lib/indexNow.js';
import { snapshotSearchAnalytics } from '../_lib/gscSnapshot.js';

// Daily SEO sync cron (06:15 UTC, vercel.json). Three jobs, each independent:
//
//   1. Re-submit sitemap.xml to Google Search Console. Google re-crawls a
//      sitemap on its own schedule, but a submission is a "read this now"
//      nudge — worth one call a day on a site whose inventory turns over.
//   2. Push recently-changed listing URLs to Bing/Yandex via IndexNow.
//   3. Snapshot the last-28-day Search Analytics picture into Supabase
//      (`gsc_snapshots`) so agents and dashboards can read GSC data without
//      the service-account key or a human export (api/_lib/gscSnapshot.ts).
//
// Only listings whose feed date moved inside FRESH_DAYS are submitted.
// IndexNow is for *changes* — firing all ~140 URLs daily is the behaviour
// that gets a host's submissions discounted, and it would drown the ~20/day
// that genuinely changed.
//
// Both halves degrade independently: no Google grant must not stop the Bing
// push, and vice versa. Guarded by CRON_SECRET like every other cron here.

const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_SECRET || '';
const FRESH_DAYS = 7;

export const maxDuration = 60;

const SITEMAP = `${SITE}/sitemap.xml`;

/** Listing URLs whose <lastmod> falls inside the freshness window. */
async function freshListingUrls(): Promise<string[]> {
  const res = await fetch(`${SITE}/sitemap-listings.xml`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`sitemap-listings.xml returned ${res.status}`);
  const xml = await res.text();
  const cutoff = new Date(Date.now() - FRESH_DAYS * 86400_000).toISOString().slice(0, 10);

  const urls: string[] = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    const mod = /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1];
    if (loc && mod && mod >= cutoff) urls.push(loc);
  }
  return urls;
}

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

  const [google, bing, snapshot] = await Promise.all([
    submitSitemapToGoogle().catch((e) => ({ ok: false, error: String(e?.message || e) })),
    freshListingUrls()
      .then(async (urls) => (urls.length
        ? { ...(await submitToIndexNow(urls)), freshDays: FRESH_DAYS }
        : { ok: true, submitted: 0, detail: `No listings changed in the last ${FRESH_DAYS} days.` }))
      .catch((e) => ({ ok: false, error: String(e?.message || e) })),
    snapshotSearchAnalytics().catch((e) => ({ ok: false, error: String(e?.message || e) })),
  ]);

  console.log('[cron/seo-sync]', JSON.stringify({ google, bing, snapshot }));
  return res.status(200).json({ ranAt: new Date().toISOString(), google, bing, snapshot });
}
