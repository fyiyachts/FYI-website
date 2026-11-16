// Server-rendered listing page. /listing/:id is rewritten to
// /api/listing?id=:id (vercel.json) — a static function path so it resolves
// reliably (a dynamic [id].ts route did not match under the /api/(.*) rewrite).
// so crawlers, link unfurlers, and AI engines get real per-listing metadata
// and body text instead of the empty SPA shell. The exact same hashed asset
// tags boot React, which replaces the injected #root content on mount — this
// is dynamic rendering (Google-supported), not cloaking: the content matches
// what the client renders.
//
// What a crawler that runs no JavaScript gets (2026-11-13): H1, price or
// "Price on request", location, the full cleaned description, the full dynamic spec
// table, then every detail section (in that order), price-reduced status, every photo URL
// with alt text, the co-brokerage courtesy line, and links to the inventory,
// the make's search and 4–6 similar boats. FYI exclusives and co-brokerage
// boats are rendered — and indexed — the same way.
//
// Served from the CDN (s-maxage + stale-while-revalidate): Googlebot crawling
// thousands of listings must not mean thousands of BoatsGroup calls.
import { INDEX_SHELL } from './_lib/indexShell.js';
import { findManualListing } from './_lib/manualListings.js';
import { plsGetById } from './_lib/plsFeed.js';
import { applyListingOverrides } from './_lib/listingOverrides.js';
import { buildListingContent } from './_lib/listingContent.js';
import { buildSpecGroups, fmtDate, type SpecGroupRows } from './_lib/specFields.js';
import { buildListingSeo, listingJsonLd } from './_lib/listingSeo.js';
import { getPriceRecord, reductionOf } from './_lib/priceHistory.js';
import { featuredBoats, findSimilarBoats, type SimilarBoat } from './_lib/similarBoats.js';
import { formatMoney, listPrice } from './_lib/price.js';

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  send(b: string): VercelResponse;
  end(): VercelResponse;
};

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ldScript = (o: unknown): string =>
  `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

/** Listing HTML: fresh for 4 hours, then served stale while it refreshes, for up to a week. */
const CACHE_OK = 'public, max-age=0, s-maxage=14400, stale-while-revalidate=604800';

const DISCLAIMER =
  'This company offers the details of this vessel in good faith but cannot guarantee or warrant the accuracy of '
  + 'this information nor warrant the condition of the vessel. A buyer should instruct his agents, or his surveyors, '
  + 'to investigate such details as the buyer desires validated. This vessel is offered subject to prior sale, '
  + 'price change or withdrawal without notice.';

/* ------------------------------------------------ fragments */

function similarHtml(boats: SimilarBoat[], heading: string): string {
  if (!boats.length) return '';
  return `<section class="mt-12"><h2 class="font-serif text-2xl italic tracking-wide text-yacht-900">${esc(heading)}</h2>
<ul class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${boats.map((b) => `<li class="bg-white shadow-sm"><a class="block" href="/listing/${esc(b.id)}">${
    b.image ? `<img src="${esc(bgResizeUrl(b.image, 640) || b.image)}" alt="${esc(b.title)} for sale" width="640" height="480" loading="lazy" class="aspect-[4/3] w-full object-cover" />` : ''
  }<span class="block p-4"><span class="block text-[14px] font-medium tracking-wide text-yacht-900">${esc(b.title)}</span>${
    b.boatName ? `<span class="block text-[12px] font-light italic text-yacht-900/55">${esc(b.boatName)}</span>` : ''
  }<span class="mt-1 block text-[13px] font-semibold text-yacht-900/80">${esc(b.price)}${b.location ? ` · ${esc(b.location)}` : ''}</span></span></a></li>`).join('')}</ul></section>`;
}

/**
 * The similar boats as data, for the React page (the "no longer available"
 * view reads it). Placed after #root, which React empties on mount.
 */
const similarData = (id: string, boats: SimilarBoat[]): string =>
  `<script type="application/json" id="fyi-similar">${JSON.stringify({ id, boats }).replace(/</g, '\\u003c')}</script>`;

function specsHtml(groups: SpecGroupRows[]): string {
  if (!groups.length) return '';
  return `<section class="mt-12"><h2 class="font-serif text-2xl italic tracking-wide text-yacht-900">Specifications</h2>
