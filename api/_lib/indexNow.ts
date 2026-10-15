// IndexNow — instant URL submission to Bing, Yandex, Seznam and Naver.
//
// Why this and not "the Bing API": Bing Webmaster Tools' SubmitUrlBatch has a
// small daily quota and needs an account API key. IndexNow is the protocol
// Bing itself now recommends, has no account key, and one submission fans out
// to every participating engine. Google does NOT participate — Google's side
// is the Search Console sitemap in api/admin/seo.ts.
//
// Ownership is proved by hosting <key>.txt at the site root containing the
// key. scripts/prerender.mjs writes that file at build time from the same
// INDEXNOW_KEY (same committed default), so the key and the file cannot drift.
// The key is public by design — it authenticates the site, not the account.

const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');
const KEY = process.env.INDEXNOW_KEY || 'f358d775e5f54fdd912174feb9436017';

/** One submission may carry at most 10,000 URLs. */
const MAX_URLS = 10_000;

export const indexNowKey = (): string => KEY;
export const indexNowKeyUrl = (): string => `${SITE}/${KEY}.txt`;

export interface IndexNowResult {
  submitted: number;
  status: number;
  ok: boolean;
  /** Human-readable reading of the status code, for the admin UI. */
  detail: string;
  keyLocation: string;
}

// IndexNow answers with a bare status code and no body; these are the
// documented meanings, worth spelling out because a 403 here means "the key
// file is missing or stale", which is fixable, not a hard failure.
const DETAIL: Record<number, string> = {
  200: 'Accepted — URLs submitted.',
  202: 'Accepted — URLs received, key validation pending.',
  400: 'Bad request — malformed URL list.',
  // Verified against the live API 2026-08-21: the FIRST submission from a new
  // key returns 403 with errorCode "SiteVerificationNotCompleted" while
  // IndexNow fetches the key file, and the identical call succeeds on retry a
  // moment later. Reading that as a missing key file sends you hunting a
  // problem that isn't there — the file was serving 200 the whole time.
  403: 'Forbidden — usually a missing or mismatched key file. But on the first '
     + 'submission after a new or rotated key it is instead verification still in '
     + 'flight ("SiteVerificationNotCompleted"), which clears on its own — retry shortly.',
  422: 'Unprocessable — a URL does not belong to this host, or the key does not match.',
  429: 'Rate limited — too many submissions.',
};

/**
 * Submit URLs to IndexNow. Only URLs on SITE's host are accepted by the
 * protocol, so anything else is filtered out rather than sent and rejected.
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  const host = new URL(SITE).host;
  const clean = [...new Set(urls.filter((u) => {
    try { return new URL(u).host === host; } catch { return false; }
  }))].slice(0, MAX_URLS);

  const keyLocation = indexNowKeyUrl();
  if (!clean.length) {
    return { submitted: 0, status: 0, ok: false, detail: 'No valid same-host URLs to submit.', keyLocation };
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: KEY, keyLocation, urlList: clean }),
  });

  return {
    submitted: clean.length,
    status: res.status,
    ok: res.status === 200 || res.status === 202,
    detail: DETAIL[res.status] ?? `Unexpected status ${res.status}.`,
    keyLocation,
  };
}

/**
 * Verify the key file is actually reachable before blaming IndexNow for a
 * 403. Cheap, and the single most common reason submissions silently stop
 * working (a deploy that drops the file, or a rotated INDEXNOW_KEY whose
 * build hasn't shipped yet).
 */
export async function verifyIndexNowKeyFile(): Promise<{ ok: boolean; url: string; detail: string }> {
  const url = indexNowKeyUrl();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { ok: false, url, detail: `Key file returned ${res.status}. Redeploy so the build writes it.` };
    const body = (await res.text()).trim();
    if (body !== KEY) return { ok: false, url, detail: 'Key file contents do not match INDEXNOW_KEY.' };
    return { ok: true, url, detail: 'Key file present and matching.' };
  } catch (err: any) {
    return { ok: false, url, detail: `Key file unreachable: ${err?.message || err}` };
  }
}
