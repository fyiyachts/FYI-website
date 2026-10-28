// Route + metadata manifest for the post-build SEO prerender (see
// scripts/prerender.mjs). Bundled with esbuild at build time so the
// prerenderer reuses the exact same data the app routes from.
import {
  BRAND_PAGES, CATEGORY_PAGES, brandSeoTitle, brandSeoDescription,
  normalizePublicBoat, isFyiCompany, resizeBG, fmtBoatPrice, type PublicBoat,
} from '../components/public/publicData';
import { CONTENT_PAGES } from '../components/public/contentData';
import { FYI_TEAM, memberByRepKey, memberBySlug, repKey, type TeamMember } from '../components/team/fyiTeam';
import { FYI_BIOS } from '../components/team/fyiBios';
import { MANUAL_LISTINGS } from '../api/_lib/manualListings';
import { CHARTER_FAQS, SELL_FAQS, LEASE_FAQS, type QA } from '../components/public/faqData';
import { CATEGORY_FAQS, ABOUT_FAQS, CONTACT_FAQS, GENERAL_FAQS } from '../components/public/categoryFaqs';
import { CASE_STUDIES } from '../components/public/caseStudyData';
import { getBrandDetail } from '../components/public/brandContent';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { LpShell } from '../components/lp/LpChrome';
import QuickForm from '../components/lp/QuickForm';
import { CC_FAQS, CC_HERO, LP_DESCRIPTION, LP_PATH, LP_TITLE, QUICK_FORM, isCenterConsole } from '../components/lp/ccContent';
import { plsSearch, PLS_CARD_FIELDS } from '../api/_lib/plsFeed';
import {
  ALL_CHARTER_VESSELS, CHARTER_FLEET, TERM_CHARTER, CHARTER_INCLUDES,
  CHARTER_FROM_PRICE, CHARTER_PHONE_DISPLAY, CHARTER_EMAIL, isTermVessel,
} from '../components/public/charterFleet';

export interface SeoRoute {
  path: string;              // e.g. /yachts-for-sale
  title: string;
  description: string;
  image?: string;
  jsonLd?: object[];
  bodyHtml?: string;   // static content injected into #root for no-JS crawlers
  // Set only when a page must point at a DIFFERENT page as canonical — i.e. it
  // is a deliberate duplicate kept for URL parity. Self-canonical is the
  // default and needs no value here.
  //
  // Holds a PATH, not a URL. seoData resolves SITE from SITE_ORIGIN while
  // prerender resolves it from SITE_URL; baking an absolute URL here would
  // silently canonicalize to the wrong host whenever those two disagree.
  canonicalPath?: string;
  // hreflang alternates. Emitted into the prerendered <head>, because that is
  // where Google reads them — the React tier already declared these pairs via
  // usePageMeta, but client-injected hreflang is not reliably picked up, and
  // the AI crawlers robots.txt welcomes never run the script at all. Result:
  // hreflang appeared on 0 of 406 prerendered pages, so the Spanish tier was
  // launched without the one signal that pairs a translation to its original.
  alternates?: { hreflang: string; path: string }[];
  // Heading for the prerendered shell. Defaults to the title's first segment,
  // which is fine for "Yachts for Sale in Miami | FYI Yachts" but produced a
  // bare "FYI Yachts" on the Spanish homepage — an English brand string as the
  // only h1 a non-JS crawler sees on a Spanish page. Set it where the derived
  // value is not the heading the page actually shows.
  h1?: string;
  // True only for routes built from the migrated news archive. prerender uses
  // this to pick the eyebrow and to fill in article bodies. It exists because
  // slugs are NOT unique across collections — a 2022 post shares a slug with
  // the center-console category page — so "is this slug in newsIndex?" is the
  // wrong question to ask about a route, and answering it that way labelled a
  // commercial category page "FYI News".
  isNews?: boolean;
  // Kept out of search: prerender emits a robots noindex tag and leaves the
  // route out of the sitemap. The paid-traffic landing pages (/lp/*).
  noindex?: boolean;
  // The page's own first paint, used instead of the generic static shell. The
  // landing pages set it so the CDN serves the header and hero React mounts
  // over, rather than a stand-in that gets swapped out (and moves the LCP).
  shellHtml?: string;
}

const ORG = {
  '@type': 'Organization',
  name: 'Florida Yachts International',
  alternateName: 'FYI Yachts',
  url: 'https://fyiyachts.com/',
  // Self-hosted since the `fyiyachts` GCS bucket started answering 403 (see
  // components/layout/FYILogo.tsx). Spelled absolute, and literal rather than
  // via SITE, because SITE is declared below this block and structured data
  // must carry a resolvable URL — same reason `url` above is a literal.
  logo: 'https://fyiyachts.com/brand/fyi-logo-2024.png',
  telephone: '+1-305-854-6020',
  email: 'sales@fyiyachts.com',
  foundingDate: '1994',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '2424 Coral Way',
    addressLocality: 'Miami',
    addressRegion: 'FL',
    postalCode: '33145',
    addressCountry: 'US',
  },
  // Must stay in step with OFFICE in components/public/OfficeMap.tsx — corrected
  // 2026-08-21 from 25.7492,-80.2635, which sat ~2.9 km west in Coral Gables.
  // This copy is the one Google reads: it rode LocalBusiness schema on 400+
  // prerendered pages, so the wrong pin was being asserted site-wide.
  geo: { '@type': 'GeoCoordinates', latitude: 25.750181, longitude: -80.235102 },
  hasMap: 'https://www.google.com/maps/place/Florida+Yachts+International/@25.750181,-80.235102,17z',
  areaServed: ['Coral Gables', 'Coconut Grove', 'Miami', 'Miami Beach', 'Key Biscayne', 'Fort Lauderdale', 'South Florida', 'Worldwide']
    .map((name) => ({ '@type': 'Place', name })),
  sameAs: [
    'https://www.facebook.com/fyiyachts',
    'https://www.instagram.com/fyiyachts/',
    'https://www.linkedin.com/company/florida-yachts-international/',
    'https://www.youtube.com/@FYIYACHTS',
  ],
};

const HERO = 'https://fyiyachts.com/brand/fyi-logo-2024.png';

// Site-wide LocalBusiness. This used to be emitted on /homepage only, which
// meant the 400+ pages that actually rank carried no local-business signal at
// all. The stable @id tells consumers every copy is one entity.
const LOCAL_BUSINESS = {
  '@context': 'https://schema.org',
  ...ORG,
  '@type': 'LocalBusiness',
  '@id': 'https://fyiyachts.com/#organization',
  priceRange: '$$$$',
  image: HERO,
};

// Self-hosted social images need an absolute URL. Mirrors prerender.mjs's OG_IMAGE default.
const SITE = (process.env.SITE_ORIGIN || 'https://fyiyachts.com').replace(/\/$/, '');

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const paras = (text: string): string =>
  text.split(/\n\n+/).map((p) => `<p class="mt-4 text-[15px] font-light leading-8 text-yacht-900/75">${esc(p)}</p>`).join('');

export const faqSchema = (faqs: QA[]): object => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

// Crawlable related-links strip for prerendered bodies. Inventory pages are a
// cluster — categories and brands should link each other so authority flows
// through the whole cluster instead of pooling on /yachts-for-sale.
// vercel.json sets trailingSlash:false, so "/x/" 308s to "/x". Call sites here
// were written with the WordPress-era slashed form, which put 1,082 internal
// links in the built site on a redirect — a wasted hop for every visitor and
// every crawl. Normalising centrally fixes them all without touching each
// caller, and lets either form be passed safely from now on.
const noSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

const linkStrip = (heading: string, links: [string, string][]): string =>
  `<h2 class="mt-10 text-xl font-light text-yacht-900">${esc(heading)}</h2><p class="mt-3 text-[14px] leading-8">${links
    .map(([name, path]) => `<a class="text-yacht-brand underline" href="${noSlash(path)}">${esc(name)}</a>`)
    .join(' · ')}</p>`;

/**
 * Every builder we keep a hub for, one entry per brand.
 *
 * BRAND_PAGES carries a few slug aliases for URL parity (Sanlorenzo is listed
 * under both `sanlorenzo-` and `san-lorenzo-`), which must not both appear in a
 * link strip: two links reading "Sanlorenzo yachts" to different URLs is a
 * duplicate-content signal pointing at the very pages the strip exists to
 * strengthen. First slug per name wins, which is the canonical one.
 */
const uniqueBrands = () => {
  const seen = new Set<string>();
  return BRAND_PAGES.filter((b) => !seen.has(b.name) && seen.add(b.name));
};

/** Six neighboring builders (wrap-around) — every brand page links different peers. */
const relatedBrands = (slug: string) => {
  const i = BRAND_PAGES.findIndex((o) => o.slug === slug);
  return [...BRAND_PAGES.slice(i + 1), ...BRAND_PAGES.slice(0, Math.max(i, 0))].slice(0, 6);
};

export const crumbs = (items: [string, string][]): object => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({
    '@type': 'ListItem', position: i + 1, name, item: `https://fyiyachts.com${noSlash(path)}`,
  })),
});