<div class="mt-5 grid gap-5">${groups.map((g) => `<section class="border border-yacht-900/10 bg-white p-6"><h3 class="text-[11px] font-semibold uppercase tracking-[0.28em] text-yacht-brand">${esc(g.heading)}</h3>
<dl class="mt-3 grid gap-x-10 sm:grid-cols-2">${g.rows.map((r) => `<div class="flex items-baseline justify-between gap-4 border-b border-yacht-900/10 py-3 text-[14px]"><dt class="shrink-0 font-light text-yacht-900/55">${esc(r.label)}</dt><dd class="text-right font-medium text-yacht-900">${
    r.was ? `<s class="mr-2 font-light text-yacht-900/45">${esc(r.was)}</s>` : ''}${esc(r.value)}${
    r.note ? `<span class="block text-[12px] font-light text-yacht-900/55">${esc(r.note)}</span>` : ''}</dd></div>`).join('')}</dl></section>`).join('')}</div></section>`;
}

/* ------------------------------------------------ gone / unavailable */

// No id at all: a plain 404.
const notFound = (res: VercelResponse) => {
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Robots-Tag', 'noindex');
  return res.status(404).send(
    INDEX_SHELL.replace(
      /<title>.*?<\/title>/s,
      `<title>Listing Not Found | FYI Yachts</title>\n    <meta name="robots" content="noindex" />`,
    ),
  );
};

// A boat that has left the feeds (sold, withdrawn — co-brokerage boats come
// and go daily) answers 410 Gone: Google drops the URL promptly, and the
// sitemaps stop listing it on their next refresh because they are built from
// the same feeds. Never an empty page: the visitor gets "no longer available",
// similar active boats and the way back to the inventory. This used to be a
// 404 with the bare shell.
//
// Only a clean "no such boat" from every feed reaches here — a feed error is
// the 503 below. Short edge TTL, so a boat that reappears is back within
// minutes.
async function gone(res: VercelResponse, id: string) {
  // The price snapshot remembers the make and length of boats it has seen.
  const rec = await getPriceRecord(id);
  let boats: SimilarBoat[] = [];
  try {
    boats = rec?.make || rec?.lengthFt
      ? await findSimilarBoats({ id, make: rec.make, lengthFt: rec.lengthFt })
      : [];
    if (boats.length < 3) boats = await featuredBoats();
  } catch { /* the page still stands without suggestions */ }

  const head = [
    '<title>This Yacht Is No Longer Available | FYI Yachts</title>',
    '<meta name="robots" content="noindex, follow" />',
    '<meta name="description" content="This yacht is no longer available. Browse similar yachts for sale with FYI Yachts." />',
  ].join('\n    ');
  const body = `<div class="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
