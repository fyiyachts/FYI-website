// Real HTTP 404s for unknown URLs.
//
// The SPA catch-all rewrite in vercel.json used to send every unmatched path
// to /index.html with a 200, so a mistyped URL or a stale backlink landed on
// the portal login screen and Google saw a soft 404. Vercel serves the
// prerendered static files (dist/<route>/index.html) *before* rewrites, and
// vercel.json lists the SPA-only paths explicitly ahead of the catch-all, so
// anything that reaches this function is genuinely not a page.
//
// Same dynamic-rendering approach as api/listing.ts: the built shell with its
// hashed asset tags, meta + static body injected, React replacing #root on
// mount — but sent with status 404 and `noindex`. The body mirrors what
// components/public/NotFoundPage.tsx renders, so this is not cloaking.
import { INDEX_SHELL } from './_lib/indexShell.js';

type VercelRequest = { url?: string; headers?: Record<string, string | string[] | undefined> };
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  send(b: string): VercelResponse;
};

const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TITLE = 'Page Not Found | FYI Yachts';
const DESC =
  'That page has moved or no longer exists. Search the live FYI Yachts inventory, browse by yacht type or builder, or call a Miami broker on 305-854-6020.';

const LINKS: [string, string][] = [
  ['Yachts for Sale', '/yachts-for-sale'],
  ['Super Yachts', '/super-yachts-for-sale'],
  ['Center Console Boats', '/center-console-boats-for-sale'],
  ['Sport Fishing Yachts', '/sport-fishing-yachts-for-sale'],
  ['Sell Your Yacht', '/sell'],
  ['Miami Yacht Charter', '/charter'],
  ['Yacht Financing', '/yacht-financing'],
  ['Sold Yachts', '/sold-yachts'],
  ['Client Results', '/case-studies'],
  ['Our Team', '/our-team'],
  ['FYI News', '/fyi-news'],
  ['Contact', '/contact'],
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = String(req.url || '/').split('?')[0];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // Cache 404s at the edge briefly so scanner bursts (WordPress-path probes
  // etc.) collapse into one invocation per path per minute instead of one per
  // request. The TTL is short because the URL may become real later (a new
  // listing, a new consultant, a restored page) — 60s of staleness is fine.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Robots-Tag', 'noindex, follow');

  const head = [
    `<title>${esc(TITLE)}</title>`,
    `<meta name="description" content="${esc(DESC)}" />`,
    `<meta name="robots" content="noindex, follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="FYI Yachts" />`,
    `<meta property="og:title" content="${esc(TITLE)}" />`,
    `<meta property="og:description" content="${esc(DESC)}" />`,
  ].join('\n    ');

  const body = `<div class="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
<header class="bg-yacht-900 px-6 pb-14 pt-16"><div class="mx-auto max-w-3xl">
<p class="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">404 — Off the chart</p>
<h1 class="mt-4 text-3xl font-light leading-snug tracking-wide text-white">We couldn’t find that page</h1>
<p class="mt-4 text-[15px] font-light leading-7 text-white/70">The page may have moved, or the link that brought you here may be out of date. Everything below is still exactly where you left it.</p>
</div></header>
<main class="mx-auto max-w-3xl px-6 py-12">
<h2 class="text-xl font-light text-yacht-900">Where to go from here</h2>
<p class="mt-4 text-[14px] leading-8">${LINKS.map(([name, href]) => `<a class="text-yacht-brand underline" href="${href}">${esc(name)}</a>`).join(' · ')}</p>
<p class="mt-8 text-[15px] font-light leading-8 text-yacht-900/75">Or call <a class="text-yacht-brand underline" href="tel:+13058546020">+1 305-854-6020</a> and a Miami broker will find the vessel you were looking for. A broker responds within one business day.</p>
<p class="mt-6 text-[13px] font-light text-yacht-900/50">Requested URL: ${esc(SITE)}${esc(path)}</p>
</main></div>`;

  const html = INDEX_SHELL
    .replace(/<title>.*?<\/title>/s, head)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);

  return res.status(404).send(html);
}
