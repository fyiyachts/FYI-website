/**
 * Data layer for the public SEO pages that mirror fyiyachts.com's URL
 * structure (see the page-sitemap there). Slugs are kept IDENTICAL to the
 * WordPress site so a future domain cutover preserves rankings with no
 * redirect map. Brand/category pages filter the live BoatsGroup feed.
 */

/**
 * Where a listing came from. Inventory is presented in this order everywhere:
 * FYI's own boats first, then the wider BoatsGroup marketplace.
 */
export type BoatSource = 'fyi' | 'cobrokerage' | 'boatsgroup';

export interface PublicBoat {
  id: string;
  title: string;
  make: string;
  model: string;
  year?: number;
  lengthFt?: number;
  priceUsd?: number;
  condition?: string; // New | Used
  classCode: string;
  city?: string;
  state?: string;
  country?: string;
  image?: string;
  source?: BoatSource;
  /** Listing brokerage, used to split FYI's own boats from the marketplace. */
  company?: string;
  /** SalesRep.Name from the BoatsGroup feed — the listing broker (FYI boats only). */
  rep?: string;
  /** Set for rows that are not FYI's — those link out rather than to /listing/:id. */
  externalUrl?: string;
  /** SoldDate from the feed (ISO) — orders the sold galleries by closing date. */
  soldDate?: string;
  /** ItemReceivedDate (ISO) — when the boat was first listed; "newest" sorts on it. */
  listedAt?: string;
}

/**
 * FYI's own listings appear under both spellings across the two feeds, and the
 * whole tiering depends on telling them apart from everyone else's.
 */
export function isFyiCompany(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('florida yachts international') || n.includes('fyi yachts');
}

export const resizeBG = (url: string, w: number, h: number): string =>
  url.includes('images.boatsgroup.com/images/')
    ? `${url.replace('/images/', '/resize/')}?w=${w}&h=${h}`
    : url;

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * The sold galleries lead with a ROLLING 24-MONTH WINDOW, largest boat first
 * (client, 2026-09-03). Both halves matter: the window keeps the proof current
 * without any card having to carry a date, and length ordering leads with the
 * biggest thing FYI closed rather than whatever happened to sell last.
 *
 * A row with no SoldDate is excluded — it cannot be shown to be inside the
 * window. In FYI's book that is currently nobody (993/993 sold rows carry one).
 */
/**
 * Widened from 12 to 24 months (client, 2026-09-03: "there needs to be more
 * big boats in sold"). The measured difference over FYI's 993 sold rows:
 * 12 months carries 55 boats, 7 of them over 60ft and 5 over 80ft, topping out
 * at 102ft; 24 months carries 118, with 20 over 60ft, 11 over 80ft and a 126ft
 * lead card. Since the window is ordered largest-first, that is what the
 * opening screens actually show.
 */
export const SOLD_WINDOW_MONTHS = 24;