<header class="bg-yacht-900 px-6 pb-10 pt-16"><div class="mx-auto max-w-5xl">
<p class="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">FYI Yachts</p>
<h1 class="mt-3 text-3xl font-light leading-snug tracking-wide text-white">This yacht is no longer available</h1>
<p class="mt-3 text-sm font-light text-white/70">It has been sold or withdrawn from the market. Our brokers can find you one like it.</p>
<p class="mt-6"><a class="inline-block bg-yacht-brand px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white" href="/yachts-for-sale">Browse all yachts for sale</a></p>
</div></header>
<main class="mx-auto max-w-5xl px-6 py-10">
${similarHtml(boats, 'Similar yachts available now')}
<p class="mt-10 text-[14px] font-light"><a class="text-yacht-brand underline" href="/yachts-for-sale">All yachts for sale</a> \u00b7 <a class="text-yacht-brand underline" href="/contact">Ask a broker</a> \u00b7 Call <a class="text-yacht-brand underline" href="tel:+13058546020">+1 305-854-6020</a></p>
</main></div>`;

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  return res.status(410).send(
    INDEX_SHELL
      .replace(/<title>.*?<\/title>/s, () => head)
      .replace('<div id="root"></div>', () => `<div id="root">${body}</div>${similarData(id, boats)}`),
  );
}

// Upstream down: 503 + Retry-After, not a 200 shell. A 200 here is a homepage
// clone cached for an hour on every listing URL crawled during the outage; a
// 503 tells Google to come back later and keeps the listing indexed. The shell
// still boots the SPA, which fetches client-side, so a human sees the page.
const unavailable = (res: VercelResponse) => {
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  res.setHeader('Retry-After', '300');
  return res.status(503).send(INDEX_SHELL);
};

const HERO_WIDTHS = [640, 960, 1280, 1600];
const HERO_SIZES = '(min-width: 1280px) 1216px, calc(100vw - 48px)';

function bgResizeUrl(src: string, w: number): string | null {
  let u: URL;
  try { u = new URL(src); } catch { return null; }
  if (u.hostname !== 'images.boatsgroup.com') return null;
  if (u.pathname.startsWith('/images/')) u.pathname = `/resize/${u.pathname.slice('/images/'.length)}`;
  else if (!u.pathname.startsWith('/resize/')) return null;
  u.search = '';
  u.searchParams.set('w', String(w));
  u.searchParams.set('h', String(Math.round(w * 0.75)));
  return u.toString();
}

function bgHeroPreload(src: string): string {
  const href = bgResizeUrl(src, 1280);
  if (!href) return '';
  const set = HERO_WIDTHS.map((w) => `${bgResizeUrl(src, w)} ${w}w`).join(', ');
  return `<link rel="preload" as="image" href="${esc(href)}" imagesrcset="${esc(set)}" imagesizes="${esc(HERO_SIZES)}" fetchpriority="high" />`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query?.id || '').replace(/[^0-9]/g, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', CACHE_OK);

  if (!id) return notFound(res);

  try {
    // Hand-entered listings (api/_lib/manualListings.ts) before the feed.
    let it = findManualListing(id);
    if (!it) {
      const url = new URL(UPSTREAM);
      url.searchParams.set('key', KEY);
      url.searchParams.set('documentid', id);
      // A failed or timed-out lookup is an outage (503 below), never "gone":
      // a 410 for a live boat tells Google to drop it.
      const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!r.ok) throw new Error(`feed HTTP ${r.status}`);
      const feed = (await r.json()) as { results?: Record<string, any>[] };
      it = feed.results?.[0];
    }
    // Co-brokerage boats (BoatsGroup PLS) get the same server-rendered page.
    // A PLS error throws to the 503 path; only a clean miss is "gone".
    if (!it) it = await plsGetById(id);
    if (!it) return await gone(res, id);
    applyListingOverrides(it); // manual fixes (hidden photos, price override), if any

    const cobrokerage = it.ListingType === 'cobrokerage';
    const content = buildListingContent(it);
    const seo = buildListingSeo(it, content, SITE);
    const price = listPrice(it);
    // No trailing slash: vercel.json trailingSlash:false serves the bare form
    // and 308s the slashed one, so a slashed canonical points every listing at
    // a redirect. Must match the served URL exactly.
    const canonical = `${SITE}/listing/${id}`;

    // Price history and similar boats are extras: neither can fail the page.
    const [record, similar] = await Promise.all([
      price ? getPriceRecord(id) : Promise.resolve(null),
      findSimilarBoats({ id, make: it.MakeString, lengthFt: seo.lengthFt }).catch(() => [] as SimilarBoat[]),
    ]);
    // Never for a hidden price, and only against the same currency.
    const r = price ? reductionOf(record) : null;
    const reduction = r && price && r.currency === price.currency && r.previous > price.amount ? r : null;
    const groups = buildSpecGroups(it, { reduction });

    // Absolute, not root-relative: this is an og:image, and the crawlers that
    // read it have no page origin to resolve against.
    const hero = seo.images[0]?.url || `${SITE}/brand/fyi-logo-2024.png`;
    // Preload the hero photo the page will paint first — the same URLs the
    // React page requests (HERO_WIDTHS / HERO_SIZES in PublicListingPage.tsx
    // and bgResize in utils/img.ts; keep the three in step).
    const heroPreload = seo.images[0] ? bgHeroPreload(seo.images[0].url) : '';
    const heroSrc = seo.images[0] ? bgResizeUrl(seo.images[0].url, 1280) || seo.images[0].url : '';
    const heroSet = seo.images[0] && bgResizeUrl(seo.images[0].url, 1280)
      ? HERO_WIDTHS.map((w) => `${bgResizeUrl(seo.images[0].url, w)} ${w}w`).join(', ') : '';

    const jsonLd = [
      listingJsonLd(it, content, seo, canonical),
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Yachts for Sale', item: `${SITE}/yachts-for-sale` },
          { '@type': 'ListItem', position: 3, name: seo.h1, item: canonical },
        ],
      },
    ];

    const head = [
      `<title>${esc(seo.pageTitle)}</title>`,
      `<meta name="description" content="${esc(seo.metaDescription)}" />`,
      `<link rel="canonical" href="${esc(canonical)}" />`,
      // Exclusives and co-brokerage alike.
      '<meta name="robots" content="index, follow, max-image-preview:large" />',
      `<meta property="og:type" content="product" />`,
      `<meta property="og:site_name" content="FYI Yachts" />`,
      `<meta property="og:title" content="${esc(seo.pageTitle)}" />`,
      `<meta property="og:description" content="${esc(seo.metaDescription)}" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      `<meta property="og:image" content="${esc(hero)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      ...(heroPreload ? [heroPreload] : []),
      ...jsonLd.map(ldScript),
    ].join('\n    ');

    const makeHref = it.MakeString ? `/yachts-for-sale?make=${encodeURIComponent(String(it.MakeString))}` : '';
    const sub = [seo.lengthFt ? `${Math.round(seo.lengthFt)} ft` : '', seo.location].filter(Boolean).join(' \u00b7 ');

    const body = `<div class="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
