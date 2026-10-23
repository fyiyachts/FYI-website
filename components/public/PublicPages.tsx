import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Anchor, ArrowRight, Bitcoin, Camera, FileCheck2, Globe2, Handshake, MapPin, Megaphone, Phone, Search, Ship, Sparkles, TrendingUp, Users } from 'lucide-react';
import { HomeNav, HomeFooter } from '../home/HomePage';
import BriannaWidget from '../chat/BriannaWidget';
import { FinanceCalculator } from '../listing/BuyerTools';
import { usePageMeta } from '../../utils/usePageMeta';
import { track } from '../../utils/analytics';
import { getAttribution } from '../../utils/attribution';
import { useFormGuard, guardFields, HoneypotField } from '../../utils/formGuard';
import { identifyVisitor } from '../../utils/hubspotTracking';
import { optImg, srcSet } from '../../utils/img';
import { FaqSection, CHARTER_FAQS, SELL_FAQS } from './Faq';
import { LEASE_FAQS } from './faqData';
import { CATEGORY_FAQS, ABOUT_FAQS, CONTACT_FAQS } from './categoryFaqs';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import { StickyCta } from './StickyCta';
import { TestimonialsSection } from './Testimonials';
import { OfficeMap, OFFICE_ADDRESS, GOOGLE_DIRECTIONS } from './OfficeMap';
import { RESPONSE_PROMISE, RESPONSE_PROMISE_SHORT } from './responsePromise';
import { WishlistHeart } from './Wishlist';
import { getBrandDetail } from './brandContent';
import { SellScrollHero } from './scrollWorld/SellScrollHero';
import {
  BRAND_PAGES, CATEGORY_PAGES, brandSeoTitle, brandSeoDescription,
  fetchActiveInventory, fetchWorldwideBoatsGroup,
  fmtUsd, normalizePublicBoat,
  compareSold, soldWindowStart,
  type BrandPage, type CategoryPage, type PublicBoat,
} from './publicData';

/**
 * Public SEO pages mirroring fyiyachts.com's URL structure (exact slugs)
 * so the eventual domain cutover keeps every ranking URL alive. Each page
 * sets title/description and a canonical to the fyiyachts.com equivalent
 * (see usePageMeta for why that's safe pre- and post-migration).
 */

/* ------------------------------------------------------------- shell */

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
      <HomeNav />
      <main>{children}</main>
      <HomeFooter />
      <BriannaWidget />
    </div>
  );
}

export function PageHero({ eyebrow, h1, intro, crumbs }: { eyebrow: string; h1: string; intro: string; crumbs?: Crumb[] }) {
  return (
    // pt-32/pt-40 is clearance for the fixed nav — which is why the breadcrumb
    // trail renders *inside* the hero rather than above it. Placed above, it
    // would sit underneath the nav bar.
    <header className="bg-yacht-900 px-6 pb-16 pt-32 lg:pt-40">
      <div className="mx-auto max-w-7xl lg:px-2">
        {crumbs && <Breadcrumbs items={crumbs} dark className="mb-6" />}
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-light leading-snug tracking-wide text-white lg:text-5xl">{h1}</h1>
        <p className="mt-5 max-w-2xl text-[15px] font-light leading-7 text-white/70">{intro}</p>
      </div>
    </header>
  );
}

/**
 * Full-bleed photographic hero. Same content slots as PageHero, but the navy
 * block is replaced by an image with a two-axis scrim so the type stays legible
 * over bright water. The nav is fixed, hence the pt-32/pt-40 clearance.
 */