// Brand slugs kept only so an old inbound URL still resolves — they render the
// same page as the primary slug, from the same BRAND_PAGES data, so they are
// exact duplicates. Left self-canonical they compete with the real page for
// the same query and split its signals; Search Console reports them as
// "Duplicate without user-selected canonical". Pointing the variant at the
// primary keeps the URL working and consolidates the ranking signals.
// Every English page that has a Spanish counterpart, and vice versa. Declared
// once so both sides of each pair always agree — hreflang is only honoured when
// the annotation is reciprocal, and a one-sided declaration is ignored.
// Paths are unslashed: trailingSlash:false means "/sell/" 308s, and hreflang
// pointing at a redirect is a wasted annotation.
const EN_ES_PAIRS: [string, string][] = [
  ['/', '/es'],
  ['/sell', '/es/vender'],
  ['/charter', '/es/charter'],
  ['/yachts-for-sale', '/es/inventario'],
  ['/yacht-financing', '/es/financiamiento'],
  ['/our-team', '/es/equipo'],
  ['/contact', '/es/contacto'],
];

const ALTERNATES = new Map<string, { hreflang: string; path: string }[]>();
for (const [en, es] of EN_ES_PAIRS) {
  // x-default points at the English page: it is the fallback for a searcher
  // whose language we have no version for.
  const pair = [{ hreflang: 'en', path: en }, { hreflang: 'es', path: es }, { hreflang: 'x-default', path: en }];
  ALTERNATES.set(en, pair);
  ALTERNATES.set(es, pair);
}

const BRAND_SLUG_ALIASES: Record<string, string> = {
  'san-lorenzo-yachts-for-sale': 'sanlorenzo-yachts-for-sale',
};

