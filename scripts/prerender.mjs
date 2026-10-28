// Post-build SEO prerender. Emits dist/<path>/index.html for every public
// route — the built SPA shell with per-route <title>, meta description,
// canonical, Open Graph/Twitter tags, and JSON-LD injected — plus
// dist/sitemap.xml and dist/robots.txt. Crawlers and link unfurlers get
// correct metadata in the raw HTML; hydration then renders the full page.
//
// Vercel serves these static files before the SPA rewrite in vercel.json,
// so direct hits on public URLs pick up the prerendered shell while every
// other path (portal, listings) still falls through to /index.html.
//
// Canonical/sitemap host comes from SITE_URL (default https://fyiyachts.com):
// pre-cutover that keeps the vercel.app preview canonicalized to the live
// WordPress pages; at cutover the same output is self-canonical.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');
// Default social share card (1200×630, yacht photo + FYI logo), served from
// /public on the canonical domain so scrapers attribute it to fyiyachts.com.
// Bump the ?v= query whenever the image changes; env-overridable.
const OG_IMAGE = (process.env.OG_IMAGE || 'https://fyiyachts.com/og-cover.jpg?v=3').replace(/\/$/, '');

// Paths vercel.json 301s away. A redirected path must not be advertised
// anywhere in the prerendered output — not in the sitemap, not as an hreflang
// alternate, not as the footer's language link — because every one of those is
// a promise that a URL serves a page. Read from the redirect list rather than
// hard-coded, so switching a page off (e.g. the /es tier) removes it from all
// three on the next build.
const redirectedPaths = new Set(
  JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).redirects
    ?.map((r) => r.source)
    .filter((src) => src && !/[:*()]/.test(src)) ?? [],
);

// Bundle the TS route manifest so it can be imported here.
const dataOut = join(root, 'node_modules', '.cache', 'seo-data.mjs');
mkdirSync(dirname(dataOut), { recursive: true });
// React stays external: react-dom/server is CommonJS that requires Node
// built-ins, which an ESM bundle can't do; Node resolves it from node_modules.
// module-first main fields so lucide-react bundles as ESM (its CJS build
// require()s react, which the ESM bundle can't do either).
execSync(`npx esbuild scripts/seoData.ts --bundle --format=esm --platform=node --jsx=automatic --main-fields=module,main --external:react --external:react-dom --outfile=${JSON.stringify(dataOut)}`, { cwd: root, stdio: 'pipe' });
const {
  buildRoutes, fetchBuildInventory, attachHubInventory, attachLandingShells,
  BRAND_PAGES, CATEGORY_PAGES, FYI_TEAM, MANUAL_LISTING_COUNT,
} = await import(pathToFileURL(dataOut).href);

const archiveIndex = JSON.parse(readFileSync(join(root, 'public', 'news', 'index.json'), 'utf8'));
const newsIndex = [...archiveIndex].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

const routes = buildRoutes(newsIndex);

// Bake the first screen of live inventory + ItemList schema into the brand
// and category hub pages — their grids are otherwise client-rendered, so
// crawlers indexed hubs with no boats in them (77 pages, ~175k impressions a
// quarter at 0.20% CTR). Both feeds degrade to empty on failure, in which
// case the hubs build exactly as they did before this step existed.
const inventory = await fetchBuildInventory();
const hubsTouched = attachHubInventory(routes, inventory);
console.log(`inventory: ${inventory.fyi.length} FYI + ${inventory.worldwide.length} worldwide listing(s) → baked into ${hubsTouched} hub page(s)`);
const lpCount = await attachLandingShells(routes, inventory);
console.log(`landing pages: ${lpCount ?? 'no'} center console count baked in`);

