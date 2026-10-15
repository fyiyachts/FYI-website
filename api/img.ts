// Same-origin image proxy for the boats-feed photo hosts.
//
// Vercel's image optimizer (/_vercel/image) cannot fetch images.boatsgroup.com
// or imt.boatwizard.com directly — the origin refuses the optimizer's requests
// with OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED even though both hosts are
// in vercel.json's remotePatterns and serve the same URLs to anyone else
// (verified 2026-08-25: storage.googleapis.com optimizes fine through the same
// allowlist). So utils/img.ts routes those hosts through this proxy on our own
// domain, which the optimizer is allowed to fetch (fyiyachts.com is in
// remotePatterns).
//
// Intended caller is the optimizer on /_vercel/image cache misses — never a
// browser and never a scraper. Boats-feed URLs are content-stamped, but the
// original JPEGs are huge (live 2026-09-21: one _XLARGE was 5.8 MiB / 8064px),
// and a public year-long CDN cache of those bodies is Fast Data Transfer
// even on HIT. So we: (1) refuse browser/scraper clients, (2) do not share
// the original at the CDN (`private, no-store`) — the optimizer caches the
// resized /_vercel/image result, which is what pageviews actually load.
type VercelRequest = {
  query: Record<string, string | string[]>;
  headers?: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  send(b: unknown): VercelResponse;
};

// Exact-host allowlist: this must never become an open proxy.
const ALLOWED_HOSTS = new Set(['images.boatsgroup.com', 'imt.boatwizard.com']);

/** Cap proxied body size so one giant photo cannot blow Fast Data Transfer. */
const MAX_BYTES = 8 * 1024 * 1024; // 8 MiB

/** Shared short CDN cache for failure responses (stampedes on dead photos). */
const FAIL_CACHE = 'public, max-age=0, s-maxage=1800';

/** Success originals are optimizer-only; do not share them at the CDN. */
const SUCCESS_CACHE = 'private, no-store';

/** 403s must not be CDN-cached — a shared 403 would blank optimizer fetches. */
const BLOCK_CACHE = 'private, no-store';

function header(req: VercelRequest, name: string): string {
  const v = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] || '';
  return v || '';
}

// curl/python/etc. plus the same unwanted scrapers /api/yachts/proxy already
// short-circuits. Do not list undici/node-fetch — the optimizer may fetch
// with Node's default UA, and blocking that blanks every boats-feed card.
const SCRAPER_UA_RE =
  /curl\/|wget\/|python-requests|python-httpx|aiohttp|scrapy|httpie|okhttp|libwww-perl|go-http-client|java\/|php\/|meta-externalagent|meta-webindexer|bytespider|ahrefs|semrush|dotbot|petal|baiduspider|yandex|megaindex|facebookexternalhit/i;

/**
 * True when this is a browser or an obvious scraper, not the image optimizer.
 *
 * Vercel's /_vercel/image fetch does not forward the visitor's headers
 * (Next GHSA-g5qg-72qw-gw5v / image-optimizer.ts): no Sec-Fetch-*, no
 * Accept-Language. Browsers send both. Default curl/python UAs match the
 * scraper regex. A crafted Mozilla UA without those headers still gets
 * through — WAF on /api/img is what stops that class (see PR).
 */
function isBlockedClient(req: VercelRequest): boolean {
  if (header(req, 'sec-fetch-dest') || header(req, 'sec-fetch-site')) return true;
  const ua = header(req, 'user-agent');
  if (SCRAPER_UA_RE.test(ua)) return true;
  const acceptLang = header(req, 'accept-language');
  if (acceptLang && /mozilla\/|chrome\/|safari\/|firefox\/|edg\//i.test(ua)) return true;
  return false;
}

function fail(res: VercelResponse, status: number, message: string) {
  res.setHeader('Cache-Control', FAIL_CACHE);
  res.setHeader('Retry-After', '60');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  return res.status(status).send(message);
}

/** Magic-byte sniff for the formats the boats feed actually serves. */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.length >= 6 && buf.subarray(0, 6).toString('latin1').startsWith('GIF8')) return 'image/gif';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (isBlockedClient(req)) {
    res.setHeader('Cache-Control', BLOCK_CACHE);
    return res.status(403).send('forbidden');
  }

  const u = String(req.query?.u || '');
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return res.status(400).send('bad url');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(400).send('host not allowed');
  }

  try {
    const upstream = await fetch(parsed.href, { signal: AbortSignal.timeout(4000) });
    if (!upstream.ok) {
      return fail(res, upstream.status === 404 ? 404 : 502, 'upstream error');
    }

    const contentLength = upstream.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      try {
        upstream.body?.cancel();
      } catch {
        /* ignore */
      }
      return fail(res, 502, 'too large');
    }

    // The photo hosts do not always label their own images: a large slice of
    // the boats feed comes back as `application/octet-stream` (seen 2026-09-03
    // on the newer `<year>-<make>-<model>-<id>-<stamp>-N.jpg` filenames, while
    // the older `_XLARGE.jpg` ones are labelled image/jpeg). Rejecting on the
    // header alone turned every one of those into a 502 and a blank card on
    // the yacht grid and the worldwide listing pages. So when the header is
    // not an image type, sniff the first bytes and trust the file — and only
    // give up when the bytes are not an image either.
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length > MAX_BYTES) {
      return fail(res, 502, 'too large');
    }
    const headerType = upstream.headers.get('content-type') || '';
    const sniffed = sniffImageType(body);
    if (!headerType.startsWith('image/') && !sniffed) return fail(res, 502, 'not an image');
    const type = headerType.startsWith('image/') ? headerType : (sniffed as string);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', SUCCESS_CACHE);
    return res.status(200).send(body);
  } catch (err) {
    const timedOut =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return fail(res, timedOut ? 504 : 502, timedOut ? 'upstream timeout' : 'fetch failed');
  }
}