export function buildRoutes(newsIndex: { slug: string; title: string; date: string; category: string; image: string; excerpt: string }[]): SeoRoute[] {
  const routes: SeoRoute[] = [];

  // ChatGPT Ads landing page: noindex, no nav, not in the sitemap. The shell
  // gets the live count in attachLandingShells once the build feed answers.
  routes.push({
    path: LP_PATH,
    title: LP_TITLE,
    description: LP_DESCRIPTION,
    noindex: true,
    jsonLd: [faqSchema(CC_FAQS)],
    shellHtml: landingShell(null),
  });

  routes.push({
    path: '/',
    // 60 chars. The previous title ran to 84 and was truncated in both Google
    // and Bing (flagged by Bing's Site Scan). The legal name already carries
    // "Florida" and "Yachts" as keywords, so nothing is lost by leading with
    // it — Bing's AI citation report shows Florida-level queries are where
    // this site is cited most.
    title: 'Florida Yachts International | Yacht Sales & Charter in Miami',
    description: 'Florida Yachts International — Miami yacht brokerage with 300+ years of combined experience. Buy, sell, and charter yachts worldwide.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'FYI Yachts',
        url: 'https://fyiyachts.com/',
      },
      // Mirrors the on-page accordion (HomePage renders GENERAL_FAQS).
      faqSchema(GENERAL_FAQS),
    ],
    // The homepage shipped with an empty <main> in the prerendered shell: the
    // React app fills it on mount, but robots.txt deliberately welcomes GPTBot,
    // ClaudeBot and PerplexityBot, none of which run JavaScript. The page those
    // engines fetched to learn what this company is gave them a nav, one
    // sentence and a footer. Every claim below is one the site already makes
    // elsewhere — founding year, the combined-experience figure, the charter
    // floor, crypto settlement — so the static shell and the hydrated page say
    // the same thing.
    bodyHtml:
      paras(
        'Florida Yachts International has brokered yachts out of Miami since 1994. '
        + 'We are a full-service brokerage: we sell yachts, we list them, we charter them, '
        + 'we arrange the financing, and we close the transaction — from centre consoles and '
        + 'sportfish boats to superyachts.\n\n'
        + 'Our office is at 2424 Coral Way, and our consultants bring 300+ years of combined '
        + 'experience to the desk. That matters most in the parts of a deal nobody advertises: '
        + 'pricing a vessel against comparable sales that actually closed, reading a survey '
        + 'honestly, and holding a transaction together between survey and settlement.\n\n'
        + 'More than 130 vessels are listed with us at any given time, and the inventory turns '
        + 'over constantly. If the boat you want is not on the list today, that is normal — tell '
        + 'a consultant what you are looking for and we will go and find it.',
      )
      + `<h2 class="mt-10 text-xl font-light text-yacht-900">Buying a yacht in Florida</h2>`
      + paras(
        'Most buyers start in Miami and end up looking further — Fort Lauderdale, the Keys, the '
        + 'Bahamas, and increasingly the Mediterranean. Search the live inventory by size, builder '
        + 'or type, and every listing carries full specifications, real photography and the '
        + 'consultant who knows the vessel.\n\n'
        + 'A buyer pays no commission: the seller pays it out of the sale proceeds. So there is no '
        + 'cost to having a broker on your side of the table, and no reason not to.',
      )
      + `<h2 class="mt-10 text-xl font-light text-yacht-900">Selling, chartering and financing</h2>`
      + paras(
        'Selling with FYI means an honest valuation before anything is listed, proper photography '
        + 'and marketing, and buyer screening so you are not showing your boat to people who were '
        + 'never going to buy it. A valuation is free and commission is due only on a successful sale.\n\n'
        + 'Chartering is the cheapest research in yachting: a crewed day aboard the model you are '
        + 'considering answers questions no listing photograph can, and FYI charters start at $3,600 '
        + 'inclusive of tax. Many owners also offset the cost of ownership by chartering their own vessel.\n\n'
        + 'You do not need to pay cash. Marine lenders finance new and pre-owned vessels over '
        + '10-to-20-year terms, we run a lease-to-own programme with a defined path to title, and we '
        + 'settle qualified transactions in cryptocurrency.',
      )
      + `<h2 class="mt-10 text-xl font-light text-yacht-900">Where we work</h2>`
      + paras(
        'Coral Gables, Coconut Grove, Miami, Miami Beach, Key Biscayne and Fort Lauderdale are home '
        + 'water. Beyond South Florida we represent buyers and sellers worldwide, and we list vessels '
        + 'lying in the Caribbean, Latin America and the Mediterranean.\n\n'
        + 'Call +1-305-854-6020 or email sales@fyiyachts.com. A consultant responds within one business day.',
      )
      + linkStrip('Start here', [
        ['All yachts for sale', '/yachts-for-sale'],
        ['Yachts for sale in Miami', '/yachts-for-sale-miami'],
        ['Superyachts', '/super-yachts-for-sale'],
        ['Centre consoles', '/center-console-boats-for-sale'],
        ['Sport fishing', '/sport-fishing-yachts-for-sale'],
        ['Sold yachts', '/sold-yachts'],
      ])
      + linkStrip('What we do', [
        ['Sell your yacht', '/sell'],
        ['Charter', '/charter'],
        ['Financing', '/yacht-financing'],
        ['Lease-to-own', '/lease-to-own'],
        ['Closing services', '/yacht-closing-services'],
        ['Meet the team', '/our-team'],
      ])
      // Every builder hub, linked from the strongest page on the site.
      //
      // Until now the home page linked four category hubs and no brand hub at
      // all, so Azimut — our largest book — was reachable by exactly one
      // internal link, from /yachts-for-sale. The brand hubs sit at position
      // 22-37 for their own names (Azimut 24.6, Pershing 25.1, Hatteras 27.0,
      // Princess 26.8) while carrying real inventory, and internal links are
      // the one lever we control directly. Ordered as BRAND_PAGES is, which
      // leads with the premium and large-yacht builders.
      + linkStrip('Yachts by builder', uniqueBrands().map((b) => [`${b.name} yachts for sale`, `/${b.slug}`])),
  });

  for (const c of CATEGORY_PAGES) {
    routes.push({
      path: `/${c.slug}`,
      title: c.title,
      description: c.description,
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.h1, description: c.description, publisher: ORG },
        // Mirrors the on-page accordion (CategoryInventoryPage renders
        // CATEGORY_FAQS[slug] — keep the two in lockstep).
        ...(CATEGORY_FAQS[c.slug]?.length ? [faqSchema(CATEGORY_FAQS[c.slug])] : []),
        crumbs([['Home', '/'], ['Yachts for Sale', '/yachts-for-sale/'], [c.h1, `/${c.slug}/`]]),
      ],
      bodyHtml:
        `${paras(c.intro)}<p class="mt-6"><a class="text-yacht-brand underline" href="/yachts-for-sale">Browse the full live inventory</a> or call +1-305-854-6020 to have a consultant source the right vessel.</p>` +
        linkStrip('Browse other yacht types', CATEGORY_PAGES.filter((o) => o.slug !== c.slug).map((o) => [o.h1, `/${o.slug}/`])) +
        linkStrip('Popular brands', BRAND_PAGES.slice(0, 10).map((b) => [`${b.name} yachts`, `/${b.slug}/`])),
    });
  }
  for (const b of BRAND_PAGES) {
    const d = getBrandDetail(b.name, b.blurb);
    const modelsHtml = d.models.length
      ? `<h2 class="mt-10 text-xl font-light text-yacht-900">${esc(b.name)} model ranges</h2><ul class="mt-4 list-disc pl-5">${d.models
          .map((m) => `<li class="text-[15px] font-light leading-8 text-yacht-900/75">${esc(m.name)}${m.note ? ` — ${esc(m.note)}` : ''}</li>`)
          .join('')}</ul>`
      : '';
    const apartHtml = `<h2 class="mt-10 text-xl font-light text-yacht-900">What sets ${esc(b.name)} apart</h2>${paras(d.apart)}${paras(d.build)}`;
    const faqsHtml = `<h2 class="mt-10 text-xl font-light text-yacht-900">${esc(b.name)} yachts — frequently asked questions</h2>${d.faqs
      .map((f) => `<h3 class="mt-6 text-[15px] font-medium text-yacht-900">${esc(f.q)}</h3><p class="mt-2 text-[14px] font-light leading-7 text-yacht-900/70">${esc(f.a)}</p>`)
      .join('')}`;
    const aliasOf = BRAND_SLUG_ALIASES[b.slug];
    routes.push({
      path: `/${b.slug}`,
      ...(aliasOf ? { canonicalPath: `/${aliasOf}` } : {}),
      title: brandSeoTitle(b),
      description: brandSeoDescription(b, d.tagline),
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${b.name} Yachts for Sale`, description: d.tagline, publisher: ORG },
        { '@context': 'https://schema.org', '@type': 'Brand', name: b.name, description: b.blurb, ...(b.logo ? { logo: b.logo } : {}) },
        faqSchema(d.faqs),
        crumbs([['Home', '/'], ['Yachts for Sale', '/yachts-for-sale/'], [`${b.name} Yachts`, `/${b.slug}/`]]),
      ],
      bodyHtml:
        `${paras(d.intro.join('\n\n'))}${apartHtml}${modelsHtml}${faqsHtml}<p class="mt-8"><a class="text-yacht-brand underline" href="/yachts-for-sale">See the live ${esc(b.name)} inventory</a> or call +1-305-854-6020 — a ${esc(b.name)} specialist responds within one business day.</p>` +
        linkStrip('Explore more builders', relatedBrands(b.slug).map((o) => [`${o.name} yachts`, `/${o.slug}/`])) +
        linkStrip('Browse by yacht type', CATEGORY_PAGES.map((o) => [o.h1, `/${o.slug}/`])),
    });
  }
  for (const c of CONTENT_PAGES) {
    const jsonLd: object[] = [];
    // Pages whose question-mark section headings double as FAQ rich results.
    if (c.slug === 'boat-faq' || c.slug === 'miami-yacht-brokerage') {
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: c.sections
          .filter((s) => s.heading && s.heading.includes('?'))
          .slice(0, 30)
          .map((s) => ({
            '@type': 'Question',
            name: s.heading,
            acceptedAnswer: { '@type': 'Answer', text: s.text.slice(0, 600) },
          })),
      });
    }
    const sections = c.sections.map((sec) =>
      `${sec.heading ? `<h2 class="mt-10 text-xl font-light tracking-wide text-yacht-900">${esc(sec.heading)}</h2>` : ''}${paras(sec.text)}`).join('');
    // The brokerage landing gets the named roster in its shell: broker-intent
    // queries ("yacht brokerage", "yacht brokers florida") sit on page 2 with
    // zero clicks while the consultant pages are the site's best converters —
    // put the people, and the internal links to them, on the page that ranks.
    const roster = c.slug === 'miami-yacht-brokerage'
      ? `<h2 class="mt-10 text-xl font-light tracking-wide text-yacht-900">The brokers</h2>`
        + `<ul class="mt-4 list-disc pl-5">${FYI_TEAM.map((m) => `<li class="text-[15px] font-light leading-8 text-yacht-900/75"><a class="text-yacht-brand underline" href="/consultants/${m.slug}">${esc(m.name)}</a> — ${esc(m.title)}${m.region ? ` · ${esc(m.region)}` : ''}</li>`).join('')}</ul>`
        + linkStrip('Related', [['Our team', '/our-team'], ['Sold yachts', '/sold-yachts'], ['Sell your yacht', '/sell'], ['Yachts for sale', '/yachts-for-sale']])
      : '';
    routes.push({ path: `/${c.slug}`, title: c.title, description: c.description, jsonLd, bodyHtml: `${paras(c.intro)}${sections}${roster}` });
  }

  // Charter + sell carry FAQPage schema mirroring their on-page accordions.
  routes.push({
    path: '/charter',
    title: 'Miami Yacht Charters & Rentals | Day & Term — FYI Yachts',
    description: `Charter or rent a crewed luxury yacht in Miami with FYI Yachts — XTREME (80′ Azimut S8) and the 105′ Azimut, from ${CHARTER_FROM_PRICE}. Fuel, crew, and up to 13 guests included.`,
    // Social/link card only — the page itself opens on the charter video.
    // A shared /charter link should show the boat we actually charter, not a
    // frame of stock-feeling b-roll or a vessel that is no longer in the
    // fleet. The matching 1100/2400/mobile crops sit alongside this one in
    // public/charter/ for whenever a still hero is wanted again.
    image: `${SITE}/charter/hero-105-1600.webp`,
    jsonLd: [faqSchema(CHARTER_FAQS)],
    bodyHtml:
      paras(
        'Experience the luxury yachting lifestyle. FYI Yachts runs crewed day charters aboard a 105-foot Azimut out of Bayshore Landing in Coconut Grove — cruising Miami and Biscayne Bay, stopping at the sandbar, with up to 13 guests aboard. Our international luxury yacht consultants have 300+ years of combined experience in the yachting industry.\n\n' +
        `Every charter includes ${CHARTER_INCLUDES.join(', ').toLowerCase()}. All rates include tax; the captain and crew rate and gratuity (a minimum of 15% is expected) are paid directly to the crew. Captain rates run $300 for 4 hours, $350 for 6 hours, and $400 for 8 hours; mate and stew rates run $200, $225, and $250 respectively. A 4% fee applies to card payments, and additional fuel charges accrue beyond the mapped Miami charter boundary.`,
      ) +
      `<h2 class="mt-10 text-xl font-light text-yacht-900">Available day charter vessels</h2><ul class="mt-4 list-disc pl-5">${CHARTER_FLEET
        .map((v) => `<li class="text-[15px] font-light leading-8 text-yacht-900/75"><a class="text-yacht-brand underline" href="/charter/${v.slug}">${esc(v.name)}</a> — up to ${v.guests} guests, ${v.rates.length ? `from ${esc(v.rates[0].price)} for ${esc(v.rates[0].hours)}` : 'rates on request'}. ${esc(v.blurb)}</li>`)
        .join('')}</ul>` +
      // Heading only when a term vessel is actually published — an empty
      // "Term charter" heading is a dead section in the prerendered shell.
      (TERM_CHARTER.length
        ? `<h2 class="mt-10 text-xl font-light text-yacht-900">Term charter</h2>${TERM_CHARTER
            .map((v) => `<p class="mt-4 text-[15px] font-light leading-8 text-yacht-900/75"><a class="text-yacht-brand underline" href="/charter/${v.slug}">${esc(v.name)}</a> — ${v.terms.map((t) => `${esc(t.region)}: ${esc(t.weekly)} weekly, ${esc(t.daily)} daily`).join('; ')}.</p>`)
            .join('')}`
        : '') +
      `<p class="mt-8">Call the charter desk on +1-${CHARTER_PHONE_DISPLAY} or email ${CHARTER_EMAIL} to check availability.</p>`,
  });
  // A real page per charter vessel (what FYI was promised).
  for (const v of ALL_CHARTER_VESSELS) {
    const dayRates = isTermVessel(v) ? [] : v.rates;
    const rateLine = isTermVessel(v)
      ? v.terms.map((t) => `${t.region}: ${t.weekly} weekly, ${t.daily} daily`).join('; ')
      : dayRates.length
        ? dayRates.map((r) => `${r.hours} ${r.price}${r.note ? ` ${r.note}` : ''}`).join(' · ')
        : 'Rates on request';
    const priceSummary = isTermVessel(v)
      ? rateLine
      : dayRates.length
        ? `From ${dayRates[0].price} for ${dayRates[0].hours}`
        : 'Rates on request';
    routes.push({
      path: `/charter/${v.slug}`,
      title: `${v.name} Charter in Miami | FYI Yachts`,
      description: `Charter the ${v.name} (${v.builder}) in Miami with FYI Yachts — up to ${v.guests} guests, captain and crew, fuel included. ${priceSummary}.`,
      image: v.image,
      jsonLd: [
        // Product markup only when the vessel has a published day rate: an
        // Offer without a price (rates-on-request and the term-charter
        // vessels) fails Google's Product validation and lands in Search
        // Console as an invalid product snippet instead of a rich result.
        ...(dayRates.length ? [{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: `${v.name} yacht charter`,
          description: v.blurb,
          image: v.image,
          brand: { '@type': 'Brand', name: v.builder },
          offers: {
            '@type': 'Offer',
            availability: 'https://schema.org/InStock',
            priceCurrency: 'USD',
            price: dayRates[0].price.replace(/[^0-9.]/g, ''),
            seller: ORG,
          },
        }] : []),
        crumbs([['Home', '/'], ['Charter', '/charter/'], [v.name, `/charter/${v.slug}/`]]),
      ],
      bodyHtml:
        paras(`${v.blurb}\n\nThe ${v.name} (${v.builder}, ${v.lengthFt}ft LOA) charters out of Miami with a captain and crew for up to ${v.guests} guests. ${rateLine}.`) +
        `<h2 class="mt-10 text-xl font-light text-yacht-900">What’s included</h2><ul class="mt-4 list-disc pl-5">${CHARTER_INCLUDES
          .map((i) => `<li class="text-[15px] font-light leading-8 text-yacht-900/75">${esc(i)}</li>`)
          .join('')}</ul>` +
        `<p class="mt-8"><a class="text-yacht-brand underline" href="/charter">See the whole charter fleet</a> or call +1-${CHARTER_PHONE_DISPLAY}.</p>`,
    });
  }
  routes.push({
    path: '/sell',
    // GSC (May–Aug 2026): 5,961 impressions → 1 click. The searchers asking
    // "how do i sell my yacht" / "sell my yacht" got a brokerage pitch and a
    // schema-only FAQ. Title leads with the searcher's own words, the body
    // answers the how/cost/duration questions visibly, and the FAQ list is
    // baked into the shell like the brand pages and /lease-to-own.
    title: 'Sell My Yacht — Free Valuation, No Upfront Fees | FYI Yachts',
    description: 'How to sell your yacht: free valuation from Miami comps, professional marketing to a worldwide buyer network, in-house closing — no fees until it sells. FYI Yachts, Miami since 1994.',
    jsonLd: [faqSchema(SELL_FAQS)],
    bodyHtml:
      paras(
        'Selling a yacht comes down to three things: pricing her to the comps, putting her in front of real buyers, and a clean closing. FYI has done all three from Miami since 1994 — and you pay nothing until the boat sells.\n\n' +
        'How it works: (1) Free valuation — a market read priced from three decades of Miami closings and live comparable-sale data, so you list at a number that sells without leaving money on the table. (2) Preparation and presentation — cinematic photography, video, and editorial copy. (3) Global marketing — syndication across the major brokerage networks, FYI channels reaching 50,000+ people a day, and direct outreach to a screened worldwide buyer list. (4) Negotiation and closing — buyers are qualified before they step aboard, then in-house escrow, documentation, titling, and registration take the paperwork off your plate.\n\n' +
        'Every FYI consultant is a licensed broker with a public sold history — pick one who knows your segment, or call the office and we will match you.',
      ) +
      `<p class="mt-6"><a class="text-yacht-brand underline" href="/sold-yachts">See a selection of our sold boats</a>, <a class="text-yacht-brand underline" href="/our-team">meet the consultants</a>, or call +1-305-854-6020 for a free valuation.</p>` +
      `<h2 class="mt-10 text-xl font-light text-yacht-900">Selling your yacht — frequently asked questions</h2>` +
      SELL_FAQS.map((f) => `<h3 class="mt-6 text-[15px] font-medium text-yacht-900">${esc(f.q)}</h3><p class="mt-2 text-[14px] font-light leading-7 text-yacht-900/70">${esc(f.a)}</p>`).join('') +
      linkStrip('Related', [['Sold yachts', '/sold-yachts'], ['Our team', '/our-team'], ['Closing services', '/yacht-closing-services'], ['Contact us', '/contact']]),
  });

  // These five shipped with a title and description but NO body, so their
  // prerendered <main> was empty — the React app fills it on mount, but the AI
  // crawlers robots.txt welcomes (GPTBot, ClaudeBot, PerplexityBot) do not run
  // JavaScript and saw nothing. Copy below states only what the site already
  // claims elsewhere.
  //
  // /our-team and /consultants also shared one description word for word, which
  // is a duplicate-content signal between two of our own pages. They now
  // describe what each actually does.
  const services: [string, string, string, string][] = [
    ['/yacht-charter', 'Yacht Charter Miami | FYI Yachts',
      'Crewed luxury yacht charters out of Miami — captain, crew, fuel, and provisioning arranged by FYI Yachts.',
      paras(
        'FYI arranges crewed charters out of Miami — captain, crew, fuel and provisioning handled, '
        + 'so the only decision left to you is where to go. Charters start at $3,600 inclusive of tax.\n\n'
        + 'A charter is also the cheapest research in yachting. A day aboard the model you are thinking '
        + 'of buying answers questions no listing photograph can, and owners regularly offset the cost '
        + 'of ownership by chartering their own vessel through us.',
      ) + linkStrip('Related', [['Charter fleet and rates', '/charter'], ['Yachts for sale', '/yachts-for-sale'], ['Contact the charter desk', '/contact']])],
    // /yacht-financing and /lease-to-own get dedicated entries below (FAQ schema).
    ['/our-team', 'Our Team | FYI Yachts',
      "Meet the consultants at Florida Yachts International — licensed Miami yacht brokers with 300+ years of combined experience, each with live listings and a sold history.",
      paras(
        'Everyone at FYI is a licensed yacht consultant, and between them they bring 300+ years of '
        + 'experience to the desk. Each has a profile here showing their live listings and the boats '
        + 'they have actually sold — not a biography, a track record.\n\n'
        + 'Brokerage is a relationship business, and the consultant matters as much as the brokerage. '
        + 'Pick the one who knows your segment, or call the office and we will introduce you.',
      ) + linkStrip('Related', [['Individual consultants', '/consultants'], ['Client results', '/case-studies'], ['Contact us', '/contact']])],
    ['/consultants', 'Yacht Consultants in Miami | FYI Yachts',
      'Individual consultant profiles at Florida Yachts International — each broker\'s live listings, sold vessels, and the segments they specialise in.',
      paras(
        'Every FYI consultant has their own page: the yachts they have listed right now, the vessels '
        + 'they have sold, and the segments they specialise in — sportfish, centre consoles, motor '
        + 'yachts, superyachts.\n\n'
        + 'If you already know what you are looking for, going straight to the consultant who works '
        + 'that segment is usually faster than starting with the switchboard.',
      ) + linkStrip('Related', [['The team overview', '/our-team'], ['Client results', '/case-studies'], ['Yachts for sale', '/yachts-for-sale']])],
    ['/sold-yachts', 'Sold Yachts | FYI Yachts',
      'A selection of yachts sold by Florida Yachts International — three decades of closings backed by a worldwide buyer network.',
      paras(
        'These are boats FYI has actually closed. We publish them because sold data is the only honest '
        + 'basis for pricing a vessel: asking prices tell you what sellers hope for, closings tell you '
        + 'what the market paid.\n\n'
        + 'If you are thinking of selling, the comparable sales here are where a valuation starts. '
        + 'A valuation is free and commission is due only on a successful sale.',
      ) + linkStrip('Related', [['Sell your yacht', '/sell'], ['Client results', '/case-studies'], ['Current inventory', '/yachts-for-sale']])],
    ['/fyi-news', 'FYI News | FYI Yachts',
      'News from Florida Yachts International — new boat listings, boat shows and events, sold yachts, industry news, and yacht tips.',
      paras(
        'New listings as they arrive, closings as they happen, boat shows and events, and practical '
        + 'guidance on buying, owning and selling in South Florida.\n\n'
        + 'The archive runs back over a decade, which makes it a reasonable record of how the Miami '
        + 'market has actually moved rather than how anyone said it would.',
      ) + linkStrip('Related', [['Yachts for sale', '/yachts-for-sale'], ['Sold yachts', '/sold-yachts'], ['Meet the team', '/our-team']])],
  ];
  for (const [path, title, description, bodyHtml] of services) routes.push({ path, title, description, bodyHtml });

  // About + contact carry FAQPage schema mirroring their on-page accordions
  // (AboutPage renders ABOUT_FAQS, ContactPage renders CONTACT_FAQS — keep in
  // lockstep) and a breadcrumb matching the visible trail in PageHero.
  routes.push({
    path: '/about-us',
    title: 'About Us | FYI Yachts',
    description: 'Florida Yachts International — a Miami brokerage since 1994 with 300+ years of combined consultant experience.',
    jsonLd: [faqSchema(ABOUT_FAQS), crumbs([['Home', '/'], ['About Us', '/about-us/']])],
    bodyHtml: paras(
      'Florida Yachts International has been brokering yachts out of Miami since 1994. Three decades '
      + 'in one market is the whole point: we know which brokers close, which yards stand behind their '
      + 'work, which surveyors are worth listening to, and what vessels in South Florida actually sell for.\n\n'
      + 'The office is at 2424 Coral Way, Miami. Our consultants bring 300+ years of combined experience '
      + 'and every one of them is licensed. We sell and list yachts, run charters, arrange financing and '
      + 'lease-to-own, and handle closing services — the whole transaction under one roof.\n\n'
      + 'We work Coral Gables, Coconut Grove, Miami, Miami Beach, Key Biscayne and Fort Lauderdale as home '
      + 'water, and represent buyers and sellers worldwide.',
    ) + linkStrip('Related', [['Meet the team', '/our-team'], ['Client results', '/case-studies'], ['Sold yachts', '/sold-yachts'], ['Contact us', '/contact']]),
  });
  routes.push({
    path: '/contact',
    title: 'Contact | FYI Yachts',
    description: 'Contact Florida Yachts International at 2424 Coral Way, Miami — call 305-854-6020 or send an inquiry. A broker responds within one business day.',
    jsonLd: [faqSchema(CONTACT_FAQS), crumbs([['Home', '/'], ['Contact', '/contact/']])],
    bodyHtml: paras(
      'Florida Yachts International, 2424 Coral Way, Miami, FL 33145. Call +1-305-854-6020 or email '
      + 'sales@fyiyachts.com. A consultant responds within one business day, and if it is urgent, call — '
      + 'we answer the phone.\n\n'
      + 'Buying, selling, chartering or financing, the first conversation costs nothing and there is no '
      + 'obligation attached to it. A valuation is free. Buyers pay no commission at all — the seller pays '
      + 'it out of the sale proceeds.\n\n'
      + 'If you already know which consultant you want, their profiles list direct contact details.',
    ) + linkStrip('Related', [['Meet the team', '/our-team'], ['Yachts for sale', '/yachts-for-sale'], ['Sell your yacht', '/sell'], ['Charter', '/charter']]),
  });

  // Client results: the narrative proof pages. Every fact on them is sourced
  // from FYI's own published closing announcements — see caseStudyData.ts.
  routes.push({
    path: '/case-studies',
    title: 'Client Results & Case Studies | FYI Yachts',
    description: 'Real closings from Florida Yachts International — sportfish, motor yachts, and high-performance boats sold in Miami, with the consultants who represented each side.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Client Results & Case Studies',
        description: 'Published closings brokered by Florida Yachts International.',
        publisher: ORG,
      },
      crumbs([['Home', '/'], ['Client Results', '/case-studies/']]),
    ],
    bodyHtml:
      paras('Every result below is a closing FYI published at the time, with the consultants who represented each side named. Figures shown are the last asking price at the time of sale — the number the vessel was marketed at, not the confidential settlement figure.') +
      `<ul class="mt-6 list-disc pl-5">${CASE_STUDIES.map((c) => `<li class="text-[15px] font-light leading-8 text-yacht-900/75"><a class="text-yacht-brand underline" href="/case-studies/${c.slug}">${esc(c.year.toString())} ${esc(c.builder)} ${esc(c.vessel)}</a> — ${esc(c.headline)}.</li>`).join('')}</ul>` +
      `<p class="mt-8"><a class="text-yacht-brand underline" href="/sold-yachts">See a selection of our sold boats</a> or call +1-305-854-6020 for a free valuation.</p>`,
  });
  for (const c of CASE_STUDIES) {
    // caseStudyData's `vessel` is usually the boat's NAME alone ("KNOT NORMAL",
    // "ZOOOM"), but one entry carries the whole "<year> <builder> <model>"
    // string. Composing blindly produced the title "2008 Riviera 2008 Riviera
    // 51 Enclosed Bridge — Sold by FYI Yachts". Strip the prefix when it is
    // already there rather than editing the data, so either shape stays valid.
    const bareVessel = c.vessel.replace(
      new RegExp(`^${c.year}\\s+${c.builder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'),
      '',
    );
    const vessel = `${c.year} ${c.builder} ${bareVessel}`;
    routes.push({
      path: `/case-studies/${c.slug}`,
      title: `${vessel} — Sold by FYI Yachts | Client Results`,
      description: `${c.headline}. ${c.year} ${c.builder} in ${c.location}, brokered by ${c.represented.map((r) => r.name).join(' and ')} of Florida Yachts International.`,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: c.headline,
          about: vessel,
          datePublished: c.sourceDate,
          articleSection: c.segment,
          author: ORG,
          publisher: ORG,
          mainEntityOfPage: `https://fyiyachts.com/case-studies/${c.slug}/`,
        },
        crumbs([['Home', '/'], ['Client Results', '/case-studies/'], [vessel, `/case-studies/${c.slug}/`]]),
      ],
      bodyHtml:
        paras(c.body.join('\n\n')) +
        `<h2 class="mt-10 text-xl font-light text-yacht-900">Vessel</h2><ul class="mt-4 list-disc pl-5">${c.specs.map(([k, v]) => `<li class="text-[15px] font-light leading-8 text-yacht-900/75">${esc(k)}: ${esc(v)}</li>`).join('')}</ul>` +
        `<h2 class="mt-10 text-xl font-light text-yacht-900">Represented by</h2><ul class="mt-4 list-disc pl-5">${c.represented.map((r) => `<li class="text-[15px] font-light leading-8 text-yacht-900/75"><a class="text-yacht-brand underline" href="/consultants/${r.slug}">${esc(r.name)}</a> — ${esc(r.side)}.</li>`).join('')}</ul>` +
        `<p class="mt-8">Source: <a class="text-yacht-brand underline" href="/${c.source}">FYI Yachts closing announcement</a>, ${esc(c.sourceDate)}. Figures shown are the last asking price at the time of sale, as published — not the final settlement figure, which is confidential.</p>`,
    });
  }

  // Financing page carries FAQ rich-result markup mirroring its on-page FAQs.
  routes.push({
    path: '/yacht-financing',
    title: 'Yacht Financing | FYI Yachts',
    description: 'Yacht financing made easy — marine lending structured around your purchase, 10-to-20-year terms, insurance guidance, lease-to-own and cryptocurrency options from FYI Yachts in Miami.',
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        ['Is boat financing harder to get than a car loan?', 'Yes — boat and yacht financing is harder to get than typical vehicle financing. Loans come in all shapes and sizes, and a lot depends on the boat and your creditworthiness. Working with companies that specialize in marine lending means you see the options that fit before applying.'],
        ['What loan terms are typical for a yacht?', 'Typical structures run 10-to-20-year terms with 10–20% down, for both new and pre-owned vessels. Boat and yacht loans are specifically designed for this type of asset and include special coverages and provisions.'],
        ['Does the type of boat change the financing?', 'It does — obtaining a loan for a motorboat is different from obtaining one for a sailboat, and vessels used commercially (including charter) are treated differently from pleasure craft.'],
        ['Do I need insurance before I can close?', 'Lenders require coverage to be bound at closing. Insurance requirements vary with where you register and operate the yacht, and whether you use it privately or for charter — FYI helps you locate the right policy and binds it in step with the loan.'],
        ['Can FYI arrange financing and the purchase together?', 'Yes — survey, insurance, documentation, and lending are coordinated by the same team handling your purchase, through a well-vetted network of marine-finance specialists. Call 305-854-6020 and a FYI finance specialist will walk you through it.'],
      ].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    }],
    bodyHtml: paras(
      'You do not need to pay cash for a yacht. Marine lenders finance new and pre-owned vessels, '
      + 'typically over 10-to-20-year terms with 10–20% down — but boat lending is not car lending, and '
      + 'the terms you are offered depend as much on the vessel as on your credit.\n\n'
      + 'A motorboat is underwritten differently from a sailboat, and a yacht placed in charter is treated '
      + 'differently again from a pleasure craft. Getting that structure right before you apply is most of '
      + 'the work, and it is why we use a vetted network of marine-finance specialists rather than sending '
      + 'you to a general lender.\n\n'
      + 'Lenders require insurance to be bound at closing, so we run survey, insurance, documentation and '
      + 'lending in step with each other and with the purchase itself. If a conventional loan is not the '
      + 'right fit, our lease-to-own programme offers a defined path to title, and we settle qualified '
      + 'transactions in cryptocurrency.\n\n'
      + 'Call +1-305-854-6020 and a finance specialist will walk you through the options.',
    ) + linkStrip('Related', [['Lease-to-own', '/lease-to-own'], ['Yachts for sale', '/yachts-for-sale'], ['Closing services', '/yacht-closing-services'], ['Contact us', '/contact']]),
  });

  // Lease-to-own is a differentiator page: FAQ rich results mirror the
  // on-page accordion (LeaseToOwnPage renders LEASE_FAQS — keep in lockstep).
  routes.push({
    path: '/lease-to-own',
    title: 'Lease-to-Own Yachts & Boats in Miami | FYI Yachts',
    description: 'Lease-to-own a yacht with FYI in Miami: start on the water now and navigate toward ownership, with flexible terms and cryptocurrency settlement accepted.',
    jsonLd: [
      faqSchema(LEASE_FAQS),
      crumbs([['Home', '/'], ['Yacht Financing', '/yacht-financing/'], ['Lease-to-Own', '/lease-to-own/']]),
    ],
    bodyHtml:
      paras(
        'Own the experience before you own the hull. FYI’s lease-to-own program pairs flexible terms with modern settlement — including cryptocurrency — so you step aboard sooner.\n\nStructured lease terms with a defined path to title, payments that build toward ownership while you’re already on the water, and an early close whenever you’re ready.'
      ) +
      `<p class="mt-6"><a class="text-yacht-brand underline" href="/yachts-for-sale">Browse yachts to lease-to-own</a> or <a class="text-yacht-brand underline" href="/yacht-financing">compare with conventional financing</a> — or call +1-305-854-6020.</p>` +
      // The FAQ answers were schema-only here (the React accordion renders
      // them client-side), so crawlers that skip JS never saw them — including
      // the sailboat scope answer for "rent to own sailboats", which ranks
      // this page ~#4. Bake them into the shell like the brand pages do.
      `<h2 class="mt-10 text-xl font-light text-yacht-900">Lease-to-own — frequently asked questions</h2>` +
      LEASE_FAQS.map((f) => `<h3 class="mt-6 text-[15px] font-medium text-yacht-900">${esc(f.q)}</h3><p class="mt-2 text-[14px] font-light leading-7 text-yacht-900/70">${esc(f.a)}</p>`).join(''),
  });

  const esPages: [string, string, string][] = [
    ['/es', 'FYI Yachts — Compra, Venta y Chárter de Yates en Miami', 'Florida Yachts International — corretaje de yates en Miami desde 1994. Compra, venta, chárter y financiamiento de yates, con consultores que hablan español.'],
    ['/es/vender', 'Venda su Yate en Miami | FYI Yachts', 'Venda su yate con Florida Yachts International — marketing a medida, red mundial de compradores y cierre completo gestionado por FYI.'],
    ['/es/charter', 'Chárter de Yates en Miami | FYI Yachts', 'Chárters de lujo con tripulación desde Miami — organizados por Florida Yachts International. Atención en español.'],
    ['/es/inventario', 'Yates en Venta | Inventario Mundial | FYI Yachts', 'Explore el inventario mundial de Florida Yachts International — con consultores que hablan español.'],
    ['/es/financiamiento', 'Financiamiento de Yates | FYI Yachts', 'Financiamiento marino con Florida Yachts International — préstamos, seguros y titulación, explicados en español.'],
    ['/es/equipo', 'Nuestro Equipo | FYI Yachts', 'Los consultores de Florida Yachts International — 300+ años de experiencia combinada, con atención en español.'],
    ['/es/contacto', 'Contacto | FYI Yachts', 'Contacte a Florida Yachts International en Miami — teléfono, WhatsApp y formulario, en español.'],
  ];
  // Spanish body copy.
  //
  // NOTE: the /es tier is currently switched OFF — vercel.json 301s all seven
  // Spanish paths to their English equivalents, so these pages are built here
  // but never served. The copy is kept deliberately: re-enabling Spanish is
  // then a matter of deleting seven redirect entries, with the content already
  // in place. prerender.mjs reads those redirects and keeps these paths out of
  // the sitemap while they stay off.
  //
  // Written in Spanish rather than translated mechanically, since the point is
  // to be readable by Spanish-speaking buyers and citable by AI engines
  // answering in Spanish.
  // Spanish body copy for the prerendered shell.
  //
  // Sourced from components/es/EsPages.tsx — the same h1 and intro the React
  // page renders — NOT a second translation. An earlier pass here invented a
  // parallel Spanish text, which was both redundant and worse than the native
  // copy already in the component. Keeping one source means the static shell
  // and the hydrated page say the same thing, which is what makes this dynamic
  // rendering rather than cloaking; if the component's copy changes, this is
  // the place to follow it.
  // Each entry's real h1 is recorded so the prerendered shell can use it as the
  // page heading instead of deriving "FYI Yachts" from the title.
  const esH1: Record<string, string> = {};
  const esHero = (path: string, h1: string, intro: string, links: [string, string][]): string => {
    esH1[path] = h1;
    return `${paras(intro)}${linkStrip('Ver también', links)}`;
  };

  const esBody: Record<string, string> = {
    '/es': esHero(
      '/es',
      'Su brokerage de yates en Miami',
      'Florida Yachts International — más de 300 años de experiencia combinada en compra, venta y chárter de yates. Atención completa en español.\n\n'
      + 'Corretaje de yates desde Miami desde 1994: vendemos, listamos, organizamos chárters, gestionamos el financiamiento y cerramos la operación. '
      + 'Nuestra oficina está en 2424 Coral Way, y varios de nuestros consultores le atienden de principio a fin en español.',
      [['Yates en venta', '/es/inventario'], ['Vender su yate', '/es/vender'], ['Chárter', '/es/charter'], ['Contacto', '/es/contacto']],
    ),
    '/es/vender': esHero(
      '/es/vender',
      'Venda su yate con quien más vende en Miami',
      'Tres décadas de cierres, una red mundial de compradores y consultores que negocian por oficio — con todo el proceso disponible en español.\n\n'
      + 'La valoración es gratuita y la comisión solo se paga si la venta se concreta.',
      [['Yates vendidos', '/sold-yachts'], ['Nuestro equipo', '/es/equipo'], ['Contacto', '/es/contacto']],
    ),
    '/es/charter': esHero(
      '/es/charter',
      'Miami desde el agua',
      'Chárters con tripulación de 72 a 105 pies desde Miami — un día en Biscayne Bay, un fin de semana en las Bahamas o una temporada completa, todo organizado por FYI.\n\n'
      + 'Capitán, tripulación, combustible y aprovisionamiento incluidos. Los chárters comienzan en $3,600 con impuestos incluidos.',
      [['Flota y tarifas', '/charter'], ['Yates en venta', '/es/inventario'], ['Contacto', '/es/contacto']],
    ),
    '/es/inventario': esHero(
      '/es/inventario',
      'Yates en venta',
      'Alrededor de 140 embarcaciones en vivo — desde center consoles hasta superyates — y acceso a miles más a través de nuestra red mundial. '
      + 'Los datos de cada yate se muestran tal como los publica el astillero o el broker.\n\n'
      + 'El comprador no paga comisión: la paga el vendedor con el producto de la venta.',
      [['Inventario completo', '/yachts-for-sale'], ['Financiamiento', '/es/financiamiento'], ['Nuestro equipo', '/es/equipo']],
    ),
    '/es/financiamiento': esHero(
      '/es/financiamiento',
      'Financie su yate con expertos',
      'Un préstamo marino no es una hipoteca: el tipo de embarcación, su uso (privado o chárter) y dónde se registre cambian las condiciones. Le explicamos todo en su idioma.\n\n'
      + 'Los plazos habituales van de 10 a 20 años con un 10–20% de entrada. También ofrecemos arrendamiento con opción a compra y aceptamos criptomonedas en operaciones calificadas.',
      [['Yates en venta', '/es/inventario'], ['Arrendamiento con opción a compra', '/lease-to-own'], ['Contacto', '/es/contacto']],
    ),
    '/es/equipo': esHero(
      '/es/equipo',
      'Consultores que hablan su idioma',
      'Trescientos años de experiencia combinada bajo un mismo techo en Miami. Los consultores marcados «Español» le atienden de principio a fin en español.\n\n'
      + 'Cada consultor tiene su perfil con las embarcaciones que tiene listadas y las que ha vendido — no una biografía, un historial.',
      [['Perfiles de consultores', '/consultants'], ['Resultados de clientes', '/case-studies'], ['Contacto', '/es/contacto']],
    ),
    '/es/contacto': esHero(
      '/es/contacto',
      'Hablemos de su próximo yate',
      'Llámenos, escríbanos por WhatsApp o deje sus datos — un consultor le responde dentro de un día hábil, en español o inglés.\n\n'
      + 'Florida Yachts International, 2424 Coral Way, Miami, FL 33145. Teléfono +1-305-854-6020, correo sales@fyiyachts.com.',
      [['Yates en venta', '/es/inventario'], ['Vender su yate', '/es/vender'], ['Chárter', '/es/charter']],
    ),
  };
  for (const [path, title, description] of esPages) routes.push({ path, title, description, bodyHtml: esBody[path], h1: esH1[path] });

  for (const m of FYI_TEAM) {
    // Local /team/*.webp photos need an absolute URL for OG/schema.
    const photo = m.photo && !m.photo.startsWith('http') ? `https://fyiyachts.com${m.photo}` : m.photo;
    routes.push({
      path: `/consultants/${m.slug}`,
      title: `${m.name} — ${m.title} | FYI Yachts`,
      description: `${m.name}, ${m.title.toLowerCase()} at Florida Yachts International${m.region ? ` (${m.region})` : ''}. Live listings and sold history.`,
      image: photo,
      bodyHtml: `<p class="mt-2 text-[15px] font-light text-yacht-900/70">${esc(m.title)}${m.region ? ` \u00b7 ${esc(m.region)}` : ''} \u00b7 Languages: ${m.languages.join(', ')}</p>${FYI_BIOS[m.slug] ? paras(FYI_BIOS[m.slug]) : `<p class=\"mt-4 text-[15px] font-light leading-8 text-yacht-900/75\">${esc(m.name)} is a licensed yacht consultant with Florida Yachts International in Miami. Every consultant's current listings and sold history are shown live on this page. Call +1-305-854-6020 to work with ${esc(m.name.split(' ')[0])}.</p>`}`,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: m.name,
        jobTitle: m.title,
        worksFor: ORG,
        ...(photo ? { image: photo } : {}),
        knowsLanguage: m.languages,
        url: `https://fyiyachts.com/consultants/${m.slug}/`,
      }],
    });
  }

  for (const p of newsIndex) {
    routes.push({
      path: `/${p.slug}`,
      title: `${p.title} | FYI Yachts`,
      description: p.excerpt,
      image: p.image || undefined,
      isNews: true,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: p.title,
        datePublished: p.date,
        articleSection: p.category,
        ...(p.image ? { image: p.image } : {}),
        author: ORG,
        publisher: ORG,
        mainEntityOfPage: `https://fyiyachts.com/${p.slug}/`,
      }],
    });
  }

  // One route per URL — first definition wins.
  //
  // The news archive was migrated at the exact WordPress slugs, and one of
  // those posts (`center-console-boats-for-sale`, 2022) collides with the
  // category page of the same name. Emitting both was silently harmful twice
  // over: the sitemap listed the URL twice, and prerender wrote the file
  // twice — the news entry, which is built later, overwriting the category
  // page. A page targeting "center console boats for sale" was serving the
  // blog post's meta description ("Boats are a great way to enjoy the
  // water...") to Google.
  //
  // Commercial pages are all defined above the news loop, so first-wins keeps
  // the page that should own the URL. The warning makes any future collision
  // visible in the build log instead of silently reshaping a page.
  // Attach hreflang to both sides of every EN/ES pair.
  for (const r of routes) {
    const alts = ALTERNATES.get(r.path);
    if (alts) r.alternates = alts;
  }

  const seen = new Set<string>();
  const unique: SeoRoute[] = [];
  for (const r of routes) {
    if (seen.has(r.path)) {
      console.warn(`[seoData] duplicate route ${r.path} — keeping the first definition, dropping "${r.title}"`);
      continue;
    }
    seen.add(r.path);
    unique.push(r);
  }

  // Site-wide LocalBusiness — prepended to every route rather than emitted on
  // the homepage alone, so the pages that actually rank carry the NAP, geo,
  // and sameAs signals too. The shared @id keeps it one entity.
  for (const r of unique) r.jsonLd = [LOCAL_BUSINESS, ...(r.jsonLd ?? [])];

  return unique;
}