// index.html carries static description/OG/Twitter meta for the bare domain and
// client-rendered routes. Strip that managed block from the template so each
// prerendered route injects its own per-page meta without duplicates.
const template = readFileSync(join(dist, 'index.html'), 'utf8')
  .replace(/\n\s*<!-- Social share card[^>]*-->/g, '')
  .replace(/\n\s*<meta (?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Static content injected into #root so crawlers that don't execute JS —
// GPTBot, ClaudeBot, PerplexityBot, link unfurlers — see the real page.
// React's createRoot render replaces it on mount; the shell uses the same
// Tailwind classes as the app so the pre-hydration paint matches the design
// (and gives PageSpeed an instant text FCP/LCP).
const escB = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Footer language link, mirroring the app's nav toggle. Omitted entirely when
// the counterpart is a redirected path — while the Spanish tier is off, every
// English page would otherwise link its non-JS shell straight into a 301.
const languageFooterLink = (r) => {
  const target = r.path.startsWith('/es') ? '/' : '/es';
  if (redirectedPaths.has(target)) return '';
  const label = r.path.startsWith('/es') ? 'English' : 'Español — hablamos su idioma';
  return `<p class="mt-2"><a href="${target}">${label}</a></p>`;
};
const NAV = [
  ['Yachts for Sale', '/yachts-for-sale'], ['Sell', '/sell'], ['Charter', '/charter'],
  ['Financing', '/yacht-financing'], ['Our Team', '/our-team'], ['News', '/fyi-news'], ['Contact', '/contact'],
];
function staticShell(r) {
  // r.isNews, not a slug lookup: slugs are not unique across collections, and
  // a slug-based test labelled the center-console CATEGORY page "FYI News".
  const eyebrow = r.path.startsWith('/consultants/') ? 'FYI Yachts Consultant'
    : r.isNews ? 'FYI News' : 'FYI Yachts';
  // r.h1 where the route sets one (the Spanish pages do — deriving from their
  // title yielded a bare English "FYI Yachts" as the only heading a non-JS
  // crawler saw on a Spanish page); otherwise the title's first segment.
  const h1 = escB(r.h1 ?? r.title.split(' | ')[0].split(' — ')[0]);
  return `<div class="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
<header class="bg-yacht-900 px-6 pb-14 pt-16"><div class="mx-auto max-w-3xl">
<nav class="mb-10 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">${NAV.map(([l, h]) => `<a href="${h}">${l}</a>`).join('')}</nav>
<p class="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">${eyebrow}</p>
<h1 class="mt-4 text-3xl font-light leading-snug tracking-wide text-white">${h1}</h1>
<p class="mt-4 text-[15px] font-light leading-7 text-white/70">${escB(r.description)}</p>
</div></header>
<main class="mx-auto max-w-3xl px-6 py-12">${r.bodyHtml ?? ''}</main>
<footer class="border-t border-yacht-900/10 px-6 py-10"><div class="mx-auto max-w-3xl text-[13px] font-light leading-7 text-yacht-900/60">
<p><strong>Florida Yachts International (FYI Yachts)</strong> — 2424 Coral Way, Miami, FL 33145 — <a href="tel:+13058546020">+1 305-854-6020</a> — <a href="mailto:sales@fyiyachts.com">sales@fyiyachts.com</a></p>
<p class="mt-2">Serving Coral Gables, Coconut Grove, Miami, Miami Beach, Key Biscayne, Fort Lauderdale, and buyers worldwide since 1994.</p>
${languageFooterLink(r)}
</div></footer></div>`;
}

// Full article bodies for the news routes — the sanitized JSON already
// holds the complete post content.
//
// Two things are repaired here, both artefacts of the WordPress migration:
//
//  1. Thirteen articles begin with the site's own category navigation, scraped
//     into the post body as a <ul> of /category/fyi-news/ links. It rendered as
//     a stray link list above the article and, worse, was the first prose a
//     crawler saw on the page.
//  2. Fifteen posts came across with an empty excerpt, so their routes carried
//     no meta description at all and Google was left to invent a snippet.
//
// Stripping the nav first is what makes the derived description usable — take
// it before, and all fifteen would read "FYI Yachts News New Boat Listing Boat
// Shows & Events Sold Yachts...", which is worse than having none.
const newsBody = new Map();
const newsDesc = new Map();

// The scraped nav is always the leading <ul>, and every one of its links points
// at a /category/fyi-news/ URL. Requiring that pattern means a list that opens
// a genuine article is left alone.
const stripScrapedNav = (html) => {
  const m = /^\s*<ul>[\s\S]*?<\/ul>/.exec(html);
  if (!m) return html;
  const links = m[0].match(/href="[^"]*"/g) ?? [];
  const isNav = links.length >= 3 && links.every((h) => h.includes('/category/fyi-news'));
  return isNav ? html.slice(m[0].length) : html;
};

const plainText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
  .replace(/&nbsp;/g, ' ').replace(/&#8217;|&rsquo;/g, '\u2019').replace(/\s+/g, ' ').trim();

// ~155 chars is what Google renders before truncating; cut on a word boundary
// so the snippet never ends mid-word.
const summarize = (text) => {
  if (text.length <= 155) return text;
  const cut = text.slice(0, 155);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120)).trimEnd()}\u2026`;
};

for (const p of newsIndex) {
  try {
    const html = stripScrapedNav(
      JSON.parse(readFileSync(join(root, 'public', 'news', `${p.slug}.json`), 'utf8')).html ?? '',
    );
    newsBody.set(p.slug, `<p class="mt-2 text-[13px] font-light text-yacht-900/50">${escB(p.category)} · ${escB(p.date)}</p><article class="text-[15px] font-light leading-8 text-yacht-900/80">${html}</article>`);
    const derived = summarize(plainText(html));
    if (derived) newsDesc.set(p.slug, derived);
  } catch { /* article body optional */ }
}

let written = 0;
for (const r of routes) {
  if (r.isNews && !r.bodyHtml) r.bodyHtml = newsBody.get(r.path.slice(1)) ?? r.bodyHtml;
  // Fifteen migrated posts have no excerpt; fall back to the article's own
  // opening prose rather than shipping a page with no description.
  if (r.isNews && !r.description) r.description = newsDesc.get(r.path.slice(1)) ?? r.description;
  // No trailing slash: vercel.json trailingSlash:false serves the bare form,
  // so canonical must match the served URL exactly (slashed WP-era links 308
  // here in one hop). Root stays "/".
  const url = `${SITE}${r.path === '/' ? '/' : r.path}`;
  // A route may declare a different page as canonical (a duplicate slug kept
  // for URL parity). Everything else stays self-canonical.
  const canonical = `${SITE}${r.canonicalPath ?? (r.path === '/' ? '/' : r.path)}`;
  const head = [
    `<title>${esc(r.title)}</title>`,
    // data-static-path marks this as the BUILD-TIME description for exactly this
    // route. utils/usePageMeta reads it and declines to overwrite a match, because
    // the built copy is strictly richer than what the React tier can recompute on
    // mount: hub descriptions lead with live inventory counts and price ranges
    // (scripts/seoData.ts hubFacts), and the client has no inventory until its
    // fetch resolves. Without the guard, Google's rendered DOM shows the generic
    // description and the facts are never seen by a searcher.
    `<meta name="description" content="${esc(r.description)}" data-static-path="${esc(r.path)}" />`,
    r.noindex ? `<meta name="robots" content="noindex" />` : '',
    `<link rel="canonical" href="${esc(canonical)}" />`,
    // hreflang. Google reads these from the served HTML; the React tier already
    // declared the same pairs but injected them on mount, so they landed on 0
    // of 406 prerendered pages and no crawler that skips JS ever saw them.
    // An alternate pointing at a 301 is a wasted annotation, and a pair where
    // one side no longer serves a page is not reciprocal, so the whole set is
    // dropped once any member is redirected (the /es tier while it is off).
    ...((r.alternates ?? []).some((a) => redirectedPaths.has(a.path)) ? [] : (r.alternates ?? [])).map(
      (a) => `<link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(`${SITE}${a.path}`)}" />`,
    ),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="FYI Yachts" />`,
    `<meta property="og:title" content="${esc(r.title)}" />`,
    `<meta property="og:description" content="${esc(r.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(r.image || OG_IMAGE)}" />`,
    !r.image ? `<meta property="og:image:width" content="1200" />` : '',
    !r.image ? `<meta property="og:image:height" content="630" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${esc(r.image || OG_IMAGE)}" />`,
    ...(r.jsonLd ?? []).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
  ].filter(Boolean).join('\n    ');

  let html = template.replace(/<title>.*?<\/title>/s, head);
  html = html.replace('<div id="root"></div>', `<div id="root">${r.shellHtml ?? staticShell(r)}</div>`);
  const outDir = join(dist, ...r.path.split('/').filter(Boolean));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  written++;
}