export function soldWindowStart(now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - SOLD_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

export const withinSoldWindow = (soldDate: string | undefined, from = soldWindowStart()): boolean =>
  !!soldDate && soldDate.slice(0, 10) >= from;

/**
 * The sold ordering: **everything is shown**, but the last 12 months come
 * first, largest to smallest, and the rest of the book follows in the same
 * length order (client, 2026-09-03 — "show all sold but organize the first
 * couple pages by rolling 12 months largest to smallest").
 *
 * An earlier pass filtered the older boats out entirely. That was too blunt:
 * 55 of 993 rows are inside the window, and only 13 of 56 reps have one, so
 * most consultant profiles lost their track record. Leading with the window
 * gets the same "current proof first" effect while keeping the full history
 * a scroll away.
 */
export function compareSold<T extends { soldDate?: string; lengthFt?: number }>(
  a: T,
  b: T,
  from = soldWindowStart(),
): number {
  const recent = (x: T) => (withinSoldWindow(x.soldDate, from) ? 0 : 1);
  return recent(a) - recent(b)
    || (b.lengthFt ?? 0) - (a.lengthFt ?? 0)
    || (b.soldDate ?? '').localeCompare(a.soldDate ?? '');
}

export function normalizePublicBoat(it: Record<string, any>): PublicBoat | null {
  const id = String(it.DocumentID || '');
  if (!id) return null;
  const images: string[] = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  const loc = it.BoatLocation || {};
  return {
    id,
    title: it.BoatName || [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim() || 'Yacht',
    make: it.MakeString || '',
    model: it.Model || '',
    year: it.ModelYear ? Number(it.ModelYear) : undefined,
    lengthFt: num(it.LengthOverall ?? it.NominalLength),
    priceUsd: it.PriceHideInd ? undefined : num(it.NormPrice ?? it.Price),
    condition: it.SaleClassCode || undefined,
    classCode: Array.isArray(it.BoatClassCode) ? it.BoatClassCode.join(', ') : it.BoatClassCode || '',
    city: loc.BoatCityName && loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : undefined,
    state: loc.BoatStateCode || undefined,
    // BoatStateCode is only populated for US listings, so without this a
    // foreign-lying boat had no location at all to filter on — 22% of the
    // book, and 13 of the 31 boats in the 60-90ft band (Mexico, Venezuela,
    // Greece, Bahamas). Two-letter ISO code.
    country: loc.BoatCountryID || undefined,
    image: images[0] ? resizeBG(images[0], 900, 675) : undefined,
    company: it.CompanyName || undefined,
    rep: (it.SalesRep && it.SalesRep.Name) ? String(it.SalesRep.Name).trim() : undefined,
    source: it.ListingType === 'cobrokerage' ? 'cobrokerage' : isFyiCompany(it.CompanyName) ? 'fyi' : 'boatsgroup',
    soldDate: it.SoldDate ? String(it.SoldDate) : undefined,
    listedAt: it.ItemReceivedDate ? String(it.ItemReceivedDate) : undefined,
  };
}

/**
 * Co-brokerage listings (BoatsGroup PLS, via /api/yachts/cobrokerage): boats
 * listed by other brokerages that FYI can sell. PLS does the searching,
 * sorting and paging; `params` are the same keys as the /yachts-for-sale URL
 * (q, make, type, minLen, maxLen, minPrice, maxPrice, year, condition, sort)
 * plus state/country for the location pages. FYI's own boats are dropped
 * server-side, so they only ever show as FYI Exclusives.
 */
export interface CobrokeragePage {
  boats: PublicBoat[];
  /** Matches across all pages, less FYI's own boats found on this page. */
  numResults: number;
  /** FYI's own boats removed from this page. */
  dropped: number;
  /** PLS offset for the next page, and whether there is one. */
  nextStart: number;
  hasMore: boolean;
}

export async function searchCobrokerage(
  params: Record<string, string | undefined>,
  start = 0,
  rows = 24,
  signal?: AbortSignal,
): Promise<CobrokeragePage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  qs.set('start', String(start));
  qs.set('rows', String(rows));
  const res = await fetch(`/api/yachts/cobrokerage?${qs.toString()}`, { credentials: 'same-origin', signal });
  if (!res.ok) throw new Error(`cobrokerage ${res.status}`);
  const data = await res.json();
  const items: any[] = Array.isArray(data?.results) ? data.results : [];
  return {
    boats: items
      .map(normalizePublicBoat)
      .filter((b): b is PublicBoat => b !== null && !isFyiCompany(b.company)),
    numResults: Number(data?.numResults) || 0,
    dropped: Number(data?.dropped) || 0,
    nextStart: Number(data?.nextStart) || start + rows,
    hasMore: !!data?.hasMore,
  };
}

let inventoryCache: { boats: PublicBoat[]; at: number } | null = null;
const INVENTORY_TTL_MS = 2 * 60 * 1000;

export async function fetchActiveInventory(): Promise<PublicBoat[]> {
  if (inventoryCache && Date.now() - inventoryCache.at < INVENTORY_TTL_MS) return inventoryCache.boats;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/yachts/proxy?rows=400', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const items: any[] = Array.isArray(data?.results) ? data.results : [];
        if (items.length) {
          const boats = items
            .map(normalizePublicBoat)
            .filter((b): b is PublicBoat => b !== null);
          inventoryCache = { boats, at: Date.now() };
          return boats;
        }
      }
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 900));
  }
  return [];
}

/* -------------------------------------------------------------- brands */