/* ------------------------------------------------- build-time hub inventory */

// The brand/category hub pages are the site's biggest search surface — 77
// pages drawing ~175k impressions a quarter — and until 2026-09 their
// prerendered HTML contained zero listings: the grid is fetched client-side
// after mount, so every crawler that skips JS (and Google, until its deferred
// render) indexed "Browse the live inventory below" with nothing below it.
// Result: 0.20% CTR against a ~2% norm for their positions.
//
// These two functions close that gap at build time: fetch the same two feeds
// the client renders from, and bake the first screen of matching listings +
// ItemList schema into each hub route. React replaces the grid on mount with
// the identical live data — dynamic rendering, not cloaking.

const BOATS_UPSTREAM = 'https://api.boats.com/inventory/search';
const usdFmt = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/**
 * Fetch both inventory tiers for the prerender. Every failure degrades to an
 * empty array — a feed outage must yield the pre-2026-09 build, never a broken
 * one (same posture as the journal feed fetch in prerender.mjs).
 */
export async function fetchBuildInventory(): Promise<{ fyi: PublicBoat[]; worldwide: PublicBoat[] }> {
  const key = process.env.BOATS_API_KEY || '';
  const fyi = await (async () => {
    try {
      const url = new URL(BOATS_UPSTREAM);
      url.searchParams.set('key', key);
      url.searchParams.set('salesstatus', 'active');
      url.searchParams.set('rows', '400');
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: Record<string, unknown>[] };
      return (data.results ?? []).map(normalizePublicBoat).filter((b): b is PublicBoat => b !== null);
    } catch { return []; }
  })();
  // FYI's own book only; the worldwide tier is not baked at build time.
  const worldwide: PublicBoat[] = [];
  return { fyi, worldwide };
}

