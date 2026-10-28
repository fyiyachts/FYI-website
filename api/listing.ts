// Server-rendered listing page. /listing/:id is rewritten to
// /api/listing?id=:id (vercel.json) — a static function path so it resolves
// reliably (a dynamic [id].ts route did not match under the /api/(.*) rewrite).
// so crawlers, link unfurlers, and AI engines get real per-listing metadata
// and body text instead of the empty SPA shell. The exact same hashed asset
// tags boot React, which replaces the injected #root content on mount — this
// is dynamic rendering (Google-supported), not cloaking: the content matches
// what the client renders.
import { INDEX_SHELL } from './_lib/indexShell.js';
import { findManualListing } from './_lib/manualListings.js';
import { plsGetById } from './_lib/plsFeed.js';
import { countryName } from './_lib/countryName.js';
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

const num = (v: unknown): number | undefined => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};


// A boat that is gone (sold, withdrawn, never existed) must return a real 404.
// This used to send the bare shell with a 200 — homepage title, no canonical,
// cached an hour — so every boat that sold left a homepage clone behind, which
// is exactly Search Console's "Soft 404" / "Alternate page with proper
// canonical tag" buckets (same defect api/worldwide-listing.ts fixed for the
// worldwide feed). Short edge TTL: a feed hiccup that returns no row for a
// live boat should not keep it 404 for long.
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
  // Cache at the edge; listings change slowly, SWR keeps it fresh.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');

  if (!id) return notFound(res);

  try {
    // Hand-entered listings (api/_lib/manualListings.ts) before the feed.
    let it = findManualListing(id);
    if (!it) {
      const url = new URL(UPSTREAM);
      url.searchParams.set('key', KEY);
      url.searchParams.set('documentid', id);
      const feed = (await fetch(url).then((r) => r.json())) as { results?: Record<string, any>[] };
      it = feed.results?.[0];
    }
    // Co-brokerage boats (BoatsGroup PLS) get the same server-rendered page.
    if (!it) it = await plsGetById(id).catch(() => undefined);
    if (!it) return notFound(res);

    // Co-brokerage boats are usable (linked, browsable, shareable) but kept
    // out of the index: they are other brokerages' listings, also live on
    // their own sites. FYI's own and manual listings stay fully indexed.
    // Canonical, content and Product schema are unchanged either way.
    const noindex = it.ListingType === 'cobrokerage';
    if (noindex) res.setHeader('X-Robots-Tag', 'noindex, follow');

    const loc = it.BoatLocation || {};
    const title = it.BoatName || [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim() || 'Yacht';
    // Shown and marked up in the listing's own currency ("€845,000", EUR).
    const price = listPrice(it);
    const priceText = formatMoney(price, 'Price on Request');
    const lengthFt = num(it.LengthOverall ?? it.NominalLength);
    const city = loc.BoatCityName && loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : undefined;
    // Country spelled out when there is no US state ("Turkey", not "TR"),
    // matching the listing page.
    const region = [city, loc.BoatStateCode || countryName(loc.BoatCountryID)].filter(Boolean).join(', ');
    const images: string[] = Array.isArray(it.Images)
      ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || ''))
          .filter(Boolean)
          // Manual listings self-host their photos root-relative.
          .map((u: string) => (u.startsWith('/') ? `${SITE}${u}` : u))
      : [];
    // Absolute, not root-relative: this is an og:image, and the crawlers that
    // read it have no page origin to resolve against. Self-hosted since the
    // GCS bucket it used to live in went 403 (see components/layout/FYILogo.tsx).
    const hero = images[0] || `${SITE}/brand/fyi-logo-2024.png`;
    // Preload the hero photo the page will paint first — the same URLs the
    // React page requests (HERO_WIDTHS / HERO_SIZES in PublicListingPage.tsx
    // and bgResize in utils/img.ts; the API can't import client modules, so
    // keep the three in step). BoatsGroup photos only: their resizer is the
    // URL the page uses; other hosts go through the optimizer, which this
    // shell can't predict.
    const heroPreload = images[0] ? bgHeroPreload(images[0]) : '';
    const desc = typeof it.GeneralBoatDescription === 'string'
      ? it.GeneralBoatDescription.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    const metaDesc = (desc.slice(0, 155) || `${title} for sale with FYI Yachts (Florida Yachts International) in Miami. ${priceText}${region ? ` · ${region}` : ''}.`).trim();
    const pageTitle = `${title} for Sale | FYI Yachts`;
    // No trailing slash: vercel.json trailingSlash:false serves the bare form
    // and 308s the slashed one, so a slashed canonical points every listing at
    // a redirect — Google treats that as a conflicting signal and picks its own
    // canonical instead. Must match the served URL exactly (same rule as
    // scripts/prerender.mjs).
    const canonical = `${SITE}/listing/${id}`;

    const specs: [string, string][] = ([
      it.ModelYear ? ['Year', String(it.ModelYear)] : null,
      lengthFt ? ['Length', `${Math.round(lengthFt)} ft`] : null,
      it.MakeString ? ['Builder', it.MakeString] : null,
      it.Model ? ['Model', it.Model] : null,
      it.BeamMeasure ? ['Beam', it.BeamMeasure] : null,
      it.CabinsCountNumeric ? ['Cabins', String(it.CabinsCountNumeric)] : null,
      region ? ['Location', region] : null,
    ].filter(Boolean)) as [string, string][];

    // Product markup only when the listing has a visible price: Google
    // requires offers (or reviews/ratings, which listings never have), so a
    // price-on-request Product is guaranteed an "invalid item" in Search
    // Console rather than a rich result. Brokerage boats are used unless the
    // feed says otherwise; condition + a guaranteed image are what Merchant
    // Listings validation looks for beyond the offer itself.
    const condition = String(it.SaleClassCode ?? '').toLowerCase() === 'new'
      ? 'https://schema.org/NewCondition'
      : 'https://schema.org/UsedCondition';
    const jsonLd = [
      ...(price ? [{
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: title,
        image: images.length ? images.slice(0, 5) : [hero],
        ...(desc ? { description: desc.slice(0, 500) } : {}),
        ...(it.MakeString ? { brand: { '@type': 'Brand', name: it.MakeString } } : {}),
        offers: {
          '@type': 'Offer', price: price.amount, priceCurrency: price.currency,
          availability: 'https://schema.org/InStock',
          itemCondition: condition,
          url: canonical,
          seller: { '@type': 'Organization', name: 'Florida Yachts International' },
        },
      }] : []),
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Yachts for Sale', item: `${SITE}/yachts-for-sale` },
          { '@type': 'ListItem', position: 3, name: title, item: canonical },
        ],
      },
    ];

    const head = [
      `<title>${esc(pageTitle)}</title>`,
      `<meta name="description" content="${esc(metaDesc)}" />`,
      `<link rel="canonical" href="${esc(canonical)}" />`,
      ...(noindex ? ['<meta name="robots" content="noindex, follow" />'] : []),
      `<meta property="og:type" content="product" />`,
      `<meta property="og:site_name" content="FYI Yachts" />`,
      `<meta property="og:title" content="${esc(pageTitle)}" />`,
      `<meta property="og:description" content="${esc(metaDesc)}" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      `<meta property="og:image" content="${esc(hero)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      ...(heroPreload ? [heroPreload] : []),
      ...jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
    ].join('\n    ');

    const body = `<div class="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
<header class="bg-yacht-900 px-6 pb-10 pt-16"><div class="mx-auto max-w-3xl">
<p class="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">FYI Yachts \u00b7 Yacht for Sale</p>
<h1 class="mt-3 text-3xl font-light leading-snug tracking-wide text-white">${esc(title)}</h1>
${region ? `<p class="mt-2 text-sm font-light text-white/60">${esc(region)}</p>` : ''}
<p class="mt-4 text-2xl font-light text-white">${esc(priceText)}</p>
</div></header>
<main class="mx-auto max-w-3xl px-6 py-10">
${specs.length ? `<dl>${specs.map(([k, v]) => `<div class="flex justify-between border-b border-yacht-900/10 py-3 text-[14px]"><dt class="font-light text-yacht-900/55">${esc(k)}</dt><dd class="font-medium text-yacht-900">${esc(v)}</dd></div>`).join('')}</dl>` : ''}
${desc ? `<div class="mt-8 text-[15px] font-light leading-8 text-yacht-900/80"><p>${esc(desc.slice(0, 1400))}</p></div>` : ''}
<p class="mt-8"><a class="text-yacht-brand underline" href="/yachts-for-sale">Browse all yachts for sale</a> \u00b7 Call <a class="text-yacht-brand underline" href="tel:+13058546020">+1 305-854-6020</a></p>
</main></div>`;

    const html = INDEX_SHELL
      .replace(/<title>.*?<\/title>/s, head)
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
    return res.status(200).send(html);
  } catch {
    return unavailable(res);
  }
}