export function ImagePageHero({
  eyebrow, h1, intro, sources, src, srcMobile, alt, stats, children, compact, video,
}: {
  eyebrow: string;
  h1: string;
  intro: string;
  /** Width-descriptor candidates for the landscape crop. */
  sources: string;
  /** Fallback (mid-width) landscape crop. */
  src: string;
  /** Portrait crop for phones, where the landscape frame would clip the boat. */
  srcMobile?: string;
  alt: string;
  stats?: string[];
  /** CTA row. */
  children?: ReactNode;
  /** Shorter frame for pages where the content below must stay near the fold. */
  compact?: boolean;
  /** Optional mp4 to play behind the copy. `src` becomes its poster. */
  video?: string;
}) {
  return (
    // Tall on phones on purpose: the copy stack is bottom-anchored, and at 70vh
    // it rode up over the boat. The extra height keeps type on open water.
    <header className={`relative isolate flex flex-col justify-end overflow-hidden bg-yacht-900 px-6 pb-14 pt-32 lg:pb-16 lg:pt-40 ${
      compact ? 'min-h-[52vh] lg:min-h-[48vh]' : 'min-h-[88vh] lg:min-h-[78vh]'
    }`}>
      {video ? (
        // Motion hero. The still is the poster, so it paints immediately (the
        // LCP element stays an image) and stands in wherever autoplay is
        // refused. Muted + playsInline + loop is what makes silent autoplay
        // legal on iOS; preload="metadata" keeps the mp4 off the critical path.
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={src}
          aria-label={alt}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        >
          <source src={video} type="video/mp4" />
        </video>
      ) : (
        <picture>
          {srcMobile ? <source media="(max-width: 640px)" srcSet={srcMobile} /> : null}
          <img
            src={src}
            srcSet={sources}
            sizes="100vw"
            alt={alt}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
        </picture>
      )}
      {/* Bottom-up scrim does the legibility work on every size; the sideways
          wash only kicks in from sm up, where the copy sits in the left third. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-yacht-900/90 via-yacht-900/45 to-yacht-900/20" />
      <div className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-yacht-900/75 via-yacht-900/25 to-transparent sm:block" />

      <div className="mx-auto w-full max-w-7xl lg:px-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-light leading-snug tracking-wide text-white drop-shadow-sm lg:text-6xl">{h1}</h1>
        <p className="mt-5 max-w-2xl text-[15px] font-light leading-7 text-white/80">{intro}</p>
        {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
        {stats?.length ? (
          <dl className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/20 pt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75 lg:mt-10">
            {/* Phones only have room for the two that sell the charter. */}
            {stats.map((s, i) => (
              <dd key={s} className={i > 1 ? 'hidden sm:block' : undefined}>{s}</dd>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}

/* --------------------------------------------------------- boat grid */

function BoatCard({ boat }: { boat: PublicBoat }) {
  // Only FYI's own boats have a /listing/:id page. Anything external with no
  // detail page falls back to the enquiry form, vessel pre-filled.
  // Co-brokerage boats (BoatsGroup PLS) have full /listing/:id pages too.
  const external = boat.source && boat.source !== 'fyi' && boat.source !== 'cobrokerage';
  const badge = boat.source === 'fyi' ? 'FYI Exclusive' : null;
  const href = boat.externalUrl
    ?? (external
      ? `/contact?vessel=${encodeURIComponent([boat.year, boat.make, boat.model].filter(Boolean).join(' '))}`
      : `/listing/${boat.id}`);
  return (
    <article className="group relative bg-white shadow-sm transition-shadow duration-500 hover:shadow-xl">
      {!external && <WishlistHeart id={boat.id} className="absolute right-3 top-3 z-10" />}
      <a href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-yacht-900/5">
          {boat.image ? (
            <img
              src={optImg(boat.image, 640)}
              srcSet={srcSet(boat.image, [320, 480, 640])}
              sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
              alt={`${boat.year ?? ''} ${boat.make} ${boat.model} for sale`.trim()}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center"><Anchor className="h-8 w-8 text-yacht-900/20" /></div>
          )}
          {badge ? (
            <span className={`absolute bottom-3 left-4 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] backdrop-blur-sm ${boat.source === 'fyi' ? 'bg-yacht-brand text-white' : 'bg-white/90 text-yacht-900'}`}>
              {badge}
            </span>
          ) : null}
          {boat.lengthFt ? (
            <span className="absolute left-4 top-4 bg-yacht-900/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-yacht-cream backdrop-blur-sm">
              {Math.round(boat.lengthFt)}&#39;
            </span>
          ) : null}
        </div>
        <div className="p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-yacht-brand">
            {[boat.year, boat.make].filter(Boolean).join(' ')}
          </p>
          <h3 className="mt-1.5 text-lg font-light tracking-wide text-yacht-900">{boat.title}</h3>
          <div className="mt-4 flex items-center justify-between border-t border-yacht-900/10 pt-4">
            <span className="flex items-center gap-1.5 text-[12px] font-light text-yacht-900/55">
              {boat.city || boat.state || boat.country ? (<><MapPin className="h-3.5 w-3.5" />{[boat.city, boat.state || boat.country].filter(Boolean).join(', ')}</>) : boat.model}
            </span>
            <span className="text-sm font-semibold text-yacht-900">{fmtUsd(boat.priceUsd)}</span>
          </div>
        </div>
      </a>
    </article>
  );
}

type SortKey = 'price-desc' | 'price-asc' | 'length-desc' | 'year-desc';

function useInventory(filter: (b: PublicBoat) => boolean) {
  const [boats, setBoats] = useState<PublicBoat[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchActiveInventory().then(all => { if (alive) setBoats(all); });
    return () => { alive = false; };
  }, []);
  return { loading: boats === null, boats: useMemo(() => (boats ?? []).filter(filter), [boats, filter]) };
}

// Public search filters, URL-synced so every filtered view is a shareable,
// indexable landing URL (?make=azimut&minLen=60&maxPrice=2000000).
//
// Ranges are open min/max rather than preset buckets: visitors want "a 78-footer
// under $4M", not the nearest band (client, 2026-07-27). The legacy bucket
// params (length=60-80, price=0-500000) still parse so older links, the homepage
// hero search, and brand-page deep links keep working.
interface Filters {
  q: string;
  make: string;
  type: string;
  minLen: string;
  maxLen: string;
  minPrice: string;
  maxPrice: string;
  year: string;
  condition: string;
}
const EMPTY_FILTERS: Filters = {
  q: '', make: '', type: '', minLen: '', maxLen: '', minPrice: '', maxPrice: '', year: '', condition: '',
};

/** Legacy `60-80` / `3000000-999999999` bucket → [min, max]. */
function splitBucket(v: string): [string, string] {
  const m = /^(\d+)-(\d+)$/.exec(v.trim());
  if (!m) return ['', ''];
  const [, lo, hi] = m;
  // The old top buckets used sentinel ceilings (999, 999999999) — treat as open.
  const openHi = hi === '999' || hi === '999999999';
  return [lo === '0' ? '' : lo, openHi ? '' : hi];
}

export function readFilters(params: URLSearchParams): Filters {
  const [bLenMin, bLenMax] = splitBucket(params.get('length') ?? '');
  const [bPriceMin, bPriceMax] = splitBucket(params.get('price') ?? '');
  return {
    q: params.get('q') ?? '',
    make: params.get('make') ?? '',
    type: params.get('type') ?? '',
    minLen: params.get('minLen') ?? bLenMin,
    maxLen: params.get('maxLen') ?? bLenMax,
    minPrice: params.get('minPrice') ?? bPriceMin,
    maxPrice: params.get('maxPrice') ?? bPriceMax,
    year: params.get('year') ?? '',
    condition: params.get('condition') ?? '',
  };
}

const numOr = (v: string, fallback: number): number => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

function applyFilters(boats: PublicBoat[], f: Filters): PublicBoat[] {
  const minLen = numOr(f.minLen, -Infinity);
  const maxLen = numOr(f.maxLen, Infinity);
  const minPrice = numOr(f.minPrice, -Infinity);
  const maxPrice = numOr(f.maxPrice, Infinity);
  const minYear = f.year ? parseInt(f.year, 10) : 0;
  const q = f.q.trim().toLowerCase();
  return boats.filter(b =>
    (!q || `${b.title} ${b.make} ${b.model}`.toLowerCase().includes(q)) &&
    (!f.make || b.make.toLowerCase().includes(f.make.toLowerCase())) &&
    (!f.type || b.classCode.toLowerCase().includes(f.type.toLowerCase())) &&
    (!f.minLen || (Number.isFinite(b.lengthFt) && (b.lengthFt as number) >= minLen)) &&
    (!f.maxLen || (Number.isFinite(b.lengthFt) && (b.lengthFt as number) <= maxLen)) &&
    (!f.minPrice || (Number.isFinite(b.priceUsd) && (b.priceUsd as number) >= minPrice)) &&
    (!f.maxPrice || (Number.isFinite(b.priceUsd) && (b.priceUsd as number) <= maxPrice)) &&
    (!minYear || (b.year ?? 0) >= minYear) &&
    (!f.condition || (b.condition ?? '').toLowerCase() === f.condition.toLowerCase()),
  );
}

const compactUsd = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  : n >= 1_000 ? `$${Math.round(n / 1_000)}k`
  : `$${n}`;

/** Human label for each active filter, shown as a removable chip. */
function chipLabel(k: keyof Filters, v: string): string {
  switch (k) {
    case 'q': return `“${v}”`;
    case 'make': return v;
    case 'type': return v;
    case 'minLen': return `${v}′ and up`;
    case 'maxLen': return `up to ${v}′`;
    case 'minPrice': return `${compactUsd(numOr(v, 0))}+`;
    case 'maxPrice': return `under ${compactUsd(numOr(v, 0))}`;
    case 'year': return `${v} & newer`;
    case 'condition': return v === 'new' ? 'New' : 'Pre-owned';
    default: return v;
  }
}

/**
 * Type-to-search inventory filter. Visitors type a brand or boat name rather
 * than hunting a long <select>, and set real min/max length and price instead
 * of picking the nearest preset band. Active filters read back as removable
 * chips (client direction, 2026-07-27).
 */
function FilterBar({ boats, filters, onChange }: { boats: PublicBoat[]; filters: Filters; onChange: (f: Filters) => void }) {
  const makes = useMemo(() => [...new Set(boats.map(b => b.make).filter(Boolean))].sort(), [boats]);
  const types = useMemo(() => {
    const t = new Set<string>();
    for (const b of boats) for (const c of b.classCode.split(',')) { const v = c.trim(); if (v) t.add(v); }
    return [...t].sort();
  }, [boats]);
  const years = useMemo(() => {
    const ys = boats.map(b => b.year).filter((y): y is number => !!y);
    const min = Math.min(...ys, new Date().getFullYear());
    return [2000, 2010, 2015, 2020].filter(y => y >= min);
  }, [boats]);

  // The brand box is a free-text field with suggestions: typing "azi" narrows
  // to Azimut without forcing a scroll through every builder in the feed.
  const [makeDraft, setMakeDraft] = useState(filters.make);
  const [openSuggest, setOpenSuggest] = useState(false);
  useEffect(() => { setMakeDraft(filters.make); }, [filters.make]);

  const suggestions = useMemo(() => {
    const q = makeDraft.trim().toLowerCase();
    if (!q) return makes.slice(0, 8);
    return makes.filter(m => m.toLowerCase().includes(q)).slice(0, 8);
  }, [makeDraft, makes]);

  const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v });
  const field = 'w-full rounded-lg border border-yacht-900/20 bg-white px-3 py-2.5 text-[13px] text-yacht-900 placeholder:text-yacht-900/35 focus:border-yacht-brand focus:outline-none';
  const activeKeys = (Object.keys(filters) as (keyof Filters)[]).filter(k => filters[k]);

  return (
    <div className="w-full">
      <div className="grid gap-3 lg:grid-cols-12">
        {/* Free-text search */}
        <div className="lg:col-span-4">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-yacht-900/35" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={e => set('q', e.target.value)}
              placeholder="Boat name, model, keyword…"
              aria-label="Search listings"
              className={`${field} pl-9`}
            />
          </div>
        </div>

        {/* Brand type-ahead */}
        <div className="lg:col-span-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Brand</label>
          <div className="relative">
            <input
              type="text"
              value={makeDraft}
              onChange={e => { setMakeDraft(e.target.value); setOpenSuggest(true); }}
              onFocus={() => setOpenSuggest(true)}
              onBlur={() => { window.setTimeout(() => setOpenSuggest(false), 120); set('make', makeDraft); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); set('make', makeDraft); setOpenSuggest(false); }
                if (e.key === 'Escape') setOpenSuggest(false);
              }}
              placeholder="Type a builder — e.g. Azimut"
              aria-label="Filter by brand"
              autoComplete="off"
              className={field}
            />
            {openSuggest && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-yacht-900/15 bg-white py-1 shadow-xl">
                {suggestions.map(m => (
                  <li key={m}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); setMakeDraft(m); set('make', m); setOpenSuggest(false); }}
                      className="block w-full px-3 py-2 text-left text-[13px] text-yacht-900 hover:bg-yacht-cream"
                    >
                      {m}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Length range */}
        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Length (ft)</label>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" min={0} value={filters.minLen} onChange={e => set('minLen', e.target.value)} placeholder="Min" aria-label="Minimum length in feet" className={field} />
            <span className="text-yacht-900/30" aria-hidden="true">–</span>
            <input type="number" inputMode="numeric" min={0} value={filters.maxLen} onChange={e => set('maxLen', e.target.value)} placeholder="Max" aria-label="Maximum length in feet" className={field} />
          </div>
        </div>

        {/* Price range */}
        <div className="lg:col-span-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Price (USD)</label>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" min={0} step={50000} value={filters.minPrice} onChange={e => set('minPrice', e.target.value)} placeholder="Min" aria-label="Minimum price" className={field} />
            <span className="text-yacht-900/30" aria-hidden="true">–</span>
            <input type="number" inputMode="numeric" min={0} step={50000} value={filters.maxPrice} onChange={e => set('maxPrice', e.target.value)} placeholder="Max" aria-label="Maximum price" className={field} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Type</label>
          <select aria-label="Boat type" value={filters.type} onChange={e => set('type', e.target.value)} className={`${field} sm:w-56`}>
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Year</label>
          <select aria-label="Minimum model year" value={filters.year} onChange={e => set('year', e.target.value)} className={`${field} sm:w-40`}>
            <option value="">Any year</option>
            {years.map(y => <option key={y} value={String(y)}>{y} &amp; newer</option>)}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Condition</label>
          <select aria-label="Condition" value={filters.condition} onChange={e => set('condition', e.target.value)} className={`${field} sm:w-40`}>
            <option value="">New &amp; used</option>
            <option value="new">New</option>
            <option value="used">Pre-owned</option>
          </select>
        </div>
      </div>

      {activeKeys.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Filtering by</span>
          {activeKeys.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...filters, [k]: '' })}
              className="group inline-flex items-center gap-1.5 rounded-full bg-yacht-900 py-1.5 pl-3 pr-2 text-[12px] font-medium text-white transition-colors hover:bg-yacht-brand"
            >
              {chipLabel(k, filters[k])}
              <span aria-hidden="true" className="text-white/60 transition-colors group-hover:text-white">×</span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-yacht-brand hover:text-yacht-900"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The wider-marketplace tier, shown under FYI's own boats.
 *
 * Renders nothing at all when its feed comes back empty. It stays empty while
 * `BOATS_API_KEY` is scoped to FYI's own book (every row is filtered out by
 * `!isFyiCompany`); a broader BoatsGroup entitlement lights it up with no
 * code change. Deliberately no "no results" copy: an empty marketplace tier
 * is not information a visitor needs, and a permanently-empty block reads as
 * broken.
 */