// Sitemaps — public routes only (portal stays out). sitemap.xml is an INDEX
// over two children:
//   sitemap-pages.xml    — the static routes below, written here at build time
//   sitemap-listings.xml — the live yacht inventory, generated per request by
//                          api/sitemap-listings.ts (rewritten in vercel.json)
// The catalogue turns over between deploys, so listings cannot be baked in
// here — and before the dynamic child existed, none of the ~140 listing pages
// were in any sitemap at all. Search Console accepts an index wherever it
// accepts a sitemap, so the submitted URL stays /sitemap.xml permanently.
const today = new Date().toISOString().slice(0, 10);
// News posts carry their real publish date. Stamping the build date on 280
// articles that have not changed since 2019 is a freshness claim crawlers
// learn to ignore — and once ignored, it is ignored for the pages where it
// is true as well.
const isoDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d ?? '')) ? String(d) : null);
const newsDate = new Map(newsIndex.map((p) => [`/${p.slug}`, isoDate(p.date)]));
// A sitemap advertises the URLs you want indexed. Two kinds of route do not
// belong in one:
//
//  1. A page that names a DIFFERENT page as canonical — listing it asks Google
//     to index a URL the same page tells it to ignore.
//  2. A path vercel.json 301s away. The /es tier is built here but redirected
//     to the English pages in production, so all seven Spanish URLs sat in the
//     sitemap advertising redirects. Search Console files those under "Page
//     with redirect" and they burn crawl budget on every pass.
//
// redirectedPaths (built at the top of this file) is read rather than
// hard-coding /es, which keeps this correct by construction: switch any page
// off with a redirect later and it leaves the sitemap on the next build
// instead of quietly advertising a 301.
const indexable = routes.filter((r) => !r.canonicalPath && !r.noindex && !redirectedPaths.has(r.path));
const droppedRedirects = routes.filter((r) => redirectedPaths.has(r.path)).map((r) => r.path);
if (droppedRedirects.length) {
  console.log(`sitemap: excluded ${droppedRedirects.length} redirected path(s) — ${droppedRedirects.join(', ')}`);
}
writeFileSync(join(dist, 'sitemap-pages.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((r) => `  <url><loc>${SITE}${r.path === '/' ? '/' : r.path}</loc><lastmod>${newsDate.get(r.path) || today}</lastmod></url>`).join('\n')}
</urlset>
`);

writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE}/sitemap-pages.xml</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${SITE}/sitemap-listings.xml</loc><lastmod>${today}</lastmod></sitemap>
</sitemapindex>
`);

// IndexNow key file. Bing (and Yandex, Seznam, Naver) verify an IndexNow
// submission by fetching https://<host>/<key>.txt and checking it contains
// the key — so the file must be served from the site root and must match
// whatever key api/_lib/indexNow.ts submits with. Both read INDEXNOW_KEY, and
// both fall back to the same committed default, so the pair cannot drift.
// This key is public by design; it authenticates the *site*, not the account,
// and is not a secret.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'f358d775e5f54fdd912174feb9436017';
writeFileSync(join(dist, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);

// robots.txt — AI crawlers explicitly welcomed (GEO workstream): being
// citable by ChatGPT/Claude/Perplexity/Gemini is a client goal.
//
// Every group carries the same rules. A crawler obeys only the most specific
// group that names it and ignores `*`, so a Disallow under one bot (as
// /admin/ used to be, under Google-Extended alone) binds nobody else.
const ROBOTS_AGENTS = [
  '*',
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User',
  'PerplexityBot',
  'Google-Extended',
  'Applebot', 'Applebot-Extended',
  'Bingbot',
  'CCBot',
  'Meta-ExternalAgent',
  'Amazonbot',
];
const ROBOTS_RULES = ['Allow: /', 'Disallow: /admin/', 'Disallow: /app/', 'Disallow: /internal-stats'];
writeFileSync(
  join(dist, 'robots.txt'),
  ROBOTS_AGENTS.map((ua) => [`User-agent: ${ua}`, ...ROBOTS_RULES].join('\n')).join('\n\n')
    + `\n\nSitemap: ${SITE}/sitemap.xml\n`,
);

// llms.txt — the emerging convention AI engines read for a site synopsis.
// Counts come from the build: the live exclusive book (BoatsGroup feed +
// hand-entered listings) when the feed answered, "100+" when it didn't; the
// team from the roster the /consultants pages are built from.
const newsTop = newsIndex.slice(0, 15);
const exclusiveCount = inventory.fyi.length ? inventory.fyi.length + MANUAL_LISTING_COUNT : 0;
const exclusiveLabel = exclusiveCount ? `${exclusiveCount}` : '100+';
const brandCount = new Set(BRAND_PAGES.map((b) => b.name)).size;
const cat = (slug) => {
  const c = CATEGORY_PAGES.find((x) => x.slug === slug);
  return c ? `[${c.h1}](${SITE}/${c.slug})` : null;
};
const categoryLinks = [
  'super-yachts-for-sale', '60-to-80-ft-yachts-for-sale', 'yachts-for-sale-miami', 'new-yachts-for-sale',
  'used-yachts-for-sale', 'small-yachts-for-sale', 'sport-fishing-yachts-for-sale',
  'center-console-boats-for-sale', 'catamaran-yachts-for-sale',
].map(cat).filter(Boolean).join(' · ');
writeFileSync(join(dist, 'llms.txt'), `# FYI Yachts — Florida Yachts International

> Miami luxury yacht brokerage founded in 1994, headquartered at 2424 Coral Way, Miami, FL 33145, serving Coral Gables, Coconut Grove, Miami, Miami Beach, Key Biscayne, Fort Lauderdale, and buyers worldwide. 300+ years of combined consultant experience. Yacht sales, charters, financing, lease-to-own, and new construction. Phone +1-305-854-6020, sales@fyiyachts.com.

## Inventory
- [Yachts for Sale](${SITE}/yachts-for-sale): ${exclusiveLabel} FYI Yachts exclusive listings, plus access to ~9,000 co-brokerage yachts listed by other brokerages (United States, power, 35–120 ft) that FYI can sell — all searchable in one place by builder, model, length, price, year and condition
- [Current exclusive listings, plain text](${SITE}/llms-inventory.txt): every FYI exclusive with year, builder, model, length, price, location and link — updated live
- ${categoryLinks}
- Brand pages for ${brandCount} builders (Azimut, Sunseeker, Riva, Sanlorenzo, Pershing, Sea Ray, …) at /<brand>-yachts-for-sale
- [Sold Yachts](${SITE}/sold-yachts): recent closings

## Services
- [Sell Your Yacht](${SITE}/sell) · [Charter](${SITE}/charter) · [Financing](${SITE}/yacht-financing) · [Lease-to-Own](${SITE}/lease-to-own) · [Closing Services](${SITE}/yacht-closing-services)

## People
- [Our Team](${SITE}/our-team): ${FYI_TEAM.length} yacht consultants and staff, each with a profile at /consultants/<name> showing their live listings and sold history

## News
${newsTop.map((p) => `- [${p.title}](${SITE}/${p.slug})`).join('\n')}
`);

// Emit the built index.html (hashed asset tags, empty #root) as a bundled
// string module so the dynamic listing function can server-render meta +
// static content into the exact same shell. Written as TS so esbuild
// includes it in the function bundle.
writeFileSync(
  join(root, 'api', '_lib', 'indexShell.ts'),
  `// AUTO-GENERATED by scripts/prerender.mjs — do not edit.\n// The built index.html shell (hashed asset tags) for server-rendered\n// listing pages (api/listing/[id].ts).\nexport const INDEX_SHELL = ${JSON.stringify(template)};\n`,
);

console.log(`prerendered ${written} routes + sitemap.xml (index) + sitemap-pages.xml + robots.txt + llms.txt (${exclusiveLabel} exclusives, ${FYI_TEAM.length} team) + ${INDEXNOW_KEY}.txt + indexShell (${SITE})`);

// Analytics: utils/analytics.ts ships FYI's own measurement ID as a committed
// default, so events flow whether or not VITE_GA4_ID is set. This line stays
// because *which property a deploy reports into* is worth stating out loud at
// build time — a fork, or a staging deploy that must not write into FYI's
// production property, has to set the var explicitly to override.
console.log(
  process.env.VITE_GA4_ID
    ? `analytics: GA4 ${process.env.VITE_GA4_ID} (from VITE_GA4_ID)`
    : "analytics: GA4 G-EF1VDXWBEB (built-in default — FYI's production property; set VITE_GA4_ID to override)",
);