export interface BrandPage {
  slug: string;        // exact fyiyachts.com slug
  name: string;
  match: string;       // substring matched against MakeString (lowercase)
  blurb: string;
  logo?: string;       // fyiyachts.com media bucket, black-on-transparent
  // Search-result copy. Both are OPTIONAL — without them a brand falls back to
  // the generic "<Name> Yachts for Sale | FYI Yachts" pattern below, which is
  // still what ~40 of these pages use.
  //
  // Set them when Search Console shows a page ranking on page one and being
  // passed over anyway. The 2026-05/08 export had five such pages: they held
  // positions 4-15 on builder searches and converted at 0.00-0.36%, against
  // ~3-7% normal for those positions. The generic title was a big part of it —
  // it repeats the brand name the searcher just typed and then says nothing,
  // and against YachtWorld and the builder's own site that loses every time.
  //
  // What the export said to fix, per page: lead with the noun people actually
  // search (3,200 searches for "carver BOATS" vs 1,894 for "carver yachts",
  // titled "Carver Yachts"), carry "used" where the queries do, name the model
  // ranges when model searches dominate (Azimut is almost entirely Seadeck),
  // and answer local intent when it shows up ("contender boats homestead", 954
  // impressions). Keep titles ~60 chars — mobile out-converts desktop here
  // (0.77% vs 0.57%), and mobile truncates first.
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * The builder as the feeds name it, for make filters: "Ferretti" (feeds say
 * "Ferretti Yachts"), "Cigarette" (the page says "Cigarette Racing"). Built
 * from `match` rather than `name`, which is display copy and can carry words
 * the feed's MakeString doesn't — PLS then matches nothing.
 */
export const brandMake = (b: BrandPage): string =>
  b.match.replace(/\b[a-z]/g, c => c.toUpperCase());

/** Search-result title for a brand page — the per-brand override, else the generic pattern. */
export const brandSeoTitle = (b: BrandPage): string =>
  // "Ferretti Yachts" must not become "Ferretti Yachts Yachts for Sale" — a
  // doubled word in the one line a searcher reads first.
  b.seoTitle ?? `${/yachts?$/i.test(b.name) ? b.name : `${b.name} Yachts`} for Sale | FYI Yachts`;

/**
 * Search-result description for a brand page. `tail` is the caller's fallback
 * sentence (the prerenderer passes the brand tagline, the React page passes the
 * blurb) and is ignored whenever the brand carries its own description.
 */
export const brandSeoDescription = (b: BrandPage, tail: string): string =>
  // Same doubling guard as brandSeoTitle: "Majesty Yachts" + " yachts" read
  // "Majesty Yachts yachts for sale" in the live snippet.
  b.seoDescription ?? `${/yachts?$/i.test(b.name) ? b.name : `${b.name} yachts`} for sale from FYI Yachts in Miami. ${tail}`;

const LOGO = (f: string) => `https://storage.googleapis.com/fyiyachts/2025/06/${f}`;

// Slug list mirrors fyiyachts.com's live brand pages (page-sitemap.xml).
export const BRAND_PAGES: BrandPage[] = [
  // Seadeck alone drew 2,368 impressions against 179 for "azimut yachts for
  // sale florida", and "azimut seadeck 9 price" is the best-converting query on
  // the page (1.44%) — so the title leads with model ranges and the description
  // promises prices.
  { slug: 'azimut-yachts-for-sale', name: 'Azimut', match: 'azimut', logo: LOGO('AZIMUT.png'), blurb: 'Avantgarde Italian flybridge and megayacht design from the world’s largest yacht builder.',
    seoTitle: 'Azimut Yachts for Sale — Seadeck, Verve, Fly & Atlantis',
    seoDescription: 'Azimut yachts for sale — Seadeck, Verve, Atlantis and Fly ranges, 34 to 120 feet. Current prices and availability from FYI Yachts in Miami.' },
  { slug: 'sunseeker-yachts-for-sale', name: 'Sunseeker', match: 'sunseeker', logo: LOGO('SUNSEEKER.png'), blurb: 'Hand-built British performance yachts from Poole — Predators, Manhattans, and superyachts.' },
  { slug: 'benetti-yachts-for-sale', name: 'Benetti', match: 'benetti', logo: LOGO('benetti-1.png'), blurb: 'Italian excellence since 1873 — custom and semi-custom displacement superyachts.' },
  { slug: 'ferretti-yachts-for-sale', name: 'Ferretti Yachts', match: 'ferretti', logo: LOGO('FERETTI.png'), blurb: 'Flybridge motor yachts from 50 to 100 feet, engineered in Forlì and styled in Italy.' },
  { slug: 'pershing-yachts-for-sale', name: 'Pershing', match: 'pershing', logo: LOGO('PERSHING.png'), blurb: 'Open coupé performance yachts — 40+ knots of Italian adrenaline.' },
  { slug: 'riva-yachts-for-sale', name: 'Riva', match: 'riva', logo: LOGO('Riva-1.png'), blurb: 'From the Aquarama legend to modern flagships — the most iconic name on the water.' },
  { slug: 'princess-yachts-for-sale', name: 'Princess', match: 'princess', logo: LOGO('princess.png'), blurb: 'Plymouth-built flybridge, V-class, and X-class yachts with deep-V heritage.' },
  { slug: 'sea-ray-boats-for-sale', name: 'Sea Ray', match: 'sea ray', logo: LOGO('sea-ray.png'), blurb: 'America’s best-known builder — Sundancers, SLXs, and sport yachts.' },
  { slug: 'hatteras-yachts-for-sale', name: 'Hatteras', match: 'hatteras', logo: LOGO('hatteras.png'), blurb: 'Legendary North Carolina convertibles and motor yachts built for blue water.' },
  { slug: 'sanlorenzo-yachts-for-sale', name: 'Sanlorenzo', match: 'sanlorenzo', logo: LOGO('SANLORENZO.png'), blurb: 'Made-to-measure Italian yachts — SL, SD, and SX lines crafted since 1958.' },
  { slug: 'san-lorenzo-yachts-for-sale', name: 'Sanlorenzo', match: 'sanlorenzo', logo: LOGO('SANLORENZO.png'), blurb: 'Made-to-measure Italian yachts — SL, SD, and SX lines crafted since 1958.' },
  { slug: 'okean-yachts-for-sale', name: 'OKEAN', match: 'okean', logo: LOGO('OKEAN.png'), blurb: 'Brazilian-built fast displacement yachts with vast single-level living.' },
  { slug: 'rizzardi-yachts-for-sale', name: 'Rizzardi', match: 'rizzardi', logo: LOGO('RIZZARDI.png'), blurb: 'Italian sport yachts — IN and GR series — built for Mediterranean pace.' },
  // No logo: the bucket's CIGARETTE.png is already white-on-transparent, and
  // every surface that shows these renders them white via CSS `invert` — so it
  // would come out a black oval on navy. Falls back to the brand name.
  { slug: 'cigarette-yachts-for-sale', name: 'Cigarette Racing', match: 'cigarette', blurb: 'The original Miami performance brand — offshore icons since 1969.' },
  { slug: 'lazzara-yachts-for-sale', name: 'Lazzara', match: 'lazzara', logo: LOGO('LAZZARA.png'), blurb: 'Florida-built luxury motor yachts known for wide-open, single-level layouts.' },
  { slug: 'majesty-yachts-for-sale', name: 'Majesty Yachts', match: 'majesty', logo: LOGO('MAJESTY.png'), blurb: 'Gulf Craft’s flagship line — modern superyachts with remarkable volume per foot.' },
  { slug: 'ocean-alexander-yachts-for-sale', name: 'Ocean Alexander', match: 'ocean alexander', logo: LOGO('OCEAN-ALEXANDER.png'), blurb: 'Pacific-built motoryachts prized for engineering and long-range comfort.' },
  { slug: 'bertram-boats-for-sale', name: 'Bertram', match: 'bertram', logo: LOGO('bertram.png'), blurb: 'The deep-V pioneer — sportfishing royalty since the Moppie days.' },
  { slug: 'viking-yachts-for-sale', name: 'Viking', match: 'viking', blurb: 'New Gretna battlewagons — the tournament standard in sportfishing yachts.' },
  { slug: 'streamline-yachts-for-sale', name: 'Streamline', match: 'streamline', blurb: 'Modern center consoles engineered in South Florida.' },
  { slug: 'intrepid-powerboats-for-sale', name: 'Intrepid', match: 'intrepid', blurb: 'Semi-custom center consoles and walkarounds built one at a time in Largo.' },
  { slug: 'mangusta-yachts-for-sale', name: 'Mangusta', match: 'mangusta', blurb: 'Overmarine’s open maxi yachts — Italian power in its purest form.' },
  { slug: 'richmond-yachts-for-sale', name: 'Richmond', match: 'richmond', blurb: 'Tri-deck luxury yachts hand-built in British Columbia.' },
  { slug: 'regal-boats-for-sale', name: 'Regal', match: 'regal', blurb: 'Family-owned Orlando builder of express cruisers and bowriders.' },
  { slug: 'vandutch-boats-for-sale', name: 'VanDutch', match: 'vandutch', blurb: 'Minimalist Dutch-design dayboats — the Miami Beach silhouette.' },
  // Zero clicks on every Pursuit variant last quarter. "pursuit boats for sale
  // in florida" already sits at position 8.6, so the title says Florida.
  { slug: 'pursuit-boats-for-sale', name: 'Pursuit', match: 'pursuit', blurb: 'Offshore and dual-console boats with fit-and-finish above their class.',
    seoTitle: 'Pursuit Boats for Sale in Florida — Center & Dual Console',
    seoDescription: 'Pursuit boats for sale in Florida — S Series center consoles, DC dual consoles and OS offshore sport, 20 to 43 feet. Brokered from Miami by FYI Yachts.' },
  { slug: 'boston-whaler-boats-for-sale', name: 'Boston Whaler', match: 'boston whaler', blurb: 'The unsinkable legend — from Montauks to 42-foot Outrages.' },
  { slug: 'marquis-yachts-for-sale', name: 'Marquis', match: 'marquis', blurb: 'Wisconsin-built luxury sport yachts with European styling.' },
  { slug: 'prestige-yachts-for-sale', name: 'Prestige', match: 'prestige', blurb: 'French flybridge and F-line yachts engineered by Groupe Beneteau.' },
  { slug: 'palmer-johnson-yachts-for-sale', name: 'Palmer Johnson', match: 'palmer johnson', blurb: 'Sport yachts with unmistakable lines — the SuperSport dynasty.' },
  { slug: 'westport-yachts-for-sale', name: 'Westport', match: 'westport', blurb: 'America’s premier semi-production superyachts — 112 to 172 feet.' },
  { slug: 'heesen-yachts-for-sale', name: 'Heesen', match: 'heesen', blurb: 'Aluminum fast-displacement superyachts from Oss, the Netherlands.' },
  { slug: 'maiora-yachts-for-sale', name: 'Maiora', match: 'maiora', blurb: 'Viareggio-built semi-custom flybridge yachts from Next Yacht Group.' },
  { slug: 'feadship-yachts-for-sale', name: 'Feadship', match: 'feadship', blurb: 'The pinnacle of Dutch custom superyacht building since 1949.' },
  // "tiara boats" and "tiara yachts" split the demand almost evenly, and 1,106
  // impressions carry "used" — so the title carries all three words.
  { slug: 'tiara-yachts-for-sale', name: 'Tiara', match: 'tiara', blurb: 'Michigan-crafted luxury dayboats and sport yachts since 1974.',
    seoTitle: 'Tiara Yachts & Boats for Sale — New & Used | FYI Yachts',
    seoDescription: 'Tiara yachts and boats for sale — outboard Sport/LS dayboats, EX express cruisers and enclosed Coupes, 34 to 48 feet. New and used, brokered from Miami.' },
  // "contender boats homestead" drew 954 impressions on its own: people search
  // for where these are built, so the title answers that.
  { slug: 'contender-boats-for-sale', name: 'Contender', match: 'contender', blurb: 'Tournament-grade center consoles built in Homestead, Florida.',
    // "contender boats homestead" is this page's single biggest query — 1,690
    // impressions at position 6.2 and ZERO clicks (GSC, Sep 2026). Leading the
    // title with "Homestead-Built" won the ranking for a search whose intent is
    // the factory, not a broker, so the impressions can never convert and they
    // drag the whole hub's CTR down. Lead with buyer intent instead; Homestead
    // stays in the description, where it informs without claiming the query.
    seoTitle: 'Contender Boats for Sale — 22 to 44 ft Center Consoles',
    seoDescription: 'Contender center consoles for sale, 22 to 44 feet — Tournament, Sport and Bay. Built in Homestead, Florida since 1984, brokered from Miami by FYI Yachts.' },
  { slug: 'nhd-boats-for-sale', name: 'NHD', match: 'nhd', blurb: 'Design-forward dayboats like the NHD 33 — bold lines, serious build.' },
  // The worst offender in the export: 19,430 impressions at position 9.6 for 29
  // clicks. Titled "Carver Yachts" while 3,200 searches a quarter ask for
  // "carver BOATS" — so the title leads with boats and keeps yachts.
  { slug: 'carver-boats-for-sale', name: 'Carver', match: 'carver', blurb: 'Voluminous, livable motor yachts — unmatched space per dollar.',
    seoTitle: 'Carver Boats for Sale — New & Used Carver Yachts | FYI',
    seoDescription: 'Carver boats and motor yachts for sale — C Series command bridges and Coupes, 34 to 40 feet. Brokered from Miami by Florida Yachts International since 1994.' },
];

/* ------------------------------------------------------------ categories */

/**
 * Country match for the location pages. Both feeds carry two-letter ISO codes
 * (from BoatLocation.BoatCountryID),
 * but the full name is accepted too so one odd row in either feed cannot
 * silently empty a page.
 */
const COUNTRY_NAMES: Record<string, string[]> = {
  VE: ['venezuela'],
  MX: ['mexico', 'méxico'],
  PR: ['puerto rico'],
};

function isCountry(b: PublicBoat, code: string): boolean {
  const c = (b.country || '').trim().toLowerCase();
  if (!c) return false;
  return c === code.toLowerCase() || (COUNTRY_NAMES[code] ?? []).includes(c);
}

export interface CategoryPage {
  slug: string;
  h1: string;
  title: string;       // <title> tag
  description: string; // meta description
  intro: string;
  filter: (b: PublicBoat) => boolean;
  /**
   * The same scope for the co-brokerage search, in /api/yachts/cobrokerage
   * params (minLen, maxLen, type, condition, state, country). Empty = the whole
   * market. Kept next to `filter` so the two tiers of a page can't drift apart.
   */
  cobrokerage: Record<string, string>;
}

const hasClass = (b: PublicBoat, ...terms: string[]) =>
  terms.some(t => b.classCode.toLowerCase().includes(t));

export const CATEGORY_PAGES: CategoryPage[] = [
  {
    slug: 'yachts-for-sale',
    h1: 'Yachts for Sale',
    title: 'Yachts for Sale | FYI Yachts — Florida Yachts International',
    description: 'Browse yachts for sale with FYI Yachts — motor yachts, superyachts, sportfish and more, from our Miami brokerage with a worldwide inventory.',
    intro: 'Every yacht currently listed with FYI Yachts, updated live — and if what you want is not here, our brokers can source and represent any vessel on the market, backed by 300+ years of combined brokerage experience in Miami.',
    filter: () => true,
    cobrokerage: {},
  },
  {
    slug: 'featured-listings',
    h1: 'Featured Listings',
    title: 'Featured Listings | FYI Yachts',
    description: 'Featured yacht listings from FYI Yachts — our exclusive inventory, updated live, with full galleries, specs, and direct broker access.',
    intro: 'The vessels our brokers are proudest to represent right now — every one exclusive to FYI, updated live from the worldwide feed.',
    filter: () => true,
    cobrokerage: {},
  },
  {
    slug: 'super-yachts-for-sale',
    h1: 'Super Yachts for Sale',
    title: 'Super Yachts for Sale | FYI Yachts',
    description: 'Superyachts for sale from 80 feet and beyond — Azimut Grande, Astondoa, Baglietto and more, brokered by FYI Yachts in Miami.',
    intro: 'From 80 feet to tri-deck flagships: the superyachts currently represented by FYI, each with full specifications, galleries, and direct broker access.',
    filter: b => (b.lengthFt ?? 0) >= 80,
    cobrokerage: { minLen: '80' },
  },
  {
    // Band widened 60-80 -> 60-90 (2026-08-21). The 80-89ft boats used to land
    // only on super-yachts-for-sale, next to 100ft+ tri-decks, where the two
    // most expensive hulls in this band read as the budget option. The slug is
    // deliberately unchanged — it is an indexed, ranking URL; /60-to-90-ft-
    // yachts-for-sale redirects here (see vercel.json) so the natural URL works.
    slug: '60-to-80-ft-yachts-for-sale',
    h1: '60 to 90 ft Yachts for Sale',
    title: '60–90 ft Yachts for Sale in Miami & Florida | FYI Yachts',
    description: 'Browse 60 to 90 foot yachts for sale — flybridge, sportfish, and motor yachts in Miami and South Florida plus worldwide listings, brokered by FYI Yachts.',
    intro: 'The sweet spot of big-boat ownership: real staterooms, serious range, and a size many owners still run themselves. These are the 60-to-90-footers FYI represents right now — most lying in South Florida for easy viewing. Stepping up from a 45–60 footer? We broker both sides of the move.',
    filter: b => (b.lengthFt ?? 0) >= 60 && (b.lengthFt as number) < 90,
    cobrokerage: { minLen: '60', maxLen: '89' },
  },
  {
    slug: 'yachts-for-sale-miami',
    h1: 'Yachts for Sale in Miami',
    title: 'Yachts for Sale in Miami, FL | FYI Yachts — Miami Yacht Brokers',
    description: 'Yachts for sale in Miami and across Florida — locally lying inventory from FYI Yachts, the Miami brokerage on Coral Way since 1994.',
    intro: 'Every vessel here lies in Florida — most within an hour of our Coral Way office — so a showing is a phone call away, not a flight. FYI has brokered Miami’s waterfront since 1994: Coconut Grove, Coral Gables, Miami Beach, Key Biscayne, and up the coast to Fort Lauderdale.',
    filter: b => b.state === 'FL',
    cobrokerage: { state: 'FL' },
  },
  /**
   * Country pages. FYI's book is not all Florida — 22% of it lies abroad, and
   * that share is concentrated in exactly the big boats (13 of the 31 vessels
   * in the 60-90ft band). Until 2026-08-21 none of it appeared on any location
   * page, because yachts-for-sale-miami filters on state and normalizePublicBoat
   * never read BoatCountryID at all. These three markets are the ones FYI both
   * holds inventory in and already buys Meta traffic for.
   *
   * Bahamas was considered and deliberately left out: one FYI listing plus two
   * on the worldwide feed is a three-boat page, and thin pages cost more in
   * quality signals than they earn in coverage.
   */
  {
    slug: 'yachts-for-sale-venezuela',
    h1: 'Yachts for Sale in Venezuela',
    title: 'Yachts for Sale in Venezuela | FYI Yachts',
    description: 'Yachts and sportfish boats for sale lying in Venezuela — La Guaira, Morrocoy, Higuerote and Lecherías — brokered by FYI Yachts of Miami.',
    intro: 'FYI represents more vessels in Venezuela than anywhere outside the United States — Vikings, Bertrams, Sea Rays and Sunseekers lying at La Guaira, Morrocoy, Higuerote and Lecherías. Our consultants work in Spanish, handle export and US import, and can coordinate a delivery or a shipped transport to Florida.',
    filter: b => isCountry(b, 'VE'),
    cobrokerage: { country: 'VE' },
  },
  {
    slug: 'yachts-for-sale-mexico',
    h1: 'Yachts for Sale in Mexico',
    title: 'Yachts for Sale in Mexico | FYI Yachts',
    description: 'Yachts for sale lying in Mexico — La Paz, Puerto Vallarta, Cozumel and Cancún — including Ferretti, Azimut and Pershing, brokered by FYI Yachts.',
    intro: 'From Cozumel to the Sea of Cortez: the vessels FYI represents in Mexican waters, weighted toward the 70-to-100-foot range. Consultants work in Spanish, know the yards and marinas on both coasts, and handle export paperwork and US import when a buyer wants the boat brought north.',
    filter: b => isCountry(b, 'MX'),
    cobrokerage: { country: 'MX' },
  },
  {
    slug: 'yachts-for-sale-puerto-rico',
    h1: 'Yachts for Sale in Puerto Rico',
    title: 'Yachts for Sale in Puerto Rico | FYI Yachts',
    description: 'Yachts for sale in Puerto Rico — San Juan, Fajardo and Palmas del Mar — plus the worldwide brokerage market, through FYI Yachts of Miami.',
    intro: 'Puerto Rico is US soil, which makes it the simplest island buy an American owner can make: no import duty, no flag change, and a short run to the Virgins. Here is what is on the market there now, drawn from our own book and the worldwide brokerage feed.',
    filter: b => isCountry(b, 'PR'),
    cobrokerage: { country: 'PR' },
  },
  {
    slug: 'new-yachts-for-sale',
    h1: 'New Yachts for Sale',
    title: 'New Yachts for Sale | FYI Yachts',
    description: 'New yachts for sale — current-year builds and factory-fresh deliveries from FYI Yachts’ shipyard partners.',
    intro: 'Factory-new vessels from our direct shipyard relationships — including new construction slots and immediate-delivery builds.',
    filter: b => (b.condition || '').toLowerCase() === 'new',
    cobrokerage: { condition: 'new' },
  },
  {
    slug: 'used-yachts-for-sale',
    h1: 'Used Yachts for Sale',
    title: 'Used Yachts for Sale in Miami & Worldwide | FYI Yachts',
    description: 'Used and pre-owned yachts for sale, sea-trialed and broker-verified by FYI Yachts in Miami — plus worldwide brokerage listings sourced through our network.',
    intro: 'Pre-owned doesn’t mean compromise. Every brokerage listing here is represented by an FYI specialist who can arrange surveys, sea trials, and financing.',
    filter: b => (b.condition || '').toLowerCase() === 'used',
    cobrokerage: { condition: 'used' },
  },
  {
    slug: 'small-yachts-for-sale',
    h1: 'Small Yachts for Sale',
    // 44K impressions at 0.29% CTR (GSC, 2026-05→08): the page ranks but the
    // snippet gave a price-shopping audience nothing to click. Lead with the
    // size band and promise prices/photos — the intent behind "small yacht"
    // queries is affordability, so the description answers it directly.
    // Size band says "under 45 ft", not "30–45 ft": the filter below is
    // `>0 && <45`, so the page lists boats down to 11 ft — and it should, since
    // "mini yacht" and "cheap yachts for sale" are among its top queries. The
    // description now leads with the measured range from live inventory, so a
    // title claiming a 30 ft floor would contradict it in the same SERP entry.
    title: 'Small Yachts for Sale Under 45 ft — Prices & Photos | FYI Yachts',
    description: 'Small yachts and mini yachts for sale under 45 feet with current prices and full photo galleries — dayboats, express cruisers and center consoles, brokered from Miami by FYI Yachts.',
    intro: 'Under 45 feet and easy to own: dayboats, express cruisers, and center consoles that get you on Biscayne Bay this weekend.',
    filter: b => (b.lengthFt ?? 0) > 0 && (b.lengthFt as number) < 45,
    cobrokerage: { maxLen: '44' },
  },
  {
    slug: 'sport-fishing-yachts-for-sale',
    h1: 'Sport Fishing Yachts for Sale',
    // "Sport fishers" in the title on purpose: the migrated WP article at
    // /sport-fishers-for-sale ranked for that phrasing (6,090 impressions a
    // quarter) and now 301s here — the hub should keep speaking its queries.
    title: 'Sport Fishing Yachts & Sport Fishers for Sale | FYI Yachts',
    description: 'Sport fishers, sportfishing yachts and convertibles for sale — Hatteras, Viking, Bertram, Garlington and more, with live inventory from FYI Yachts in Miami.',
    intro: 'Battlewagons and convertibles ready for the canyons — brokered by specialists who fish.',
    filter: b => hasClass(b, 'fishing', 'convertible'),
    cobrokerage: { type: 'Sports Fishing Boats' },
  },
  {
    slug: 'center-console-boats-for-sale',
    h1: 'Center Console Boats for Sale',
    title: 'Center Console Boats for Sale | FYI Yachts',
    description: 'Center console boats for sale — Intrepid, Contender, Boston Whaler and more, from FYI Yachts.',
    intro: 'Run fast, fish hard, rinse off, repeat. The center consoles currently in our exclusive inventory.',
    filter: b => hasClass(b, 'center console'),
    cobrokerage: { type: 'Center Consoles' },
  },
  {
    slug: 'catamaran-yachts-for-sale',
    h1: 'Catamaran Yachts for Sale',
    title: 'Catamaran Yachts for Sale | FYI Yachts',
    description: 'Power catamarans and multihull yachts for sale from FYI Yachts in Miami.',
    intro: 'Twice the beam, twice the living space. Multihulls currently represented by FYI.',
    filter: b => hasClass(b, 'catamaran', 'multi-hull', 'multihull') || b.make.toLowerCase().includes('catamaran'),
    cobrokerage: { type: 'Power Catamarans' },
  },
];

export const findBrand = (slug: string): BrandPage | undefined =>
  BRAND_PAGES.find(b => b.slug === slug);

export const findCategory = (slug: string): CategoryPage | undefined =>
  CATEGORY_PAGES.find(c => c.slug === slug);

export const fmtUsd = (n?: number): string =>
  n && Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : 'Price on request';