function WorldwideTier({
  title, blurb, load, deps, filter,
}: {
  title: string;
  blurb: string;
  load: () => Promise<PublicBoat[]>;
  deps: unknown[];
  /** Applied client-side, so category pages scope the tier the same way they scope FYI's grid. */
  filter?: (b: PublicBoat) => boolean;
}) {
  const [boats, setBoats] = useState<PublicBoat[]>([]);
  const [shown, setShown] = useState(24);
  useEffect(() => {
    let alive = true;
    setShown(24);
    load().then(rows => { if (alive) setBoats(filter ? rows.filter(filter) : rows); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  if (boats.length === 0) return null;

  return (
    <section className="border-t border-yacht-900/10 bg-white px-6 py-14 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHead eyebrow="Beyond our docks" title={title} />
        <p className="mt-4 max-w-2xl text-[15px] font-light leading-7 text-yacht-900/70">
          {blurb} {boats.length} available.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boats.slice(0, shown).map(b => <BoatCard key={`${b.source}-${b.id}`} boat={b} />)}
        </div>
        {shown < boats.length && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => setShown(n => n + 24)}
              className="border border-yacht-900/20 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/70 transition-colors hover:border-yacht-brand hover:text-yacht-brand"
            >
              Show more ({boats.length - shown} left)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** FYI's own boats, then the wider BoatsGroup marketplace. */
export function TieredInventory({ make, filter, emptyNote }: {
  /** Brand name passed through to the marketplace feed, e.g. "Benetti". */
  make?: string;
  filter: (b: PublicBoat) => boolean;
  emptyNote: string;
}) {
  return (
    <>
      <InventoryGrid filter={filter} emptyNote={emptyNote} />
      <LeaseToOwnBand />
      <WorldwideTier
        title={make ? `More ${make}s from the worldwide market` : 'More from the worldwide market'}
        blurb="Listed by other brokerages and available through FYI. Your consultant represents you on any of them."
        load={() => fetchWorldwideBoatsGroup(make)}
        deps={[make]}
        filter={make ? undefined : filter}
      />
    </>
  );
}

// Slim cross-sell under every inventory grid: lease-to-own is a path almost no
// competing brokerage offers, and buyers browsing listings are exactly the
// audience it converts — surface it where the boats are, not just on its page.
function LeaseToOwnBand() {
  return (
    <div className="mx-auto max-w-7xl px-6">
      <Link
        to="/lease-to-own"
        className="group my-2 flex flex-col gap-1 border-l-2 border-yacht-brand bg-yacht-900/[0.03] px-5 py-4 transition-colors hover:bg-yacht-900/[0.06] sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="text-[15px] font-light text-yacht-900">
          <span className="font-medium">Lease-to-own available.</span> Start on the water now and navigate toward ownership — flexible terms, cryptocurrency accepted.
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-brand transition-colors group-hover:text-yacht-900">
          How it works <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}

// Inline market-alert capture on brand pages: a browser who didn't find their
// boat today is the perfect alert subscriber — the email lands in the existing
// alerts pipeline (KV + Supabase + FYI HubSpot brand segments) with web
// attribution attached, and identify() ties their browsing history to the
// contact. Sits right under the inventory, where "nothing quite right yet"
// happens.
function BrandAlertSignup({ brand }: { brand: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  // The guard can refuse for a reason a person can fix (a throwaway inbox,
  // a mistyped address) — keep it so the form can say so.
  const [alertError, setAlertError] = useState('');
  const guard = useFormGuard();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email.trim()) || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(), savedBoats: [], savedSearches: [], brands: [brand],
          attribution: getAttribution(),
          ...guardFields(guard),
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setAlertError(detail?.error || '');
        throw new Error();
      }
      identifyVisitor(email.trim());
      track('brand_alert_subscribe', { brand });
      setState('done');
    } catch { setState('error'); }
  };
  return (
    // Rendered inside SpecialistStrip's dark band — no panel chrome of its own.
    <div>
      <div>
        {state === 'done' ? (
          <p className="text-[15px] font-light text-white">
            You're on the list — new {brand} listings will land in your inbox first.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-teal">Be first aboard</p>
              <p className="mt-1.5 text-lg font-light text-white">
                New {brand} listings, straight to your inbox — before they hit the portals.
              </p>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Email for new-listing alerts"
                className="min-w-0 flex-1 border border-white/20 bg-white/10 px-4 py-3 text-sm font-light text-white placeholder:text-white/50 focus:border-yacht-teal focus:outline-none"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="shrink-0 bg-yacht-brand px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-yacht-brand-light disabled:opacity-60"
              >
                {state === 'sending' ? 'Adding…' : 'Notify me'}
              </button>
            </div>
            <HoneypotField guard={guard} />
            {state === 'error' && <p className="text-[12px] text-red-300">{alertError || 'Something went wrong — please try again.'}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function InventoryGrid({ filter, emptyNote }: { filter: (b: PublicBoat) => boolean; emptyNote: string }) {
  const { loading, boats } = useInventory(filter);
  const [sort, setSort] = useState<SortKey>('price-desc');
  const [params, setParams] = useSearchParams();
  const filters: Filters = useMemo(() => readFilters(params), [params]);
  const setFilters = (f: Filters) => {
    // Only the canonical min/max keys are written back, so a URL that arrived
    // with a legacy bucket param is rewritten in the new shape on first edit.
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) next.set(k, v);
    setParams(next, { replace: true });
  };
  const filtered = useMemo(() => applyFilters(boats, filters), [boats, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const v = (n?: number) => (Number.isFinite(n) ? (n as number) : -1);
    switch (sort) {
      case 'price-asc': arr.sort((a, b) => (v(a.priceUsd) === -1 ? 1 : v(b.priceUsd) === -1 ? -1 : v(a.priceUsd) - v(b.priceUsd))); break;
      case 'length-desc': arr.sort((a, b) => v(b.lengthFt) - v(a.lengthFt)); break;
      case 'year-desc': arr.sort((a, b) => v(b.year) - v(a.year)); break;
      default: arr.sort((a, b) => v(b.priceUsd) - v(a.priceUsd));
    }
    return arr;
  }, [filtered, sort]);

  return (
    <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
      {!loading && boats.length > 0 && (
        <div className="mb-6">
          <FilterBar boats={boats} filters={filters} onChange={setFilters} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.25em] text-yacht-900/50">
          {loading ? 'Loading inventory…' : `${sorted.length} ${sorted.length === 1 ? 'vessel' : 'vessels'} available`}
        </p>
        <label className="flex items-center gap-2 text-[12px] text-yacht-900/60">
          Sort
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-yacht-900/20 bg-white px-3 py-2 text-[13px] text-yacht-900 focus:border-yacht-brand focus:outline-none"
          >
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="length-desc">Length: longest first</option>
            <option value="year-desc">Year: newest first</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="animate-pulse bg-white shadow-sm">
              <div className="aspect-[4/3] bg-yacht-900/10" />
              <div className="space-y-3 p-6">
                <div className="h-2.5 w-24 bg-yacht-900/10" />
                <div className="h-4 w-2/3 bg-yacht-900/10" />
                <div className="mt-4 h-px bg-yacht-900/10" />
                <div className="flex justify-between pt-1">
                  <div className="h-3 w-20 bg-yacht-900/10" />
                  <div className="h-3 w-24 bg-yacht-900/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !loading && sorted.length === 0 ? (
        <div className="mt-12 border border-dashed border-yacht-900/20 p-12 text-center">
          <Ship className="mx-auto h-8 w-8 text-yacht-brand" />
          <p className="mx-auto mt-4 max-w-md text-[15px] font-light leading-7 text-yacht-900/70">{emptyNote}</p>
          <a href="/contact" className="mt-6 inline-flex items-center gap-2 bg-yacht-brand px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light">
            Ask a broker to source one <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(b => <BoatCard key={b.id} boat={b} />)}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------ inquiry form */

/**
 * Shared public inquiry form.
 *
 * On success this navigates to `/thank-you` rather than swapping in an inline
 * confirmation. The inline state had no URL, so there was nothing for GA4,
 * Google Ads, or Meta to fire a conversion against — every lead the site
 * produced was invisible to the ad platforms. The thank-you page owns the
 * `generate_lead` event.
 *
 * Pass `inlineConfirm` where navigating away would lose the user's place —
 * a sidebar inquiry on a listing they're still reading, for example. Those
 * keep the inline confirmation *and* fire `generate_lead` here instead, so
 * the conversion is still tracked either way.
 */
export function PublicInquiryForm({ context, dark = false, messagePlaceholder, inlineConfirm = false }: { context: string; dark?: boolean; messagePlaceholder?: string; inlineConfirm?: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  // The lead guard can refuse a submission for a reason a person can fix
  // ("please enter a valid email address"). Keep it so the form can say so
  // instead of the generic try-again line.
  const [errorMsg, setErrorMsg] = useState('');
  const guard = useFormGuard();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // On dark sections the underline treatment reads fine. On light sections it
  // did not — bare underlines with faint placeholders on a cream background
  // looked like empty space next to bordered cards (reported on /yacht-financing),
  // so the light variant gets real boxed fields with legible placeholder text.
  const input = dark
    ? 'w-full border-b border-white/25 bg-transparent py-3 text-sm font-light text-white placeholder:text-white/45 focus:border-yacht-brand focus:outline-none'
    : 'w-full rounded-md border border-yacht-900/20 bg-white px-4 py-3 text-sm font-light text-yacht-900 shadow-sm transition-colors placeholder:text-yacht-900/55 focus:border-yacht-brand focus:outline-none focus:ring-1 focus:ring-yacht-brand/30';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/contact/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone: phone || null,
          message: message || `${context} inquiry from the website.`,
          attribution: getAttribution(),
          ...guardFields(guard),
          yacht: { title: context },
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setErrorMsg(detail?.error || '');
        setState('error');
        return;
      }
      track('inquiry_submit', { context });
      identifyVisitor(email);
      if (inlineConfirm) {
        // No navigation, so this form owns the conversion event that
        // /thank-you would otherwise fire.
        track('generate_lead', { context, page_path: pathname });
        setState('sent');
        return;
      }
      navigate(`/thank-you?ctx=${encodeURIComponent(context)}&from=${encodeURIComponent(pathname)}`);
    } catch { setState('error'); }
  };

  if (state === 'sent') {
    return (
      <div className="py-10 text-center">
        <Anchor className={`mx-auto h-8 w-8 ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`} />
        <p className={`mt-4 text-lg font-light ${dark ? 'text-white' : 'text-yacht-900'}`}>Thank you — a broker will reach out shortly.</p>
        <p className={`mt-2 text-[13px] font-light ${dark ? 'text-white/55' : 'text-yacht-900/55'}`}>{RESPONSE_PROMISE}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <input required value={name} onChange={e => setName(e.target.value)} type="text" placeholder="Full name" className={input} />
      <input required value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address" className={input} />
      <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="Phone (optional)" className={input} />
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder={messagePlaceholder ?? `Tell us about your ${context.toLowerCase()} plans`} className={`${input} resize-none`} />
      <HoneypotField guard={guard} />
      <button type="submit" disabled={state === 'sending'} className="w-full bg-yacht-brand py-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition-colors hover:bg-yacht-brand-light disabled:opacity-60">
        {state === 'sending' ? 'Sending…' : 'Submit Inquiry'}
      </button>
      <p className={`text-center text-[12px] font-light ${dark ? 'text-white/50' : 'text-yacht-900/50'}`}>{RESPONSE_PROMISE_SHORT}</p>
      {state === 'error' && <p className="text-[12px] text-yacht-brand">{errorMsg || 'Something went wrong — please try again or call 305-854-6020.'}</p>}
    </form>
  );
}

/* ------------------------------------------------- category & brand */

// Live sold history straight from the BoatsGroup feed (salesstatus=sold) —
// the fyiyachts.com /sold-yachts equivalent, refreshed with every closing.
// Sold vessels are shown as social proof, not linked to detail pages.
export function SoldYachtsPage() {
  usePageMeta(
    'Sold Yachts | FYI Yachts',
    'A selection of yachts sold by Florida Yachts International — three decades of closings backed by a worldwide buyer network and 300+ years of combined brokerage experience.',
    '/sold-yachts/',
  );
  const [loading, setLoading] = useState(true);
  const [boats, setBoats] = useState<PublicBoat[]>([]);

  useEffect(() => {
    let alive = true;
    // The sold book is ~1,000 rows and the feed does not hand back the newest
    // closings first — sorting one 400-row page put 2024 at the top while 2026
    // sat on page three. So pull the whole book (three pages via `start`, the
    // only pagination param the upstream honors) and order it here.
    const from = soldWindowStart();
    const PAGE = 400;
    const page = (start: number) =>
      fetch(`/api/yachts/proxy?salesstatus=sold&rows=${PAGE}&start=${start}`)
        .then(r => r.json())
        .then(d => (Array.isArray(d?.results) ? (d.results as unknown[]) : []))
        .catch(() => [] as unknown[]);
    Promise.all([page(0), page(PAGE), page(PAGE * 2)])
      .then(pages => {
        if (!alive) return;
        const seen = new Set<string>();
        setBoats(
          pages
            .flat()
            .map(it => normalizePublicBoat(it as Record<string, any>))
            .filter((b): b is PublicBoat => b !== null && !!b.image)
            .filter(b => !seen.has(b.id) && seen.add(b.id))
            // Whole book, last 12 months first, largest to smallest.
            .sort((a, b) => compareSold(a, b, from)),
        );
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <PublicShell>
      <PageHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Sold Yachts' }]}
        eyebrow="Proven Results"
        h1="Sold Yachts"
        intro="Every vessel below found its next owner through FYI. When you're ready to sell, this is the track record working for you."
      />
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.25em] text-yacht-900/50">
          {/* Deliberately not a recency claim: the grid is ordered newest-closed
              first, but nothing on the page dates a boat, so it is described as
              a selection rather than as "recent" (client, 2026-09-03). */}
          {loading ? 'Loading sold history…' : 'A selection of our sold boats'}
        </p>
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="animate-pulse bg-white shadow-sm">
                <div className="aspect-[4/3] bg-yacht-900/10" />
                <div className="space-y-3 p-6">
                  <div className="h-2.5 w-24 bg-yacht-900/10" />
                  <div className="h-4 w-2/3 bg-yacht-900/10" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {boats.map(b => (
              <div key={b.id} className="group overflow-hidden bg-white shadow-sm">
                <div className="relative overflow-hidden">
                  <img
                    src={b.image}
                    alt={`${b.title} — sold by FYI Yachts`}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover saturate-[0.75] transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 bg-yacht-brand px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    Sold
                  </span>
                </div>
                <div className="p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">
                    {[b.lengthFt ? `${Math.round(b.lengthFt)} ft` : null, b.year].filter(Boolean).join(' · ')}
                  </p>
                  <h3 className="mt-2 truncate text-[15px] font-medium tracking-wide text-yacht-900">{b.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="bg-yacht-900 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">Your yacht could be next</h2>
            <p className="mt-4 text-[15px] font-light leading-7 text-white/70">
              Tailored marketing, a worldwide buyer network, and brokers who negotiate for a living. Request a free valuation.
            </p>
          </div>
          <PublicInquiryForm context="Sell my yacht (from Sold Yachts page)" dark messagePlaceholder="Tell us about your vessel (optional)" />
        </div>
      </section>
      <StickyCta context="Sold yachts" inquireHref="/contact" label="Free valuation" />
    </PublicShell>
  );
}

const CATEGORY_EYEBROW: Record<string, string> = {
  'featured-listings': 'FYI Exclusive Listings',
};

export function CategoryInventoryPage({ config }: { config: CategoryPage }) {
  usePageMeta(config.title, config.description, `/${config.slug}/`);
  // yachts-for-sale (formerly split out into a separate /worldwide-listings
  // page, merged 2026-08-13 — the two were duplicates, same data, same
  // filters) is explicitly about reaching past FYI's own book, so it gets
  // the full three-tier treatment.
  const worldwide = config.slug === 'yachts-for-sale';
  const faqs = CATEGORY_FAQS[config.slug] ?? [];
  // The two index-style categories are the top of the inventory tree; the
  // rest sit under /yachts-for-sale. Mirrors the crumbs() call for this route
  // in scripts/seoData.ts.
  const topLevel = ['yachts-for-sale', 'featured-listings'].includes(config.slug);
  return (
    <PublicShell>
      {worldwide ? (
        // Motion hero for the flagship inventory page — compact so the search
        // grid stays near the fold. Running shots, helm and marina, which is
        // what an inventory page is selling. Cut from the reel in the Yachting
        // Advisors S3 bucket and re-encoded to the site's hero recipe; checked
        // frame by frame first, it carries no third-party branding.
        <ImagePageHero
          compact
          eyebrow={CATEGORY_EYEBROW[config.slug] ?? 'FYI Yachts Inventory'}
          h1={config.h1}
          intro={config.intro}
          video="/hero/inventory-hero.mp4"
          src="/hero/inventory-hero-poster.jpg"
          sources="/hero/inventory-hero-poster.jpg 1600w"
          alt="A motor yacht underway offshore"
        />
      ) : (
        <PageHero
          eyebrow={CATEGORY_EYEBROW[config.slug] ?? 'FYI Yachts Inventory'}
          h1={config.h1}
          intro={config.intro}
          crumbs={
            topLevel
              ? [{ label: 'Home', href: '/' }, { label: config.h1 }]
              : [{ label: 'Home', href: '/' }, { label: 'Yachts for Sale', href: '/yachts-for-sale' }, { label: config.h1 }]
          }
        />
      )}
      {/* FYI's boats first, then the wider market underneath, scoped to the
          category and hidden while its feed is empty. */}
      <TieredInventory
        filter={config.filter}
        emptyNote="Nothing in this category is listed with us right now — but our brokers source vessels worldwide. Tell us what you're after."
      />
      {worldwide && <WorldwideSourcing />}
      <FaqSection heading={`${config.h1} — frequently asked questions`} faqs={faqs} />
      <CategoryInquiryBand h1={config.h1} slug={config.slug} />
      <RelatedCategories current={config.slug} />
      <StickyCta context={`Category — ${config.h1}`} />
    </PublicShell>
  );
}

/** The inquiry target for a category page's sticky CTA and its own conversion path. */
function CategoryInquiryBand({ h1, slug }: { h1: string; slug: string }) {
  return (
    <section id="inquire" className="scroll-mt-24 bg-yacht-900 px-6 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHead eyebrow="Talk to a broker" title={`Tell us what you want in a ${h1.replace(/s for Sale$/i, '').toLowerCase()}`} dark />
          <p className="mt-6 text-[15px] font-light leading-8 text-white/70">
            Our consultants source vessels well beyond what is listed publicly — including boats whose
            owners have never advertised them. Describe what you&apos;re after and we&apos;ll go find it.
            {' '}{RESPONSE_PROMISE}
          </p>
          <a
            href="tel:+13058546020"
            onClick={() => track('phone_click', { context: `Category — ${h1}`, placement: 'band' })}
            className="mt-8 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-teal transition-colors hover:text-white"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            305-854-6020
          </a>
        </div>
        <div>
          <PublicInquiryForm context={`Inventory — ${h1}`} dark messagePlaceholder={`What are you looking for in a ${slug.replace(/-/g, ' ')}? (optional)`} />
        </div>
      </div>
    </section>
  );
}

/** Closing CTA for the worldwide page — the ask is "tell us what you want". */
function WorldwideSourcing() {
  return (
    <section className="bg-yacht-900 px-6 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
        <div>
          <SectionHead eyebrow="Can't see it here?" title="Tell us what you're looking for" dark />
          <p className="mt-5 max-w-2xl text-[15px] font-light leading-8 text-white/75">
            The listings above are what is publicly on the market today. Give a consultant
            the brief — builder, length, budget, where you want to keep her — and we will
            come back with what is available, including boats that never reach a listing site.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="tel:+13058546020" className="inline-flex items-center gap-2 rounded-full bg-yacht-brand px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-yacht-brand-light">
              <Phone className="h-4 w-4" /> 305-854-6020
            </a>
            <a href="#worldwide-inquiry" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-white hover:bg-white/10">
              Send a brief
            </a>
          </div>
        </div>
        <div id="worldwide-inquiry" className="scroll-mt-24">
          <PublicInquiryForm
            context="Worldwide listings"
            dark
            messagePlaceholder="Builder, length, budget, and where you'd keep her…"
          />
        </div>
      </div>
    </section>
  );
}

/* Small building blocks for the rich brand pages */

export function SectionHead({ eyebrow, title, dark = false, center = false }: { eyebrow?: string; title: string; dark?: boolean; center?: boolean }) {
  return (
    <div className={center ? 'text-center' : ''}>
      {eyebrow && <p className={`text-[11px] font-semibold uppercase tracking-[0.35em] ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`}>{eyebrow}</p>}
      <h2 className={`mt-4 text-2xl font-light tracking-wide lg:text-3xl ${dark ? 'text-white' : 'text-yacht-900'}`}>{title}</h2>
    </div>
  );
}

function Prose({ paras, dark = false }: { paras: string[]; dark?: boolean }) {
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className={`mt-4 text-[15px] font-light leading-8 ${dark ? 'text-white/70' : 'text-yacht-900/75'}`}>{p}</p>
      ))}
    </>
  );
}

const BROWSE_SIZES: [string, string][] = [['0-40', "Under 40'"], ['40-60', "40–60'"], ['60-80', "60–80'"], ['80-999', "80'+"]];
const BROWSE_YEARS: [string, string][] = [['2010', '2010 & newer'], ['2015', '2015 & newer'], ['2020', '2020 & newer']];

function BrandBrowse({ brand }: { brand: BrandPage }) {
  const base = `/yachts-for-sale?make=${encodeURIComponent(brand.name)}`;
  const chip = 'rounded-full border border-yacht-900/15 bg-white px-4 py-2 text-[13px] font-medium text-yacht-900/80 transition-colors hover:border-yacht-brand hover:text-yacht-brand';
  return (
    <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
      <SectionHead eyebrow="Explore the inventory" title={`Search ${brand.name} yachts your way`} />
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/50">By size</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {BROWSE_SIZES.map(([k, label]) => (
              <Link key={k} to={`${base}&length=${k}`} className={chip}>{label}</Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/50">By production year</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {BROWSE_YEARS.map(([k, label]) => (
              <Link key={k} to={`${base}&year=${k}`} className={chip}>{label}</Link>
            ))}
            <Link to={`${base}&condition=new`} className={chip}>New only</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandModels({ brand, models }: { brand: BrandPage; models: { name: string; note?: string }[] }) {
  if (!models.length) return null;
  return (
    <section className="bg-yacht-900 px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHead eyebrow="The lineup" title={`${brand.name} model ranges`} dark />
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {models.map(m => (
            <Link
              key={m.name}
              to={`/yachts-for-sale?make=${encodeURIComponent(brand.name)}`}
              className="group flex flex-col justify-between gap-3 bg-yacht-900 p-6 transition-colors hover:bg-yacht-800"
            >
              <div>
                <h3 className="text-lg font-light tracking-wide text-white">{m.name}</h3>
                {m.note && <p className="mt-2 text-[13px] font-light leading-6 text-white/60">{m.note}</p>}
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.15em] text-yacht-teal opacity-0 transition-opacity group-hover:opacity-100">
                View listings <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BrandVideo({ brand, video }: { brand: BrandPage; video: string }) {
  return (
    <section className="bg-yacht-900 px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHead eyebrow="Watch" title={`${brand.name} on film`} dark center />
        <div className="mt-10 aspect-video overflow-hidden rounded-lg border border-white/10 shadow-2xl">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video}`}
            title={`${brand.name} official yacht film`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}

// "Speak to a specialist" and the new-listing alert sign-up are one dark band
// now (client direction) — they were two separate CTAs stacked back to back,
// which read as a wall of asks. Contact sits on top, the alert form below a
// hairline inside the same panel.
function SpecialistStrip({ brand }: { brand: BrandPage }) {
  return (
    <section className="bg-yacht-900 px-6 py-14 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">Speak to a specialist</p>
            <h2 className="mt-3 text-xl font-light tracking-wide text-white lg:text-2xl">Talk to a {brand.name} expert</h2>
            <p className="mt-2 max-w-xl text-[14px] font-light leading-7 text-white/70">From private inspections to a free market survey, our team guides you at every step of the buying process.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="tel:+13058546020" className="inline-flex items-center gap-2 rounded-full bg-yacht-brand px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-yacht-brand-light">
              <Phone className="h-4 w-4" /> 305-854-6020
            </a>
            <a href="https://wa.me/17863538073" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:border-yacht-teal hover:text-yacht-teal">
              WhatsApp
            </a>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-10">
          <BrandAlertSignup brand={brand.name} />
        </div>
      </div>
    </section>
  );
}

function FinanceInspectCallouts() {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-16 sm:grid-cols-2 lg:px-8">
      <div className="flex flex-col justify-between gap-6 rounded-lg bg-yacht-900 p-8">
        <div>
          <TrendingUp className="h-7 w-7 text-yacht-teal" />
          <h3 className="mt-4 text-xl font-light tracking-wide text-white">Explore financing options</h3>
          <p className="mt-3 text-[14px] font-light leading-7 text-white/70">Flexible marine-finance plans designed to make ownership more accessible — coordinated under one roof with your purchase.</p>
        </div>
        <Link to="/yacht-financing" className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.15em] text-yacht-teal hover:text-white">
          Start your financing journey <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex flex-col justify-between gap-6 rounded-lg border border-yacht-900/10 bg-white p-8">
        <div>
          <FileCheck2 className="h-7 w-7 text-yacht-brand" />
          <h3 className="mt-4 text-xl font-light tracking-wide text-yacht-900">Free inspection & market survey</h3>
          <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">Let us arrange a complimentary inspection or market survey tailored to the vessel you’re considering.</p>
        </div>
        <Link to="/contact" className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.15em] text-yacht-brand hover:text-yacht-900">
          Book now <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// The left column of the marque section — a real photo of a real boat of that
// marque, picked as the flagship (priciest, then longest) hull available.
//
// The source cascades so EVERY brand gets a photo, not just the ones FYI has
// in stock: FYI's own inventory first, then the BoatsGroup worldwide feed.
// Both are feeds this page already renders further down, and their image
// hosts are already whitelisted in vercel.json — so nothing new is hotlinked
// or rehosted. The logo stands in while the feeds load, and on the brands
// neither can cover.
function pickFlagship(boats: PublicBoat[], match: string): PublicBoat | null {
  const withPhoto = boats.filter((b) => b.image && b.make?.toLowerCase().includes(match));
  if (!withPhoto.length) return null;
  const rank = (b: PublicBoat) => [b.priceUsd ?? -1, b.lengthFt ?? -1] as const;
  return withPhoto.reduce((best, b) => {
    const [bp, bl] = rank(b);
    const [cp, cl] = rank(best);
    return bp > cp || (bp === cp && bl > cl) ? b : best;
  });
}

function BrandMarqueImage({ brand }: { brand: BrandPage }) {
  const filter = useMemo(() => (b: PublicBoat) => b.make.toLowerCase().includes(brand.match), [brand.match]);
  const { boats } = useInventory(filter);
  const own = useMemo(() => pickFlagship(boats, brand.match), [boats, brand.match]);
  const [fallback, setFallback] = useState<PublicBoat | null>(null);

  // Only reach for the worldwide feeds when FYI's own inventory has nothing of
  // this marque to show.
  useEffect(() => {
    if (own) return;
    let alive = true;
    (async () => {
      const bg = await fetchWorldwideBoatsGroup(brand.name).catch(() => [] as PublicBoat[]);
      if (alive) setFallback(pickFlagship(bg, brand.match));
    })();
    return () => { alive = false; };
  }, [own, brand.name, brand.match]);

  const hero = own ?? fallback;

  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border border-yacht-900/10 bg-white shadow-sm lg:aspect-[5/4]">
      {hero?.image ? (
        <>
          <img
            src={optImg(hero.image, 1000)}
            srcSet={srcSet(hero.image, [640, 1000, 1400])}
            sizes="(min-width:1024px) 50vw, 100vw"
            alt={`${hero.year ? `${hero.year} ` : ''}${hero.title} — a ${brand.name} listed with FYI Yachts`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {brand.logo && (
            <img
              src={brand.logo}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute left-5 top-5 h-7 w-auto max-w-[140px] object-contain opacity-90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] invert"
            />
          )}
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yacht-900/85 to-transparent px-5 pb-4 pt-10 text-[12px] font-light tracking-wide text-white">
            {hero.year ? `${hero.year} ` : ''}{hero.title}
          </p>
        </>
      ) : brand.logo ? (
        <img
          src={brand.logo}
          alt={`${brand.name} logo`}
          loading="lazy"
          className="max-h-32 w-auto max-w-full object-contain p-12"
        />
      ) : (
        <span className="p-12 text-center text-3xl font-light tracking-[0.2em] text-yacht-900/70 lg:text-4xl">
          {brand.name.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function BrandInventoryPage({ brand }: { brand: BrandPage }) {
  const detail = useMemo(() => getBrandDetail(brand.name, brand.blurb), [brand.name, brand.blurb]);
  // Same helpers the prerenderer uses, so the served <head> and the SPA's own
  // meta can't drift apart on a page whose whole problem is its search snippet.
  usePageMeta(
    brandSeoTitle(brand),
    brandSeoDescription(brand, brand.blurb),
    `/${brand.slug}/`,
  );
  const filter = useMemo(() => (b: PublicBoat) => b.make.toLowerCase().includes(brand.match), [brand.match]);
  return (
    <PublicShell>
      <header className="bg-yacht-900 px-6 pb-16 pt-32 lg:pt-40">
        <div className="mx-auto max-w-7xl lg:px-2">
          <Breadcrumbs
            dark
            className="mb-6"
            items={[
              { label: 'Home', href: '/' },
              { label: 'Yachts for Sale', href: '/yachts-for-sale' },
              { label: `${brand.name} Yachts` },
            ]}
          />
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-8 lg:px-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">Featured Brand</p>
            <h1 className="mt-4 text-3xl font-light leading-snug tracking-wide text-white lg:text-5xl">
              {brand.name} Yachts for Sale
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] font-light leading-7 text-white/70">{detail.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#inventory" className="inline-flex items-center gap-2 rounded-full bg-yacht-brand px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-yacht-brand-light">
                Explore all {brand.name}s <ArrowRight className="h-4 w-4" />
              </a>
              <a href="tel:+13058546020" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:border-yacht-teal hover:text-yacht-teal">
                <Phone className="h-4 w-4" /> Contact a specialist
              </a>
            </div>
          </div>
          {brand.logo && (
            <img src={brand.logo} alt={`${brand.name} logo`} className="h-12 w-auto max-w-[220px] object-contain opacity-80 invert" loading="lazy" />
          )}
        </div>
      </header>

      {/* Keyword-bearing copy sits ABOVE the inventory grid so the rendered DOM
          leads with text, not listing cards. (The prerendered HTML crawlers
          fetch already opens with the h1 + this copy — the grid is client-side
          only — but Google renders JS, so the visible order matters too.) The
          remaining depth stays below the fleet. */}
      <section className="bg-yacht-cream py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <BrandMarqueImage brand={brand} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">The marque</p>
            <h2 className="mt-4 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">
              {brand.name} yachts for sale with FYI
            </h2>
            <Prose paras={detail.intro.slice(0, 1)} />
          </div>
        </div>
      </section>

      <BrandBrowse brand={brand} />

      <div id="inventory" className="scroll-mt-24" />
      {/* FYI's own boats first, then the worldwide tiers (which hide when their
          feeds are empty — see TieredInventory). */}
      <TieredInventory
        make={brand.name}
        filter={filter}
        emptyNote={`No ${brand.name} is listed with us at this moment — but as brokers with direct brand relationships we can source your ${brand.name} on or off market.`}
      />

      {/* Contact + new-listing alerts, one dark band. */}
      <SpecialistStrip brand={brand} />

      {/* Brand introduction (continued) — left-aligned on the page grid, not a
          centered column, so it lines up with every other section. */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <SectionHead eyebrow="The marque" title={`Yachting adventures await with ${brand.name}`} />
        <div className="max-w-3xl">
          <Prose paras={detail.intro.slice(1)} />
        </div>
      </section>

      {detail.video && <BrandVideo brand={brand} video={detail.video} />}

      {/* What sets it apart */}
      <section className="bg-white px-6 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHead eyebrow="Engineering" title={`What sets ${brand.name} apart`} />
            <Prose paras={[detail.apart]} />
            <p className="mt-6 text-[14px] font-light leading-7 text-yacht-900/70">{detail.build}</p>
          </div>
          <ul className="grid content-start gap-4 self-center">
            {detail.apartPoints.map(pt => (
              <li key={pt} className="flex items-start gap-4 text-[15px] font-light leading-7 text-yacht-900/80">
                <span className="mt-3 h-px w-6 shrink-0 bg-yacht-brand" aria-hidden="true" />{pt}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <BrandModels brand={brand} models={detail.models} />

      {/* Versatile uses */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <SectionHead eyebrow="On the water" title={`Ways owners run their ${brand.name}`} center />
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {detail.uses.map(u => (
            <div key={u.title} className="border-t-2 border-yacht-brand pt-5">
              <h3 className="text-lg font-light tracking-wide text-yacht-900">{u.title}</h3>
              <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      <FinanceInspectCallouts />

      <FaqSection heading={`${brand.name} yachts — frequently asked questions`} faqs={detail.faqs} dark />

      {/* Closing CTA */}
      <section className="bg-yacht-cream px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Your next horizon</p>
          <h2 className="mt-4 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">Your {brand.name}, made real</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] font-light leading-8 text-yacht-900/75">{detail.closing}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="tel:+13058546020" className="inline-flex items-center gap-2 rounded-full bg-yacht-900 px-7 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-yacht-brand">
              <Phone className="h-4 w-4" /> Call a {brand.name} expert
            </a>
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-yacht-900/20 px-7 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand">
              Contact a specialist <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <RelatedBrands current={brand.slug} />
      <StickyCta context={`Brand — ${brand.name}`} inquireHref="/contact" label="Contact" />
    </PublicShell>
  );
}

function RelatedCategories({ current }: { current: string }) {
  const others = CATEGORY_PAGES.filter(c => c.slug !== current).slice(0, 6);
  return (
    <nav aria-label="More inventory" className="border-t border-yacht-900/10 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-x-8 gap-y-3 px-6 py-8 lg:px-8">
        {others.map(c => (
          <a key={c.slug} href={`/${c.slug}`} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-900/60 transition-colors hover:text-yacht-brand">
            {c.h1}
          </a>
        ))}
      </div>
    </nav>
  );
}

function RelatedBrands({ current }: { current: string }) {
  const seen = new Set<string>();
  const others = BRAND_PAGES.filter(b => {
    if (b.slug === current || seen.has(b.name)) return false;
    seen.add(b.name);
    return true;
  }).slice(0, 12);
  return (
    // An even grid of logo tiles, so the marques line up in columns instead of
    // wrapping into ragged rows of differently-sized words. Brands without a
    // logo fall back to their name inside the same tile, keeping the grid
    // intact.
    <nav aria-label="More brands" className="border-t border-yacht-900/10 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">More brands</p>
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-yacht-900/10 bg-yacht-900/10 sm:grid-cols-3 lg:grid-cols-6">
          {others.map(b => (
            <a
              key={b.slug}
              href={`/${b.slug}`}
              className="group flex h-24 items-center justify-center bg-white px-4 transition-colors hover:bg-yacht-cream"
            >
              {b.logo ? (
                <img
                  src={b.logo}
                  alt={b.name}
                  loading="lazy"
                  className="max-h-8 w-auto max-w-full object-contain opacity-55 transition-opacity group-hover:opacity-100"
                />
              ) : (
                <span className="text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-900/60 transition-colors group-hover:text-yacht-brand">
                  {b.name}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------- service pages */

const IMG = {
  charterHero: 'https://storage.googleapis.com/fyiyachts/2025/06/FEATURED-CHARTER.jpg',
  charterGuests: 'https://storage.googleapis.com/fyiyachts/2025/06/charter-2.jpg',
  sell: 'https://images.boatsgroup.com/resize/1/15/6/2017-azimut-95-raised-pilothouse-power-9601506-20241103080955176-1_XLARGE.jpg?w=1200&h=675',
  team: 'https://storage.googleapis.com/fyiyachts/2025/09/jpeg-optimizer_1FYI-Team-2025-1-1.jpeg',
  newBuild: 'https://images.boatsgroup.com/images/1/66/6/9206606_20240124131432534_1_XLARGE.jpg',
};

// Padding on the section, max-width on an inner wrapper — the same shell every
// other section uses, so their content edges line up. (Putting px-6 on the
// max-w-7xl element itself insets the content by an extra 24px and reads as a
// misaligned section.)
export function SplitSection({ image, alt, children, flip = false }: { image: string; alt: string; children: ReactNode; flip?: boolean }) {
  return (
    <section className="px-6 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className={flip ? 'lg:order-2' : ''}>
          <div className="aspect-[4/3] overflow-hidden">
            <img src={image} alt={alt} loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>
        <div className={flip ? 'lg:order-1' : ''}>{children}</div>
      </div>
    </section>
  );
}

/* Live recently-sold proof strip for the sell page — the strongest seller-side
   social proof we have: real closings from the feed, largest first. */
function RecentlySoldStrip() {
  const [boats, setBoats] = useState<PublicBoat[]>([]);
  useEffect(() => {
    let alive = true;
    fetch('/api/yachts/proxy?salesstatus=sold&rows=400')
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        const items: unknown[] = Array.isArray(d?.results) ? d.results : [];
        setBoats(
          items
            .map(it => normalizePublicBoat(it as Record<string, any>))
            .filter((b): b is PublicBoat => b !== null && !!b.image && (b.lengthFt ?? 0) > 0)
            .sort((a, b) => (b.lengthFt ?? 0) - (a.lengthFt ?? 0))
            .slice(0, 8),
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!boats.length) return null;
  return (
    <section id="recently-sold" className="scroll-mt-24 bg-white px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Proven results" title="Recently sold by FYI" />
          <Link to="/sold-yachts" className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-brand hover:text-yacht-900">
            All sold yachts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {boats.map(b => (
            <figure key={b.id} className="group relative aspect-[4/3] overflow-hidden bg-yacht-900/5">
              <img
                src={optImg(b.image, 640)}
                alt={`Sold: ${b.year ?? ''} ${b.make} ${b.model}`.trim()}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yacht-900/85 to-transparent px-4 pb-3 pt-10">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-teal">Sold</span>
                <span className="block truncate text-[13px] font-light text-white">
                  {[b.lengthFt ? `${Math.round(b.lengthFt)}′` : '', b.make, b.model].filter(Boolean).join(' ')}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SellPage() {
  usePageMeta(
    'Sell Your Yacht | FYI Yachts — List With Miami’s Brokerage',
    'Sell your yacht faster with FYI Yachts — tailored marketing, worldwide buyer network, and expert representation from Coral Gables.',
    '/sell/',
    [{ hreflang: 'en', path: '/sell/' }, { hreflang: 'es', path: '/es/vender/' }, { hreflang: 'x-default', path: '/sell/' }],
  );
  const process: [string, string][] = [
    ['Free valuation', 'Share the make, model, and year. We answer with a market read priced from three decades of local closings and live comparable-sale data — not a national average.'],
    ['Preparation & presentation', 'Cinematic photography and video, editorial copy, and staging guidance. Your vessel goes to market looking like the flagship listing at the top of this page.'],
    ['Global marketing', 'Syndication across the major brokerage networks, our own channels reaching 50,000+ people a day, and direct outreach to a screened worldwide buyer list.'],
    ['Negotiation & closing', 'Brokers who negotiate for a living qualify every buyer, then FYI’s in-house closing services run escrow, documentation, titling, and registration end to end.'],
  ];
  const marketing: [typeof Camera, string, string][] = [
    [Camera, 'Cinematic media', 'Professional photography, video, and drone work — the presentation standard you just scrolled through.'],
    [Globe2, 'Worldwide syndication', 'Placement across the major brokerage networks and MLS platforms where serious buyers actually search.'],
    [Megaphone, '50,000+ daily reach', 'FYI’s own site, social channels, and email programs put your vessel in front of tens of thousands every day.'],
    [Users, 'Direct buyer outreach', 'Three decades of buyer relationships — your consultant calls the owners who trade up in your size range.'],
    [Anchor, 'Boat-show presence', 'Miami’s flagship shows and on-the-dock exposure through our Coral Gables and Coconut Grove base.'],
    [Sparkles, 'AI-era visibility', 'Structured listing data built so AI search engines can find, quote, and recommend your yacht — not just Google.'],
  ];
  const stats: [string, string][] = [
    ['300+', 'years of combined brokerage experience'],
    ['30', 'years selling yachts from Miami since 1994'],
    ['50k+', 'people reached daily across FYI channels'],
    ['0', 'upfront fees — commission only on a successful sale'],
  ];
  return (
    <PublicShell>
      {/* Scroll-scrubbed cinematic (ported from alexgclarke) — the scenes are a
          live FYI listing, the Technema 90 (/listing/9851928). */}
      <SellScrollHero />
      <PageHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Sell Your Yacht' }]}
        eyebrow="List Your Yacht"
        h1="Sell Your Yacht With FYI"
        intro="Tailored marketing, a worldwide buyer network, and brokers who negotiate for a living. Vessels listed with FYI sell faster — and closer to asking."
      />

      {/* Stats band */}
      <section className="border-y border-yacht-900/10 bg-white px-6 py-10 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map(([n, label]) => (
            <div key={label}>
              <p className="text-3xl font-light tracking-wide text-yacht-900 lg:text-4xl">{n}</p>
              <p className="mt-2 text-[13px] font-light leading-6 text-yacht-900/60">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process timeline */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
        <SectionHead eyebrow="How it works" title="From valuation to closing day" />
        <ol className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {process.map(([title, body], i) => (
            <li key={title} className="relative border-t-2 border-yacht-brand pt-5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/40">Step {i + 1}</span>
              <h3 className="mt-2 text-lg font-light tracking-wide text-yacht-900">{title}</h3>
              <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">{body}</p>
            </li>
          ))}
        </ol>
        </div>
      </section>

      <SplitSection image={IMG.sell} alt="An Azimut Grande 30M listed by FYI Yachts off the Miami skyline">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Why owners choose FYI</p>
        <h2 className="mt-4 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">Marketing that moves vessels</h2>
        <ul className="mt-7 space-y-4">
          {[
            'Professional photography, video, and listing syndication worldwide',
            'Qualified-buyer screening — sea trials only with serious parties',
            'Pricing guidance from live market data, not guesswork',
            'Closing, escrow, and documentation handled end to end',
          ].map(item => (
            <li key={item} className="flex items-start gap-4 text-[15px] font-light leading-7 text-yacht-900/75">
              <span className="mt-3 h-px w-6 shrink-0 bg-yacht-brand" aria-hidden="true" />{item}
            </li>
          ))}
        </ul>
      </SplitSection>

      {/* Everything your listing gets */}
      <section className="bg-yacht-900 px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHead eyebrow="The FYI listing package" title="Everything your listing gets" dark />
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {marketing.map(([Icon, title, body]) => (
              <div key={title}>
                <Icon className="h-6 w-6 text-yacht-teal" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-light tracking-wide text-white">{title}</h3>
                <p className="mt-3 text-[14px] font-light leading-7 text-white/65">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RecentlySoldStrip />

      {/* Trade-up / cross-sell band */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-16 sm:grid-cols-3 lg:px-8">
        {([
          ['Selling to trade up?', 'Your consultant coordinates the sale of your current vessel with the purchase of the next, so the timing works in your favor.', 'Browse the inventory', '/yachts-for-sale'],
          ['Buyer needs financing?', 'Deals close faster when lending is under the same roof — FYI coordinates marine finance for your buyer alongside the sale.', 'Yacht financing', '/yacht-financing'],
          ['Exploring lease-to-own?', 'FYI’s lease-to-own program widens your vessel’s buyer pool beyond cash purchasers — ask how it applies to your listing.', 'Lease-to-own', '/lease-to-own'],
        ] as [string, string, string, string][]).map(([title, body, cta, href]) => (
          <div key={title} className="flex flex-col justify-between gap-5 border border-yacht-900/10 bg-white p-7">
            <div>
              <h3 className="text-lg font-light tracking-wide text-yacht-900">{title}</h3>
              <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">{body}</p>
            </div>
            <Link to={href} className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-brand hover:text-yacht-900">
              {cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </section>

      <section id="valuation" className="scroll-mt-24 bg-yacht-900 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">Request a free valuation</h2>
            <p className="mt-4 text-[15px] font-light leading-7 text-white/70">
              Share the make, model, and year — we&rsquo;ll respond with a market read and a listing plan.
            </p>
          </div>
          <PublicInquiryForm context="Sell my yacht" dark />
        </div>
      </section>
      <FaqSection heading="Selling your yacht — FAQs" faqs={SELL_FAQS} />
      <StickyCta context="Sell my yacht" label="Free valuation" />
    </PublicShell>
  );
}

export function FinancingPage() {
  usePageMeta(
    'Yacht Financing | FYI Yachts',
    'Yacht financing made easy — marine lending structured around your purchase, 10-to-20-year terms, insurance guidance, lease-to-own and cryptocurrency options from FYI Yachts in Miami.',
    '/yacht-financing/',
  );
  const steps: [string, string][] = [
    ['Pre-qualify', 'A five-minute conversation about the vessel, budget, and timeline. We match you with lenders from our vetted marine-finance network — before you fall in love with the boat.'],
    ['Offer & survey', 'Make your offer with financing confidence. We coordinate the marine survey and sea trial the lender will want, on your schedule.'],
    ['Underwriting & documentation', 'Marine loans are their own specialty — coverage provisions, USCG or state documentation, flag questions. Our team shepherds every page alongside the lender.'],
    ['Closing day', "Escrow, titling, registration, and insurance binding handled by FYI's in-house closing services. You take the helm; we file the paperwork."],
  ];
  const options: [string, string, string | null][] = [
    ['Traditional marine mortgage', 'Fixed-rate loans built for vessels: typically 10-to-20-year terms with 10–20% down, for new and pre-owned boats, US and foreign flag.', null],
    ['Lease-to-own', "FYI's flexible path to the helm — start on the water now and navigate toward ownership, with cryptocurrency payments accepted.", '/lease-to-own'],
    ['Cryptocurrency settlement', 'Bitcoin, Ethereum, and major stablecoins accepted across our programs — a Miami-first advantage for digital-asset buyers.', '/lease-to-own'],
    ['Refinance & equity', 'Already own? Rates move, boats appreciate in scarcity markets. Ask a specialist whether refinancing your current vessel makes sense.', '/contact'],
  ];
  const faqs: [string, string][] = [
    ['Is boat financing harder to get than a car loan?', 'Yes — boat and yacht financing is harder to get than typical vehicle financing. Loans come in all shapes and sizes, and a lot depends on the boat and your creditworthiness. Working with companies that specialize in marine lending means you see the options that fit before applying, so you don\u2019t end up being denied.'],
    ['What loan terms are typical for a yacht?', 'Typical structures run 10-to-20-year terms with 10\u201320% down, for both new and pre-owned vessels. Boat and yacht loans are specifically designed for this type of asset and include special coverages and provisions a generic loan won\u2019t have.'],
    ['Does the type of boat change the financing?', 'It does — obtaining a loan for a motorboat is different from obtaining one for a sailboat, and vessels used commercially (including charter) are treated differently from pleasure craft. Zeroing in on the right structure for your exact vessel is where a specialist earns their keep.'],
    ['Do I need insurance before I can close?', 'Lenders require coverage to be bound at closing. Insurance requirements vary with where you register and operate the yacht, and whether you use it privately or for charter \u2014 FYI helps you locate the right policy and binds it in step with the loan so closing day stays on schedule.'],
    ['Can FYI arrange financing and the purchase together?', 'That\u2019s the point of doing it under one roof: survey, insurance, documentation, and lending are coordinated by the same team handling your purchase, through a well-vetted network of marine-finance specialists. Call 305-854-6020 and a FYI finance specialist will walk you through it.'],
  ];
  return (
    <PublicShell>
      <PageHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Yacht Financing' }]}
        eyebrow="Financing"
        h1="Yacht Financing Made Easy"
        intro="Financing a boat or a yacht in Miami can be a little challenging — fortunately, FYI has helped many clients obtain loans through a well-vetted network of marine-finance specialists. Competitive rates, 10-to-20-year terms, and brokers who shepherd the paperwork alongside the purchase."
      />

      {/* Calculator + inquiry */}
      <section className="mx-auto grid max-w-7xl items-start gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">What to expect</p>
          <h2 className="mt-4 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">From offer to ownership</h2>
          <ul className="mt-7 space-y-4">
            {[
              'Typical structures: 10\u201320 year terms with 10\u201320% down',
              'New and pre-owned vessels, US and foreign flag',
              'Survey, insurance, and documentation coordinated with lending',
              'Lease-to-own and cryptocurrency settlement available \u2014 ask us',
            ].map(item => (
              <li key={item} className="flex items-start gap-4 text-[15px] font-light leading-7 text-yacht-900/75">
                <span className="mt-3 h-px w-6 shrink-0 bg-yacht-brand" aria-hidden="true" />{item}
              </li>
            ))}
          </ul>
          <div className="mt-10 border-t border-yacht-900/10 pt-8">
            <PublicInquiryForm context="Yacht financing" messagePlaceholder="Tell us about the vessel or budget (optional)" />
          </div>
        </div>
        <FinanceCalculator tone="light" />
      </section>

      {/* How it works */}
      <section className="bg-white px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">How It Works</p>
          <h2 className="mt-4 text-center text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">Four steps to the helm</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, text], i) => (
              <div key={title}>
                <span className="font-serif text-4xl italic text-yacht-brand/40">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-[15px] font-medium tracking-wide text-yacht-900">{title}</h3>
                <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Financing options */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Ways To Structure It</p>
        <h2 className="mt-4 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">Four routes to ownership</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {options.map(([title, text, href]) => (
            <div key={title} className="flex flex-col border border-yacht-900/10 bg-white p-8">
              <h3 className="text-lg font-light tracking-wide text-yacht-900">{title}</h3>
              <p className="mt-3 flex-1 text-[14px] font-light leading-7 text-yacht-900/70">{text}</p>
              {href && (
                <a href={href} className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-brand transition-colors hover:text-yacht-brand-light">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Yacht insurance (verbatim themes from the live WP page) */}
      <section className="bg-yacht-900 px-6 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">Protect The Investment</p>
            <h2 className="mt-4 text-2xl font-light tracking-wide text-white lg:text-3xl">Yacht insurance</h2>
            <p className="mt-6 text-[15px] font-light leading-8 text-white/70">
              Buying a yacht is an investment and you&rsquo;ll want to protect it. Whether you&rsquo;re purchasing an
              older motor yacht, a modern express cruiser, a sportfish or even a sailboat, we help you locate the right
              policy &mdash; and our brokers have expertise in turning the fine print into words that make sense.
            </p>
            <p className="mt-4 text-[15px] font-light leading-8 text-white/70">
              Requirements vary with where you register and operate your yacht, and whether you use it privately or for
              charter. At FYI, we make sure you&rsquo;re completely covered for every usage scenario in your plan.
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <PublicInquiryForm context="Yacht insurance quote" dark messagePlaceholder="Vessel type and how you plan to use it (optional)" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16 lg:px-0">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Questions, Answered</p>
        <h2 className="mt-4 text-center text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">Yacht financing FAQs</h2>
        <div className="mt-10">
          {faqs.map(([q, a]) => (
            <details key={q} className="group border-b border-yacht-900/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium tracking-wide text-yacht-900 [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-yacht-brand transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-4 text-[14px] font-light leading-7 text-yacht-900/70">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-10 text-center text-[14px] font-light leading-7 text-yacht-900/60">
          Speak to a financing expert at{' '}
          <a href="tel:+13058546020" className="font-semibold text-yacht-brand">305-854-6020</a>
          {' '}&mdash; a FYI finance specialist will answer all of your boat loan questions.
        </p>
      </section>
      <StickyCta context="Yacht financing" inquireHref="/contact" label="Contact" />
    </PublicShell>
  );
}

export function LeaseToOwnPage() {
  usePageMeta(
    'Lease-to-Own Yachts & Boats in Miami | FYI Yachts',
    'Lease-to-own a yacht with FYI in Miami: start on the water now and navigate toward ownership, with flexible terms and cryptocurrency settlement accepted.',
    '/lease-to-own/',
  );
  return (
    <PublicShell>
      <PageHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Yacht Financing', href: '/yacht-financing' }, { label: 'Lease-to-Own' }]}
        eyebrow="Flexible Ownership"
        h1="Lease-to-Own"
        intro="Own the experience before you own the hull. FYI's lease-to-own program pairs flexible terms with modern settlement — including cryptocurrency — so you step aboard sooner."
      />
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Handshake, title: 'Flexible entry', copy: 'Structured lease terms with a defined path to title — without the traditional lump-sum start.' },
            { icon: TrendingUp, title: 'Equity as you cruise', copy: "Payments build toward ownership while you're already living the boating calendar." },
            { icon: Bitcoin, title: 'Modern settlement', copy: 'Cryptocurrency payment options for qualified transactions — a first in this market.' },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="border border-yacht-900/10 bg-white p-8">
              <Icon className="h-6 w-6 text-yacht-brand" />
              <h2 className="mt-4 text-lg font-semibold text-yacht-900">{title}</h2>
              <p className="mt-2 text-[14px] font-light leading-7 text-yacht-900/70">{copy}</p>
            </div>
          ))}
        </div>
      </section>
      <FaqSection heading="Lease-to-own — frequently asked questions" faqs={LEASE_FAQS} />
      <StickyCta context="Lease-to-own" inquireHref="/contact" label="Contact" />
      <section className="bg-yacht-900 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">See if lease-to-own fits</h2>
            <p className="mt-4 text-[15px] font-light leading-7 text-white/70">A broker will walk you through terms, vessels that qualify, and the path to title.</p>
          </div>
          <PublicInquiryForm context="Lease-to-own" dark />
        </div>
      </section>
    </PublicShell>
  );
}

export function AboutPage() {
  usePageMeta(
    'About Us | FYI Yachts — Florida Yachts International',
    'Florida Yachts International: 300+ years of combined brokerage expertise in Coral Gables — buying, selling, chartering, and building yachts worldwide.',
    '/about-us/',
  );
  return (
    <PublicShell>
      <PageHero
        eyebrow="About Florida Yachts International"
        h1="We Make Your Yachting Dreams Come True"
        intro="From our Coral Gables headquarters, FYI pairs discerning owners with exceptional vessels — brokerage, charter, new construction, and financing under one roof."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'About Us' }]}
      />
      <SplitSection image={IMG.team} alt="The FYI Yachts team outside the Florida Yachts International office" flip>
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Who we are</p>
        <h2 className="mt-4 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">Three centuries of combined time on the water</h2>
        <p className="mt-6 text-[15px] font-light leading-8 text-yacht-900/75">
          Our consultants have run sportfish tournaments, delivered superyachts across the Atlantic, and closed
          thousands of transactions. That experience — plus direct relationships with 30+ builders — is what
          you hire when you work with FYI.
        </p>
        {/* min-w-0 + break-words are load-bearing on narrow phones: grid items
            default to min-width:auto, so "Worldwide" at text-2xl set the column's
            floor and pushed the whole page ~30px wider than the viewport at
            320px. The gap tightens below sm to buy the columns more room. */}
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-yacht-900/10 pt-8 text-center sm:gap-6">
          {[['300+', 'yrs combined expertise'], ['30+', 'featured brands'], ['Worldwide', 'inventory & buyers']].map(([v, l]) => (
            <div key={l} className="min-w-0">
              <p className="break-words text-2xl font-light text-yacht-900">{v}</p>
              <p className="mt-1 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-yacht-900/45 sm:tracking-[0.2em]">{l}</p>
            </div>
          ))}
        </div>
        <a href="/our-team" className="group mt-8 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-yacht-brand transition-colors hover:text-yacht-900">
          Meet our consultants <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </a>
      </SplitSection>
      <TestimonialsSection />
      <FaqSection heading="About FYI — frequently asked questions" faqs={ABOUT_FAQS} />
      <OfficeMap heading="Visit us" />
      <StickyCta context="About Us" inquireHref="/contact" label="Contact" />
    </PublicShell>
  );
}

export function ContactPage() {
  usePageMeta(
    'Contact Us | FYI Yachts',
    'Contact FYI Yachts — 2424 Coral Way, Miami, FL. Call 305-854-6020 or send an inquiry; a broker responds within one business day.',
    '/contact/',
  );
  return (
    <PublicShell>
      <PageHero
        eyebrow="Contact"
        h1="Begin the Conversation"
        intro={`Buying, selling, chartering, or just curious what your boat is worth — ${RESPONSE_PROMISE.charAt(0).toLowerCase()}${RESPONSE_PROMISE.slice(1, -1)}.`}
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
      />
      <section id="inquire" className="mx-auto grid max-w-7xl scroll-mt-24 gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div className="space-y-8">
          <a href="tel:+13058546020" className="flex items-center gap-5">
            <span className="flex h-12 w-12 items-center justify-center border border-yacht-900/15"><Phone className="h-5 w-5 text-yacht-brand" /></span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">Call us</span>
              <span className="mt-1 block text-lg font-light tracking-wider text-yacht-900">305-854-6020</span>
            </span>
          </a>
          <a href="https://wa.me/17863538073" target="_blank" rel="noreferrer" className="flex items-center gap-5">
            <span className="flex h-12 w-12 items-center justify-center border border-yacht-900/15"><Phone className="h-5 w-5 text-yacht-teal" /></span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">WhatsApp</span>
              <span className="mt-1 block text-lg font-light tracking-wider text-yacht-900">(786) 353-8073</span>
            </span>
          </a>
          {/* The address is now a directions link, not dead text — see OfficeMap. */}
          <a
            href={GOOGLE_DIRECTIONS}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('directions_click', { provider: 'google', placement: 'contact-details' })}
            className="group flex items-center gap-5"
          >
            <span className="flex h-12 w-12 items-center justify-center border border-yacht-900/15 transition-colors group-hover:border-yacht-brand"><MapPin className="h-5 w-5 text-yacht-brand" /></span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">Headquarters</span>
              <span className="mt-1 block text-lg font-light tracking-wide text-yacht-900 transition-colors group-hover:text-yacht-brand">{OFFICE_ADDRESS}</span>
              <span className="mt-1 block text-[12px] font-light text-yacht-900/50 underline">Get directions</span>
            </span>
          </a>

          <p className="border-t border-yacht-900/10 pt-8 text-[14px] font-light leading-7 text-yacht-900/65">
            {RESPONSE_PROMISE} Your inquiry goes to the consultant who knows the vessel or the market
            segment you asked about — not a shared inbox.
          </p>
        </div>
        <div className="border border-yacht-900/10 bg-white p-8 lg:p-10">
          <PublicInquiryForm context="General" />
        </div>
      </section>
      <OfficeMap />
      <FaqSection heading="Getting in touch — frequently asked questions" faqs={CONTACT_FAQS} />
      <TestimonialsSection heading="What clients say after working with us" dark />
      <StickyCta context="Contact" />
    </PublicShell>
  );
}
