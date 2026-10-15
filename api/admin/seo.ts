import { fail, ok, parseJsonBody } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import {
  SCOPE_WEBMASTERS,
  SCOPE_WEBMASTERS_READONLY,
  getAccessToken,
  gFetch,
  listSites,
  loadServiceAccount,
  pickSite,
} from '../_lib/googleAuth.js';
import { indexNowKey, submitToIndexNow, verifyIndexNowKeyFile } from '../_lib/indexNow.js';

// /api/admin/seo   (admins only)
//
// Search Console *write* operations, using the same service-account key that
// api/admin/search.ts reads with — but with the read/write `webmasters` scope
// so sitemaps can actually be submitted, not just listed.
//
//   GET                              → property + sitemap status, IndexNow health
//   POST {action:'submit-sitemaps'}  → (re)submit sitemap.xml to Google
//   POST {action:'remove-sitemap',   → drop a stale sitemap from the report
//         feedpath}                     (the WordPress-era Yoast ones)
//   POST {action:'inspect', url}     → URL Inspection: is this page indexed?
//   POST {action:'indexnow', urls}   → push URLs to Bing/Yandex via IndexNow
//
// Submitting a sitemap is idempotent and safe to repeat — Google treats it as
// "re-read this now" rather than creating a duplicate entry.

export const maxDuration = 60;

const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');
const GSC = 'https://searchconsole.googleapis.com';

// Only the index is submitted — it carries both children, so submitting the
// children separately would just duplicate rows in the report.
const OWN_SITEMAPS = [`${SITE}/sitemap.xml`];
// ...but a child submitted by hand at some point is still ours, not a stale
// WordPress leftover, and must not be offered up for removal.
const KNOWN_SITEMAPS = new Set([
  ...OWN_SITEMAPS,
  `${SITE}/sitemap-pages.xml`,
  `${SITE}/sitemap-listings.xml`,
]);

const sitemapApi = (siteUrl: string, feedpath?: string) =>
  `${GSC}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps${feedpath ? `/${encodeURIComponent(feedpath)}` : ''}`;

/** Shape the noisy GSC sitemap record down to what the admin UI shows. */
const shapeSitemap = (s: any) => ({
  path: s.path,
  type: s.type,
  lastSubmitted: s.lastSubmitted ?? null,
  lastDownloaded: s.lastDownloaded ?? null,
  isPending: !!s.isPending,
  isSitemapsIndex: !!s.isSitemapsIndex,
  warnings: Number(s.warnings ?? 0),
  errors: Number(s.errors ?? 0),
  // `contents` is per-type (web/image/video); web is the one that matters.
  submittedUrls: Number((s.contents || []).find((c: any) => c.type === 'web')?.submitted ?? 0),
});

async function report(token: string, siteUrl: string) {
  const [sitemaps, keyFile] = await Promise.all([
    gFetch(token, sitemapApi(siteUrl)).then((r) => (r.sitemap || []).map(shapeSitemap)),
    verifyIndexNowKeyFile(),
  ]);
  // Anything Google still holds that this site no longer publishes — the
  // Yoast leftovers (/sitemap_index.xml, /page-sitemap.xml) that 404 now.
  const stale = sitemaps.filter((s: any) => !KNOWN_SITEMAPS.has(s.path));
  return { sitemaps, stale: stale.map((s: any) => s.path), indexNow: { key: indexNowKey(), ...keyFile } };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!requireAdmin(req, res)) return;

  const loaded = loadServiceAccount();
  if ('error' in loaded) return fail(res, loaded.error, 500);

  try {
    const token = await getAccessToken(loaded.creds, [SCOPE_WEBMASTERS, SCOPE_WEBMASTERS_READONLY]);
    const entries = await listSites(token);
    const site = pickSite(entries);
    if (!site) {
      // Name the exact email to grant — the fix is one click in GSC and this
      // is the only place that knows which account is asking.
      return fail(res, `Service account ${loaded.creds.client_email} has no fyiyachts.com property in Search Console. `
        + `Add it under Settings → Users and permissions with Full permission. `
        + `Visible properties: ${entries.map((s) => s.siteUrl).join(', ') || 'none'}`, 403);
    }

    const base = {
      serviceAccount: loaded.creds.client_email,
      property: site.siteUrl,
      permissionLevel: site.permissionLevel,
      allProperties: entries.map((s) => s.siteUrl),
    };

    if (req.method === 'GET') return ok(res, { ...base, ...(await report(token, site.siteUrl)) });

    const body = parseJsonBody(req);
    const action = String(body.action || '');

    if (action === 'submit-sitemaps') {
      const results = [];
      for (const url of OWN_SITEMAPS) {
        try {
          await gFetch(token, sitemapApi(site.siteUrl, url), undefined, 'PUT');
          results.push({ sitemap: url, ok: true });
        } catch (err: any) {
          results.push({ sitemap: url, ok: false, error: String(err?.message || err) });
        }
      }
      return ok(res, { ...base, action, results, ...(await report(token, site.siteUrl)) });
    }

    if (action === 'remove-sitemap') {
      const feedpath = String(body.feedpath || '');
      if (!feedpath.startsWith(SITE)) {
        return fail(res, `Refusing to remove "${feedpath}" — not a ${SITE} sitemap.`, 400);
      }
      // Removing only stops Google re-fetching a dead file and clears the
      // row from the report. It does NOT deindex the URLs that were in it.
      await gFetch(token, sitemapApi(site.siteUrl, feedpath), undefined, 'DELETE');
      return ok(res, { ...base, action, removed: feedpath, ...(await report(token, site.siteUrl)) });
    }

    if (action === 'inspect') {
      const url = String(body.url || '');
      if (!url.startsWith(SITE)) return fail(res, `Refusing to inspect "${url}" — not a ${SITE} URL.`, 400);
      const data = await gFetch(token, `${GSC}/v1/urlInspection/index:inspect`, {
        inspectionUrl: url,
        siteUrl: site.siteUrl,
      });
      const r = data.inspectionResult?.indexStatusResult ?? {};
      return ok(res, {
        ...base,
        action,
        url,
        verdict: r.verdict ?? 'UNKNOWN',              // PASS / PARTIAL / FAIL / NEUTRAL
        coverageState: r.coverageState ?? null,       // e.g. "Submitted and indexed"
        lastCrawlTime: r.lastCrawlTime ?? null,
        googleCanonical: r.googleCanonical ?? null,   // what Google actually picked
        userCanonical: r.userCanonical ?? null,       // what the page declares
        robotsTxtState: r.robotsTxtState ?? null,
        indexingState: r.indexingState ?? null,
        inspectionLink: data.inspectionResult?.inspectionResultLink ?? null,
      });
    }

    if (action === 'indexnow') {
      const urls = Array.isArray(body.urls) ? body.urls.map(String) : [];
      if (!urls.length) return fail(res, 'indexnow requires a non-empty `urls` array.', 400);
      return ok(res, { ...base, action, indexNow: await submitToIndexNow(urls) });
    }

    return fail(res, `Unknown action "${action}". Expected: submit-sitemaps, remove-sitemap, inspect, indexnow.`, 400);
  } catch (err) {
    console.error('[admin/seo] error:', err);
    return fail(res, err);
  }
}