const cardLabel = (b: PublicBoat): string =>
  [b.year, b.make, b.model].filter(Boolean).join(' ').trim() || b.title;

const cardHref = (b: PublicBoat): string | undefined =>
  b.source === 'fyi' || (!b.externalUrl && !b.source) || isFyiCompany(b.company)
    ? `/listing/${b.id}`
    // Only same-site detail pages: a worldwide row without a slug has nowhere
    // crawlable to go, so it is dropped rather than linked off-site.
    : b.externalUrl && b.externalUrl.startsWith('/') ? b.externalUrl : undefined;

function inventoryHtml(heading: string, boats: { b: PublicBoat; href: string }[], total: number): string {
  const priced = boats.map(({ b }) => b.priceUsd).filter((p): p is number => !!p && p > 0);
  const range = priced.length >= 2 ? ` · ${usdFmt(Math.min(...priced))} – ${usdFmt(Math.max(...priced))}` : '';
  const cards = boats.map(({ b, href }) => {
    const meta = [b.lengthFt ? `${Math.round(b.lengthFt)} ft` : '', [b.city, b.state || b.country].filter(Boolean).join(', ')]
      .filter(Boolean).join(' · ');
    const img = b.image
      ? `<img src="${esc(resizeBG(b.image, 400, 267))}" alt="${esc(cardLabel(b))}" width="400" height="267" loading="lazy" decoding="async" class="aspect-[3/2] w-full rounded object-cover" />`
      : '';
    return `<li class="rounded border border-yacht-900/10 bg-white p-3"><a href="${esc(href)}" class="block">${img}<p class="mt-3 text-[14px] font-medium text-yacht-900">${esc(cardLabel(b))}</p><p class="mt-1 text-[13px] font-light text-yacht-900/60">${esc(meta)}</p><p class="mt-1 text-[14px] font-light text-yacht-900">${esc(fmtBoatPrice(b) === 'Price on request' ? 'Price on Request' : fmtBoatPrice(b))}</p></a></li>`;
  }).join('');
  return `<h2 class="mt-2 text-xl font-light text-yacht-900">${esc(heading)}</h2>
<p class="mt-2 text-[14px] font-light text-yacht-900/60">${total} listing${total === 1 ? '' : 's'} live now${range}. Updated ${new Date().toISOString().slice(0, 10)}.</p>
<ul class="mt-6 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 md:grid-cols-3">${cards}</ul>`;
}