<header class="bg-yacht-900 px-6 pb-10 pt-16"><div class="mx-auto max-w-5xl">
<nav aria-label="Breadcrumb" class="text-[12px] font-light text-white/60"><a href="/">Home</a> / <a href="/yachts-for-sale">Yachts for Sale</a>${makeHref ? ` / <a href="${esc(makeHref)}">${esc(it.MakeString)}</a>` : ''}</nav>
<p class="mt-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">${cobrokerage ? 'FYI Yachts \u00b7 Yacht for Sale' : 'FYI Exclusive \u00b7 Listed by FYI Yachts'}</p>
<h1 class="mt-3 text-3xl font-light leading-snug tracking-wide text-white">${esc(seo.h1)}${content.tag ? ` <span class="ml-2 inline-block bg-yacht-brand px-2.5 py-1 align-middle text-[10px] font-semibold uppercase tracking-[0.2em] text-white">${esc(content.tag)}</span>` : ''}</h1>
${sub ? `<p class="mt-2 text-sm font-light text-white/60">${esc(sub)}</p>` : ''}
<p class="mt-4 text-2xl font-light text-white">${reduction ? `<s class="mr-3 text-lg text-white/50">${esc(formatMoney({ amount: reduction.previous, currency: reduction.currency }))}</s>` : ''}${esc(seo.priceText)}</p>
${reduction ? `<p class="mt-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-teal">Price reduced \u00b7 was ${esc(formatMoney({ amount: reduction.previous, currency: reduction.currency }))} \u00b7 ${esc(fmtDate(reduction.date))}</p>` : ''}
${cobrokerage && it.PlsDisclaimer ? `<p class="mt-4 max-w-2xl text-[12px] font-light leading-5 text-white/70">${esc(it.PlsDisclaimer)}</p>` : ''}
</div></header>
<main class="mx-auto max-w-5xl px-6 py-10">
${heroSrc ? `<img src="${esc(heroSrc)}"${heroSet ? ` srcset="${esc(heroSet)}" sizes="${esc(HERO_SIZES)}"` : ''} alt="${esc(seo.images[0].alt)}" width="1280" height="960" fetchpriority="high" class="w-full object-cover" />` : ''}
<section class="mt-10"><h2 class="font-serif text-2xl italic tracking-wide text-yacht-900">Description</h2>
${content.descriptionHtml
    ? `<div class="listing-prose mt-5">${content.descriptionHtml}</div>`
    : content.sections.length ? '' : '<p class="mt-4 text-[14px] font-light text-yacht-900/50">Full details available on request \u2014 enquire and a broker will send the complete specification.</p>'}
</section>
${specsHtml(groups)}
${content.sections.length ? `<section class="mt-12"><h2 class="font-serif text-2xl italic tracking-wide text-yacht-900">Full Details</h2>
${content.sections.map((s) => `<section class="mt-6 border-t border-yacht-900/10 pt-6"><h3 class="text-[13px] font-semibold uppercase tracking-[0.2em] text-yacht-900">${esc(s.title)}</h3><div class="listing-prose mt-3">${s.html}</div></section>`).join('\n')}</section>` : ''}
${seo.images.length > 1 ? `<section class="mt-12"><h2 class="font-serif text-2xl italic tracking-wide text-yacht-900">Photos (${seo.images.length})</h2>
<ul class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">${seo.images.slice(1).map((im) => `<li><a href="${esc(im.url)}"><img src="${esc(bgResizeUrl(im.url, 640) || im.url)}" alt="${esc(im.alt)}" width="640" height="480" loading="lazy" class="aspect-[4/3] w-full object-cover" /></a></li>`).join('')}</ul></section>` : ''}
${similarHtml(similar, 'Similar yachts for sale')}
<p class="mt-10 text-[14px] font-light"><a class="text-yacht-brand underline" href="/yachts-for-sale">Browse all yachts for sale</a>${makeHref ? ` \u00b7 <a class="text-yacht-brand underline" href="${esc(makeHref)}">More ${esc(it.MakeString)} yachts for sale</a>` : ''} \u00b7 Call <a class="text-yacht-brand underline" href="tel:+13058546020">+1 305-854-6020</a></p>
${content.disclaimerHtml
    ? `<div class="listing-prose mt-12 border-t border-yacht-900/10 pt-6 text-[12px] italic">${content.disclaimerHtml}</div>`
    : `<p class="mt-12 border-t border-yacht-900/10 pt-6 text-[12px] font-light italic leading-6 text-yacht-900/45">${esc(DISCLAIMER)}</p>`}
</main></div>`;

    const html = INDEX_SHELL
      .replace(/<title>.*?<\/title>/s, () => head)
      .replace('<div id="root"></div>', () => `<div id="root">${body}</div>${similarData(id, similar)}`);
    return res.status(200).send(html);
  } catch {
    return unavailable(res);
  }
}