const itemListSchema = (name: string, boats: { b: PublicBoat; href: string }[], total: number): object => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  numberOfItems: total,
  itemListElement: boats.map(({ b, href }, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: cardLabel(b),
    url: `${SITE}${href}`,
  })),
});

/**
 * Compact money for a search snippet: "$199K", "$1.2M". The on-page copy uses
 * usdFmt's full form, but a description has 155 characters to spend and a
 * price range is the single most clicked-on fact a brokerage listing page can
 * put in front of a buyer — so it gets the short spelling.
 */
const usdShort = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, '')}M`
  : n >= 1_000 ? `$${Math.round(n / 1000)}K`
  : `$${n}`;

/** Inclusive range, collapsed when both ends are the same value. */
const range = (lo: number, hi: number, fmt: (n: number) => string): string =>
  lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;

/**
 * Facts a buyer scanning a results page actually wants: how many boats, how
 * big, how much. Hub pages carry 48% of the site's impressions at a 0.17% CTR
 * (GSC, Sep 2026) — an order of magnitude below a normal inventory page — and
 * every competing result in those SERPs is an aggregator quoting counts and
 * prices while our snippet said only "brokered from Miami by FYI Yachts".
 *
 * Returns '' unless the matched set is big enough to be worth a claim, so a
 * hub with two boats keeps its editorial description rather than advertising
 * how little it has. Every number is read from the same feed rows baked into
 * the page below, so the snippet cannot promise inventory the page lacks.
 */
function hubFacts(label: string, matches: PublicBoat[]): string {
  if (matches.length < HUB_FACTS_MIN) return '';
  const prices = matches.map((b) => b.priceUsd).filter((p): p is number => !!p && p > 0);
  const lengths = matches.map((b) => b.lengthFt).filter((n): n is number => !!n && n > 0);
  // A size-banded category ("60 to 90 ft yachts") already names its range. Left
  // in the label it would sit straight after the count — "112 60 to 90 ft" —
  // and a second, measured range beside it reads as a contradiction whenever
  // the two disagree by a foot. So the band is lifted out and used as the size.
  const band = label.match(/\d+\s*(?:to|[–-])\s*\d+\s*(?:ft|foot|feet)/i)?.[0];
  const noun = band ? label.replace(band, '').replace(/\s+/g, ' ').trim() : label;
  const parts = [`${matches.length} ${noun} for sale`];
  if (band) parts.push(band);
  else if (lengths.length >= 2) parts.push(`${range(Math.round(Math.min(...lengths)), Math.round(Math.max(...lengths)), String)} ft`);
  // A single priced boat is a price, not a range, and reads as though it were
  // the whole book — so a range needs two.
  if (prices.length >= 2) parts.push(range(Math.min(...prices), Math.max(...prices), usdShort));
  return `${parts.join(', ')}.`;
}

/**
 * Lead the description with the facts, keep as much of the hand-written tail as
 * fits. Three rules earn their keep here:
 *
 *  - The default brand description opens "<Brand> yachts for sale from FYI
 *    Yachts in Miami." — which the facts sentence now says with numbers, so
 *    that lead is dropped rather than repeated back at the searcher.
 *  - Whole sentences beat a hard cut: a snippet ending "brokered by" reads as
 *    truncated, one ending on a period reads as written.
 *  - Only if no sentence fits do we cut mid-copy, and then a trailing
 *    connective ("and", "from", an em dash) is trimmed off the end.
 */
function withFacts(description: string, facts: string): string {
  if (!facts) return description;
  const room = SNIPPET_MAX - facts.length - 1;
  if (room < 40) return facts;

  const sentences = description.match(/[^.!?]+[.!?]+\s*/g) ?? [description];
  const body = (/for sale/i.test(sentences[0]) && /FYI|Florida Yachts/i.test(sentences[0]) && sentences.length > 1
    ? sentences.slice(1)
    : sentences);

  let kept = '';
  for (const part of body) {
    if ((kept + part).trim().length > room) break;
    kept += part;
  }
  kept = kept.trim();
  if (kept.length >= 50) return `${facts} ${kept}`;

  const flat = body.join('').trim();
  if (flat.length <= room) return flat ? `${facts} ${flat}` : facts;
  const cut = flat.slice(0, room)
    .replace(/\s+\S*$/, '')
    .replace(/\s+(?:and|or|from|by|with|plus|the|an?|in|on|of|for|to)$/i, '')
    .replace(/[\s,;:—-]+$/, '');
  return cut.length >= 40 ? `${facts} ${cut}…` : facts;
}

/** Google truncates a description around here; past it is spend with no return. */
const SNIPPET_MAX = 155;
/** Below this a count reads as thin inventory rather than choice. */
const HUB_FACTS_MIN = 5;

const HUB_CARD_COUNT = 18;

/**
 * Bake matching inventory into each brand and category hub route, mutating
 * bodyHtml (grid prepended — the listings are what the query asked for, so
 * they come before the editorial) and jsonLd. Routes stay untouched when a
 * hub matches nothing, or when both feeds came back empty.
 */
export function attachHubInventory(routes: SeoRoute[], inv: { fyi: PublicBoat[]; worldwide: PublicBoat[] }): number {
  if (!inv.fyi.length && !inv.worldwide.length) return 0;
  const byPath = new Map(routes.map((r) => [r.path, r]));
  let touched = 0;

  // A named broker on every hub — the consultant pages convert ~6× better
  // than anything else on the site (GSC, May–Aug 2026), so put the person on
  // the page that ranks. Attribution is real, never invented: the consultant
  // named is whoever lists the most of this hub's matched FYI inventory
  // (SalesRep from the BoatsGroup feed, resolved via the roster's loose name
  // key). Hubs with no FYI listings fall back to the founder — a truthful
  // universal contact — rather than a fabricated "specialist".
  const hubBroker = (matches: PublicBoat[]): { m: TeamMember; n: number } | null => {
    const counts = new Map<string, number>();
    for (const b of matches) if (b.rep) counts.set(repKey(b.rep), (counts.get(repKey(b.rep)) ?? 0) + 1);
    const best = [...counts.entries()].sort((a, z) => z[1] - a[1]).find(([k]) => memberByRepKey.has(k));
    return best ? { m: memberByRepKey.get(best[0])!, n: best[1] } : null;
  };
  const brokerHtml = (matches: PublicBoat[]): string => {
    const hit = hubBroker(matches);
    const founder = memberBySlug.get('ralph-navarro');
    const line = hit
      ? `<a class="text-yacht-brand underline" href="/consultants/${hit.m.slug}">${esc(hit.m.name)}</a> — ${esc(hit.m.title)} — lists ${hit.n === 1 ? 'one' : hit.n} of the vessels above. See their live listings and sold history, or call +1-305-854-6020.`
      : founder
        ? `Not sure where to start? <a class="text-yacht-brand underline" href="/consultants/${founder.slug}">${esc(founder.name)}</a>, founder of FYI Yachts, will match you with the right consultant — call +1-305-854-6020.`
        : '';
    return line ? `<p class="mt-6 text-[15px] font-light leading-7 text-yacht-900/80"><strong class="font-medium">Talk to a broker who knows these boats:</strong> ${line}</p>` : '';
  };

  const attach = (path: string, heading: string, listName: string, matches: PublicBoat[], factLabel: string) => {
    const r = byPath.get(path);
    if (!r || !matches.length) return;
    r.description = withFacts(r.description, hubFacts(factLabel, matches));
    const picked = matches
      .map((b) => ({ b, href: cardHref(b) }))
      .filter((x): x is { b: PublicBoat; href: string } => !!x.href)
      .slice(0, HUB_CARD_COUNT);
    if (!picked.length) return;
    // Broker attribution counts only the cards actually rendered, so "of the
    // vessels above" stays literally true even when matches exceed the grid.
    r.bodyHtml = inventoryHtml(heading, picked, matches.length) + brokerHtml(picked.map((x) => x.b)) + (r.bodyHtml ?? '');
    r.jsonLd = [...(r.jsonLd ?? []), itemListSchema(listName, picked, matches.length)];
    touched++;
  };

  // FYI's own boats lead, then the worldwide tier priced-first descending —
  // the same ordering the client renders (own book above marketplace).
  const tiered = (pick: (b: PublicBoat) => boolean): PublicBoat[] => [
    ...inv.fyi.filter(pick),
    ...inv.worldwide.filter(pick).sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0)),
  ];

  for (const b of BRAND_PAGES) {
    const m = b.match.toLowerCase();
    attach(`/${b.slug}`, `${b.name} yachts for sale right now`, `${b.name} Yachts for Sale`,
      tiered((x) => x.make.toLowerCase().includes(m)),
      // "Ferretti Yachts" + " yachts" reads "Ferretti Yachts yachts".
      /yachts?$/i.test(b.name) ? b.name : `${b.name} yachts`);
  }
  for (const c of CATEGORY_PAGES) {
    attach(`/${c.slug}`, `${c.h1} — live inventory`, c.h1, tiered(c.filter), c.h1.replace(/ for sale$/i, '').toLowerCase());
  }
  // Hubs whose feeds matched nothing (thin superyacht brands, mostly) still
  // get the founder contact block, so no hub page is left without a person.
  for (const slug of [...BRAND_PAGES.map((b) => b.slug), ...CATEGORY_PAGES.map((c) => c.slug)]) {
    const r = byPath.get(`/${slug}`);
    if (r && !(r.bodyHtml ?? '').includes('Talk to a broker who knows these boats')) {
      r.bodyHtml = brokerHtml([]) + (r.bodyHtml ?? '');
    }
  }
  return touched;
}

// For llms.txt (scripts/prerender.mjs): the same lists the site routes from,
// so its links and counts can't drift from the pages that exist.
export { BRAND_PAGES, CATEGORY_PAGES, FYI_TEAM };
export const MANUAL_LISTING_COUNT = MANUAL_LISTINGS.length;

/**
 * The landing page's header + hero (with its quick form) as HTML the app
 * hydrates (index.tsx), so renderToString — hydration needs its text-node
 * markers. The tree must match the page's first client render, props
 * included. React also emits a <link rel=preload> for the eager logo image
 * ahead of the markup; that node isn't part of the component tree hydration
 * walks, so it is dropped.
 */
function landingShell(count: number | null): string {
  const form = createElement(QuickForm, { ...QUICK_FORM, placement: 'hero' });
  return renderToString(createElement(LpShell, { hero: { ...CC_HERO, count, form } }))
    .replace(/^(?:<link [^>]*>)+/, '');
}

/**
 * Bake the live center console count into the landing page's trust strip,
 * computed the way the page computes it: FYI's own center consoles (feed +
 * hand-entered) plus PLS's co-brokerage total, less FYI's own boats on PLS's
 * first page (the co-brokerage search drops those, page by page). Left out,
 * never guessed, when either feed didn't answer at build time.
 */
export async function attachLandingShells(routes: SeoRoute[], inv: { fyi: PublicBoat[] }): Promise<number | null> {
  const r = routes.find((x) => x.path === LP_PATH);
  if (!r || !inv.fyi.length) return null;
  const manual = MANUAL_LISTINGS.map(normalizePublicBoat).filter((b): b is PublicBoat => b !== null);
  const own = [...inv.fyi, ...manual];
  const ownCc = own.filter((b) => isCenterConsole(b.classCode)).length;
  // The live search's exact query, fields included: PLS answers "Service
  // Unavailable" to a length-sorted search that asks for DocumentID alone.
  const search = () => plsSearch(
    { class: 'Center Consoles', sort: 'Length|desc', rows: '24' },
    { fields: PLS_CARD_FIELDS, cardOnly: true },
  );
  try {
    const page = await search().catch(() => search());
    if (!page.numResults) {
      console.warn(`[seoData] landing count: PLS returned no results (BOATS_PLS_API_KEY ${process.env.BOATS_PLS_API_KEY ? 'set' : 'not set'})`);
      return null;
    }
    const ids = new Set(own.map((b) => b.id));
    const dropped = page.results.filter((x) => ids.has(String(x.DocumentID))).length;
    const count = ownCc + page.numResults - dropped;
    r.shellHtml = landingShell(count);
    return count;
  } catch (err) {
    console.warn(`[seoData] landing count: ${(err as Error)?.message || err}`);
    return null;
  }
}
