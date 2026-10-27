import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Anchor,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Linkedin,
  MapPin,
  Menu,
  Mic,
  Phone,
  Quote,
  Search,
  X,
  Youtube,
} from 'lucide-react';
import FYILogo from '../layout/FYILogo';
import BriannaWidget from '../chat/BriannaWidget';
import { optImg, srcSet } from '../../utils/img';
import { track as trackEvent } from '../../utils/analytics';
import { getAttribution } from '../../utils/attribution';
import { useFormGuard, guardFields, HoneypotField } from '../../utils/formGuard';
import { identifyVisitor } from '../../utils/hubspotTracking';
import { VOICE_SEARCH_ENABLED, SPANISH_ENABLED } from '../../utils/featureFlags';
import { languageToggleTarget } from '../es/esRoutes';
import { FYI_TEAM, repKey } from '../team/fyiTeam';
import { BRAND_PAGES, CATEGORY_PAGES, brandMake, soldWindowStart, withinSoldWindow } from '../public/publicData';
import { CHARTER_FLEET, CHARTER_FROM_PRICE, fromRate } from '../public/charterFleet';
import { TESTIMONIALS } from '../public/testimonials';
import { FaqSection } from '../public/Faq';
import { GENERAL_FAQS } from '../public/categoryFaqs';
import { StickyCta } from '../public/StickyCta';
import { RESPONSE_PROMISE } from '../public/responsePromise';
import { GOOGLE_DIRECTIONS } from '../public/OfficeMap';
import { collapseRelistedHulls } from '../../utils/collapseRelistedHulls';

/**
 * FYIyachts.com homepage redesign concept.
 *
 * Mounted at the public root route / (the authenticated dashboard app
 * lives under /app). Art direction borrows from ritzcarlton.com (full-bleed
 * imagery, editorial pacing, wide-tracked uppercase eyebrows, restrained
 * hairline rules) while staying strictly on FYI brand: navy #0f2740,
 * coral #cf4537, teal #4CBBC2, cream #F0F4F8, Montserrat throughout.
 * The featured fleet is live FYI inventory (via /api/yachts/proxy) with a
 * real harvested snapshot as fallback; all other photography is FYI-owned.
 */

/**
 * All photography is FYI-owned: listing shots from the FYI BoatsGroup
 * inventory feed (images.boatsgroup.com) and site imagery from the
 * fyiyachts.com media bucket (storage.googleapis.com/fyiyachts).
 */

/** BoatsGroup CDN resize — masters can be 8000px/5MB; both w and h are required. */
const resizeBG = (url: string, w: number, h: number): string =>
  url.includes('images.boatsgroup.com/images/')
    ? `${url.replace('/images/', '/resize/')}?w=${w}&h=${h}`
    : url;

// 18-second reel cut from FYI's own YouTube uploads — seven 3-second Miami
// scenes, crossfaded, muted. Self-hosted so it ships and versions with the site.
const HERO_VIDEO = '/hero/hero-miami.mp4';
// No webm companion: VP9 came out at 15 MB against 7 MB for the same h264
// quality, and every browser in real use plays h264. If it ever fails, the
// poster image below stands in — fine for a decorative hero.

const IMG = {
  // 2017 Astondoa Century 100 ARMAR, running shot (FYI listing 10216282)
  hero: 'https://images.boatsgroup.com/images/1/62/82/2017-astondoa-century-100-power-10216282-20260611121352131-1.jpg',
  // 2012 Azimut Grande 105 (FYI listing 9872081). Wide crop — the previous
  // 1200x900 render cropped in so tight the vessel read as an abstract.
  buy: resizeBG('https://images.boatsgroup.com/images/1/94/57/2012-azimut-grande-105-power-9679457-20250505141033979-1_XLARGE.jpg', 1600, 1067),
  // Sell tile: FYI's own FLIBS aerial (fyiyachts bucket 2022/09/boat-show.jpg)
  // — two superyachts leading the show marina, the market the tile is selling
  // into. Chosen over a stock show aerial (client direction, 2026-07-29): it's
  // FYI's asset, so no licence question, and it's the sharpest option — the
  // source is 900x512, so the 3:4 crop is a 2.3x upscale at 2x, taken back
  // with a restrained unsharp mask.
  sell: '/site-photos/services-sell.jpg',
  // Services "Buy" tile. Portrait crop so the whole vessel sits inside the 3:4
  // card; the landscape listing renders cut off at bow and stern.
  servicesBuy: '/site-photos/services-buy.jpg',
  // 2017 Azimut Grande 30M against the Miami skyline (FYI listing 10098671) —
  // still used for the sell-page split section.
  sellYacht: resizeBG('https://images.boatsgroup.com/images/1/15/6/2017-azimut-95-raised-pilothouse-power-9601506-20241103080955176-1_XLARGE.jpg', 1200, 675),
  // Charter tile: the 92' Riva Privilegio, the flagship of FYI's term-charter
  // programme and the best-looking hull in the fleet. Bow-on with guests on the
  // foredeck, so the tile sells the vessel and the experience at once — and the
  // composition runs vertically, so it takes the 3:4 crop without losing the
  // bow. Cropped from FYI's own gallery shot (92-ft-riva-privilegio-11).
  charter: '/site-photos/services-charter.jpg',
  // 2026 Posillipo Technema 90 new build (FYI listing 9851928)
  newBuild: 'https://images.boatsgroup.com/images/1/66/6/9206606_20240124131432534_1_XLARGE.jpg',
  // 2021 OKEAN 80 underway on turquoise water (FYI listing 9904333)
  quoteBand: resizeBG('https://images.boatsgroup.com/images/1/43/33/2021-okean-80-power-9904333-20250812133918229-1.jpg', 2000, 1333),
  // Destination tiles are about the WATER, not the vessel (client direction,
  // 2026-07-27) — FYI's own aerial/skyline photography of each cruising ground.
  destMiami: 'https://storage.googleapis.com/fyiyachts/2023/09/Photo_6553876_DJI_276_jpg_4133004_0_202222116216_photo_original.jpg-scaled.jpg',
  destKeys: 'https://storage.googleapis.com/fyiyachts/2023/06/DJI_0549.jpg',
  destBahamas: 'https://storage.googleapis.com/fyiyachts/2022/06/bahamas.jpg',
  // 2013 Prestige 620 off Miami Beach (FYI listing 10049095) — a true ~60-footer
  // for the Motor Yachts tile, which previously showed a 95ft superyacht.
  catMotorYacht: resizeBG('https://images.boatsgroup.com/images/1/90/95/2013-prestige-620-power-10049095-20260714142031596-1.jpg', 1400, 933),
  // Category tiles — all FYI listings: Hatteras 68 Convertible (9722769),
  // Intrepid 327 (9851853), Riva 33' Aquariva (9851869)
  catSportfish: resizeBG('https://images.boatsgroup.com/images/1/27/69/2007-hatteras-68-convertible-power-9722769-20250320122945657-1_XLARGE.jpg', 900, 600),
  catCenterConsole: resizeBG('https://images.boatsgroup.com/images/1/73/24/2014-intrepid-327-center-console-power-9527324-20240916123635375-1_XLARGE.jpg', 900, 600),
  catDayBoat: resizeBG('https://images.boatsgroup.com/images/1/87/68/8518768_20220929085540628_1_XLARGE.jpg', 900, 600),
  // The real FYI team outside the Coral Gables office, from fyiyachts.com
  team: 'https://storage.googleapis.com/fyiyachts/2025/09/jpeg-optimizer_1FYI-Team-2025-1-1.jpeg',
};

// FYI's own brand-logo set from the fyiyachts.com media bucket (black-on-
// transparent originals; rendered white on navy via CSS invert).
// OKEAN leads the marquee and the footer's Top Brands — FYI is actively
// promoting the marque (client direction, 2026-07-27).
const BRAND_LOGOS = [
  { name: 'OKEAN', file: 'OKEAN.png' },
  { name: 'Azimut', file: 'AZIMUT.png' },
  { name: 'Benetti', file: 'benetti-1.png' },
  { name: 'Ferretti Yachts', file: 'FERETTI.png' },
  { name: 'Sunseeker', file: 'SUNSEEKER.png' },
  { name: 'Pershing', file: 'PERSHING.png' },
  { name: 'Riva', file: 'Riva-1.png' },
  { name: 'Princess', file: 'princess.png' },
  { name: 'Sea Ray', file: 'sea-ray.png' },
  { name: 'Hatteras', file: 'hatteras.png' },
  { name: 'Sanlorenzo', file: 'SANLORENZO.png' },
  { name: 'Rizzardi', file: 'RIZZARDI.png' },
].map(b => ({ ...b, url: `https://storage.googleapis.com/fyiyachts/2025/06/${b.file}` }));

const PHONE_DISPLAY = '305-854-6020';
const PHONE_TEL = 'tel:+13058546020';
const WHATSAPP_URL = 'https://wa.me/17863538073';
const ADDRESS = '2424 Coral Way, Miami, FL 33145';

// Desktop items with a `panel` open a full-width mega menu on hover
// (pattern borrowed from the Valhalla Yacht Sales brands panel); on
// mobile every item is a plain link to its landing page.
type MegaPanelKey = 'yachts' | 'charter' | 'sell' | 'team' | 'about';
const NAV_LINKS: { label: string; href: string; panel?: MegaPanelKey }[] = [
  { label: 'Yachts for Sale', href: '/yachts-for-sale', panel: 'yachts' },
  { label: 'Sell', href: '/sell', panel: 'sell' },
  { label: 'Charter', href: '/charter', panel: 'charter' },
  { label: 'Financing', href: '/yacht-financing' },
  { label: 'Our Team', href: '/our-team', panel: 'team' },
  { label: 'About', href: '/about-us', panel: 'about' },
];

interface FleetCard {
  id: string;
  name: string;
  builder: string;
  length: string;
  year: number | string;
  price: string;
  image: string;
}

// Real FYI listings harvested from the live BoatsGroup feed (2026-07-17).
// Shown only until the live fetch in FeaturedFleet resolves, and as a
// fallback when the /api routes aren't available (e.g. plain `vite preview`).
const FALLBACK_FLEET: FleetCard[] = [
  {
    id: '10216282',
    name: 'Armar',
    builder: 'Astondoa Century 100',
    length: "100'",
    year: 2017,
    price: '$5,990,000',
    image: resizeBG('https://images.boatsgroup.com/images/1/62/82/2017-astondoa-century-100-power-10216282-20260611114615751-1.jpg', 900, 600),
  },
  {
    id: '9872081',
    name: 'Azimut Grande 105',
    builder: 'Azimut Grande 105',
    length: "105'",
    year: 2012,
    price: '$5,275,000',
    image: resizeBG('https://images.boatsgroup.com/images/1/94/57/2012-azimut-grande-105-power-9679457-20250505140933276-1_XLARGE.jpg', 900, 675),
  },
  {
    id: '9981084',
    name: 'Sunseeker 86 Yacht',
    builder: 'Sunseeker 86 Yacht',
    length: "86'",
    year: 2021,
    price: '$5,200,000',
    image: resizeBG('https://images.boatsgroup.com/images/1/36/24/8483624_20221011114418475_1_XLARGE.jpg', 900, 600),
  },
  {
    id: '10098671',
    name: 'Azimut Grande 30M',
    builder: 'Azimut Grande 30M',
    length: "95'",
    year: 2017,
    price: '$4,695,000',
    image: resizeBG('https://images.boatsgroup.com/images/1/15/6/2017-azimut-95-raised-pilothouse-power-9601506-20241103081001123-1_XLARGE.jpg', 900, 506),
  },
  {
    id: '9852959',
    name: 'Princess Y78',
    builder: 'Princess Y78',
    length: "81'",
    year: 2021,
    price: '$4,495,000',
    image: resizeBG('https://images.boatsgroup.com/images/1/5/90/8680590_20230216102559222_1_XLARGE.jpg', 900, 600),
  },
  {
    id: '9904333',
    name: 'Okean 80',
    builder: 'OKEAN 80',
    length: "78'",
    year: 2021,
    price: '$3,499,000',
    image: resizeBG('https://images.boatsgroup.com/images/1/43/33/2021-okean-80-power-9904333-20250812140143332-1.jpg', 900, 600),
  },
];

const formatPrice = (n?: number): string =>
  n && Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : 'Price on request';

/** Map a raw BoatsGroup feed item (see api/yachts/proxy.ts) to a fleet card. */
/** First raw (un-resized) photo URL on a feed item, or '' if it has none. */
function rawFeedImage(it: Record<string, any>): string {
  const images: string[] = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  return images[0] || '';
}

function toFleetCard(it: Record<string, any>): FleetCard | null {
  const id = String(it.DocumentID || '');
  const images: string[] = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  if (!id || !images[0]) return null;
  const lengthFt = parseFloat(String(it.LengthOverall ?? it.NominalLength ?? '').replace(/[^0-9.]/g, ''));
  const builder = [it.MakeString, it.Model].filter(Boolean).join(' ').trim();
  const priceNum = it.PriceHideInd ? undefined : parseFloat(String(it.NormPrice ?? it.Price ?? '').replace(/[^0-9.]/g, ''));
  return {
    id,
    name: it.BoatName || builder || 'Yacht',
    builder: builder || 'FYI Yachts Listing',
    length: Number.isFinite(lengthFt) ? `${Math.round(lengthFt)}'` : '—',
    year: it.ModelYear || '—',
    price: formatPrice(priceNum),
    image: resizeBG(images[0], 900, 675),
  };
}

/* ---------------------------------------------------------------- reveal */

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // will-change promotes the element to its own compositor layer, which is
  // wanted during the fade-in but a permanent GPU-memory tax afterwards —
  // ~70 Reveals on this page meant ~70 layers held for the life of the page
  // (part of the intermittent scroll jank reported 2026-07-29). Drop it once
  // the transition has settled.
  const [settled, setSettled] = useState(false);

  return (
    <div
      ref={ref}
      onTransitionEnd={e => { if (e.target === ref.current) setSettled(true); }}
      className={`transition-all duration-1000 ease-out ${settled ? '' : 'will-change-transform'} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.35em] ${
        light ? 'text-yacht-teal' : 'text-yacht-brand'
      }`}
    >
      {children}
    </p>
  );
}

function HairlineRule({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className={`h-px w-10 ${light ? 'bg-yacht-brand-light' : 'bg-yacht-brand'}`} />
      <Anchor className={`w-3.5 h-3.5 ${light ? 'text-yacht-brand' : 'text-yacht-brand'}`} />
      <span className={`h-px w-10 ${light ? 'bg-yacht-brand-light' : 'bg-yacht-brand'}`} />
    </div>
  );
}

/* ------------------------------------------------------------------- nav */

/* ------------------------------------------------------- mega panels */

// Live team counts, fetched once per session on first hover.
let megaTeamCounts: Record<string, { active: number; sold: number }> | null = null;

function TeamMegaPanel() {
  const [counts, setCounts] = useState(megaTeamCounts ?? {});

  useEffect(() => {
    if (megaTeamCounts) return;
    let alive = true;
    fetch('/api/team/data')
      .then(r => r.json())
      .then(d => {
        if (d?.counts) {
          megaTeamCounts = d.counts;
          if (alive) setCounts(d.counts);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Counts order the panel (busiest brokers first) but are never rendered —
  // see the note on the caption below.
  const featured = useMemo(() => {
    return FYI_TEAM
      .filter(m => m.photo)
      .map(m => ({ m, c: counts[repKey(m.feedName || m.name)] }))
      .sort((a, b) => ((b.c?.active ?? 0) * 3 + (b.c?.sold ?? 0)) - ((a.c?.active ?? 0) * 3 + (a.c?.sold ?? 0)))
      .slice(0, 6)
      .map(({ m }) => m);
  }, [counts]);

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-9 lg:grid-cols-12 lg:px-8">
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">The People Behind the Passion</p>
        <h3 className="mt-3 text-xl font-light leading-snug tracking-wide text-white">
          Brokers who&rsquo;ve spent their lives on the water
        </h3>
        <p className="mt-3 text-[13px] font-light leading-6 text-white/60">
          300+ years of combined experience — every consultant&rsquo;s listings and sold history, live.
        </p>
        <a
          href="/our-team"
          className="group/cta mt-5 inline-flex items-center gap-2 bg-yacht-brand px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          Meet the whole team
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </a>
      </div>
      <div className="grid grid-cols-3 gap-3 lg:col-span-9 lg:grid-cols-6">
        {featured.map((m) => (
          <a key={m.slug} href={`/consultants/${m.slug}`} className="group/tile block">
            <div className="aspect-[4/5] overflow-hidden border border-white/10 bg-white/5">
              <img
                src={m.photo}
                alt={m.name}
                loading="lazy"
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover/tile:scale-105"
              />
            </div>
            <p className="mt-2 truncate text-[12px] font-semibold tracking-wide text-white group-hover/tile:text-yacht-brand">
              {m.name}
            </p>
            {/* Per-broker listing/sold counts were removed on 2026-07-27: raw
                numbers next to a name invite disputes from the team. The real
                boats still show on each consultant's profile page. */}
            <p className="mt-0.5 text-[10px] font-light uppercase tracking-[0.15em] text-white/45">
              {m.title}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

// Featured rail for the Yachts panel: FYI's seven highest-asking active
// listings, straight from the feed. Cached and idle-prefetched on the same
// pattern as the Sell panel's sold showcase, so the rail is populated before
// the first hover rather than opening on a spinner.
type TopPick = { id: string; title: string; price: string; length: string; image: string };
const TOP_CACHE_KEY = 'fyi:mega-top:v1';
const TOP_PICK_COUNT = 7;

let megaTopCache: TopPick[] | null = null;
let megaTopInflight: Promise<TopPick[]> | null = null;

function readTopCache(): TopPick[] | null {
  if (megaTopCache) return megaTopCache;
  try {
    const raw = sessionStorage.getItem(TOP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      megaTopCache = parsed;
      return parsed;
    }
  } catch { /* private mode / bad JSON */ }
  return null;
}

function fetchTopPicks(): Promise<TopPick[]> {
  const cached = readTopCache();
  if (cached) return Promise.resolve(cached);
  if (megaTopInflight) return megaTopInflight;
  megaTopInflight = fetch('/api/yachts/proxy?rows=300')
    .then(r => r.json())
    .then(d => {
      const items: any[] = Array.isArray(d?.results) ? d.results : [];
      const picks = items
        // toFleetCard drops anything without a photo, which is what we want —
        // a rail slide is the photo. Price-hidden listings format as "Price on
        // request" and parse to 0, so they sort out of the top naturally.
        .map(it => ({ it, c: toFleetCard(it) }))
        .filter((x): x is { it: any; c: FleetCard } => x.c !== null)
        .map(x => ({ ...x, num: parseFloat(x.c.price.replace(/[^0-9.]/g, '')) || 0 }))
        .filter(x => x.num > 0)
        .sort((a, b) => b.num - a.num)
        .slice(0, TOP_PICK_COUNT)
        .map(({ it, c }) => ({
          id: c.id,
          title: `${c.year} ${c.builder}`.trim(),
          price: c.price,
          length: c.length,
          // Sized off the raw feed URL, not c.image: resizeBG only rewrites
          // `/images/` paths, so re-resizing an already-resized URL is a silent
          // no-op and the slide would keep toFleetCard's 4:3. Rail slides run
          // ~380px wide, so 900x600 covers 2x at the 3:2 the masters are shot
          // in — nothing is cropped.
          image: resizeBG(rawFeedImage(it), 900, 600),
        }));
      megaTopCache = picks;
      try { sessionStorage.setItem(TOP_CACHE_KEY, JSON.stringify(picks)); } catch { /* private mode */ }
      return picks;
    })
    .catch(() => [] as TopPick[])
    .finally(() => { megaTopInflight = null; });
  return megaTopInflight;
}

/** Warm the top-picks cache while the browser is idle, before the first hover. */
export function prefetchTopPicks() {
  if (typeof window === 'undefined' || readTopCache()) return;
  const run = () => { void fetchTopPicks(); };
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === 'function') ric(run, { timeout: 4000 });
  else window.setTimeout(run, 2000);
}

const SLIDE_MS = 4200;

function FeaturedRail() {
  const [picks, setPicks] = useState<TopPick[]>(() => readTopCache() ?? []);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (picks.length) return;
    let alive = true;
    fetchTopPicks().then(p => { if (alive && p.length) setPicks(p); });
    return () => { alive = false; };
  }, [picks.length]);

  // Auto-advance. The panel itself only exists while hovered, so pausing on
  // panel hover would freeze the rail permanently — it pauses only when the
  // cursor is on the rail, i.e. when someone is actually reading a slide.
  useEffect(() => {
    if (picks.length < 2 || paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setI(n => (n + 1) % picks.length), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [picks.length, paused]);

  if (!picks.length) {
    return <div className="aspect-[3/2] w-full animate-pulse bg-white/5" aria-hidden="true" />;
  }

  const safe = i % picks.length;
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="FYI's highest-asking listings"
    >
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${safe * 100}%)` }}
        >
          {picks.map((p, n) => (
            <a
              key={p.id}
              href={`/listing/${p.id}`}
              className="group/slide relative w-full shrink-0"
              aria-hidden={n !== safe}
              tabIndex={n === safe ? undefined : -1}
            >
              <img
                src={p.image}
                alt={p.title}
                loading="lazy"
                className="aspect-[3/2] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-yacht-900/95 via-yacht-900/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-yacht-teal">Featured</p>
                <p className="mt-1 truncate text-[14px] font-semibold tracking-wide text-white">{p.title}</p>
                <p className="mt-0.5 text-[11px] font-light tracking-wide text-white/60">
                  {p.length} · {p.price}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {picks.map((p, n) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setI(n)}
            aria-label={`Show ${p.title}`}
            aria-current={n === safe}
            className={`h-0.5 flex-1 transition-colors ${n === safe ? 'bg-yacht-brand' : 'bg-white/15 hover:bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

function YachtsMegaPanel() {
  const types = CATEGORY_PAGES.filter(c => c.slug !== 'yachts-for-sale');
  const seen = new Set<string>();
  // Logo-bearing brands only, so the panel is a clean logo grid. OKEAN leads,
  // matching the marquee and the footer's Top Brands (client direction).
  // 16 fills a clean 2x8 grid against the taller featured rail; every
  // logo-bearing brand in BRAND_PAGES currently fits inside that.
  const brands = BRAND_PAGES
    .filter(b => !seen.has(b.name) && seen.add(b.name) !== undefined && b.logo)
    .sort((a, b) => Number(b.name === 'OKEAN') - Number(a.name === 'OKEAN'))
    .slice(0, 16);

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-9 lg:grid-cols-12 lg:px-8">
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">Curated Worldwide</p>
        <h3 className="mt-3 text-xl font-light leading-snug tracking-wide text-white">
          Every listing, live from our worldwide inventory
        </h3>
        <p className="mt-3 text-[13px] font-light leading-6 text-white/60">
          Motor yachts to battlewagons — updated straight from the FYI feed.
        </p>
        <a
          href="/yachts-for-sale"
          className="group/cta mt-5 inline-flex items-center gap-2 bg-yacht-brand px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          View all yachts
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </a>
      </div>
      <div className="lg:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">By Type</p>
        <ul className="mt-4 space-y-2.5">
          {types.map(t => (
            <li key={t.slug}>
              <a href={`/${t.slug}`} className="text-[13px] font-light tracking-wide text-white/75 transition-colors hover:text-yacht-brand">
                {t.h1.replace(' for Sale', '')}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">By Brand</p>
        {/* Logos rather than names (client, 2026-07-27). Same white-on-navy
            treatment as the homepage marquee: the originals are black-on-
            transparent, so `invert` renders them white. The brand name stays
            in alt text, so the panel reads the same to a screen reader. */}
        <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1">
          {brands.map(b => (
            <li key={b.slug}>
              <a
                href={`/${b.slug}`}
                title={b.name}
                className="flex h-10 items-center justify-start transition-opacity"
              >
                {b.logo ? (
                  <img
                    src={b.logo}
                    alt={b.name}
                    loading="lazy"
                    className="max-h-7 w-auto max-w-full object-contain object-left opacity-80 invert transition-opacity duration-300 hover:opacity-100"
                  />
                ) : (
                  <span className="text-[13px] font-light tracking-wide text-white/75 transition-colors hover:text-yacht-brand">
                    {b.name}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {/* Four columns wide so listing photos run at their native landscape
          aspect. The old three-column tile was near-square, which meant every
          shot had to be padded onto a blurred backdrop of itself to avoid
          being sliced at bow and stern. */}
      <div className="hidden lg:col-span-4 lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Top of the Fleet</p>
        <div className="mt-4">
          <FeaturedRail />
        </div>
      </div>
    </div>
  );
}

function CharterMegaPanel() {
  const waters = [
    { name: 'Miami & Biscayne Bay', note: 'Skyline sunsets & sandbars', image: IMG.destMiami, alt: 'A Princess Y78 cruising past the Miami skyline' },
    { name: 'The Florida Keys', note: 'Gin-clear flats, slow horizons', image: IMG.destKeys, alt: 'A Sunseeker 86 on shallow turquoise flats' },
    { name: 'The Bahamas & Beyond', note: 'Bimini, the Exumas & open water', image: IMG.destBahamas, alt: 'A motor yacht in a quiet island anchorage' },
  ];
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-9 lg:grid-cols-12 lg:px-8">
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">Charter the Moment</p>
        <h3 className="mt-3 text-xl font-light leading-snug tracking-wide text-white">
          Crewed escapes, 72 to 105 feet
        </h3>
        <p className="mt-3 text-[13px] font-light leading-6 text-white/60">
          Captain, crew, fuel, and provisioning arranged by FYI — from golden-hour cruises to week-long runs. From $3,600.
        </p>
        <a
          href="/charter"
          className="group/cta mt-5 inline-flex items-center gap-2 bg-yacht-brand px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          Plan a charter
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </a>
      </div>
      <div className="grid grid-cols-3 gap-3 lg:col-span-9">
        {waters.map(w => (
          <a key={w.name} href="/charter" className="group/tile relative block overflow-hidden">
            <img src={w.image} alt={w.alt} loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover/tile:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-yacht-900/90 via-yacht-900/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[13px] font-semibold tracking-wide text-white">{w.name}</p>
              <p className="mt-0.5 text-[11px] font-light text-white/55">{w.note}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// Live sold showcase for the Sell panel — social proof straight from the feed.
//
// The sold query returns hundreds of rows, so hovering "Sell" used to sit on a
// spinner while it downloaded. Now the result is cached in sessionStorage
// (survives navigation) and prefetched while the browser is idle, so the panel
// is already populated the first time it opens.
type SoldPick = { id: string; title: string; image: string };
const SOLD_CACHE_KEY = 'fyi:mega-sold:v1';

let megaSoldCache: SoldPick[] | null = null;
let megaSoldInflight: Promise<SoldPick[]> | null = null;

function readSoldCache(): SoldPick[] | null {
  if (megaSoldCache) return megaSoldCache;
  try {
    const raw = sessionStorage.getItem(SOLD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      megaSoldCache = parsed;
      return parsed;
    }
  } catch { /* private mode / bad JSON */ }
  return null;
}

function fetchSoldPicks(): Promise<SoldPick[]> {
  const cached = readSoldCache();
  if (cached) return Promise.resolve(cached);
  if (megaSoldInflight) return megaSoldInflight;
  // The sold book is ~1,000 rows across three pages and the feed does not hand
  // back the newest closings first, so pull all of it — the result is cached in
  // sessionStorage and prefetched while the browser is idle, so this runs once
  // per visit, before anyone opens the Sell menu.
  const PAGE = 400;
  const page = (start: number) =>
    fetch(`/api/yachts/proxy?salesstatus=sold&rows=${PAGE}&start=${start}`)
      .then(r => r.json())
      .then(d => (Array.isArray(d?.results) ? (d.results as any[]) : []))
      .catch(() => [] as any[]);
  megaSoldInflight = Promise.all([page(0), page(PAGE), page(PAGE * 2)])
    .then(pages => {
        const seenIds = new Set<string>();
        const items: any[] = pages.flat()
          .filter(it => it?.DocumentID && !seenIds.has(String(it.DocumentID)) && seenIds.add(String(it.DocumentID)));
        // Showcase criteria (client, 2026-07-22): sold vessels over 80 feet
        // and newer than 15 model-years. The feed rarely has 3 that strict,
        // so backfill with the largest newest 80-footers of any age.
        //
        // Scoped since 2026-09-03 to the same ROLLING 12-MONTH WINDOW as the
        // sold galleries, ordered LARGEST FIRST. The window is narrow — five
        // boats over 80ft closed in the last year — so if it cannot fill the
        // three tiles, the older book backfills rather than leaving gaps.
        const from = soldWindowStart();
        const minYear = new Date().getFullYear() - 15;
        const withLen = items.map(it => ({
          it,
          len: parseFloat(String(it.LengthOverall ?? it.NominalLength ?? '').replace(/[^0-9.]/g, '')),
          yr: Number(it.ModelYear) || 0,
          sold: String(it.SoldDate ?? ''),
        })).filter(x => Number.isFinite(x.len) && x.len > 80);
        const byLength = (a: typeof withLen[number], b: typeof withLen[number]) =>
          b.len - a.len || b.sold.localeCompare(a.sold) || b.yr - a.yr;
        const inWindow = withLen.filter(x => withinSoldWindow(x.sold, from)).sort(byLength);
        const older = withLen.filter(x => !withinSoldWindow(x.sold, from));
        const strict = older.filter(x => x.yr > minYear).sort(byLength);
        const rest = older.filter(x => x.yr <= minYear).sort(byLength);
        const picks = [...inWindow, ...strict, ...rest]
          .map(({ it }) => it)
          .map(it => {
            const img = (Array.isArray(it.Images) ? it.Images : [])
              .map((x: any) => (typeof x === 'string' ? x : x?.Uri || ''))
              .filter(Boolean)[0];
            return img ? {
              id: String(it.DocumentID),
              title: [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ') || it.BoatName || 'Sold yacht',
              image: resizeBG(img, 700, 466),
            } : null;
          })
          .filter((x): x is SoldPick => x !== null)
          .slice(0, 3);
        megaSoldCache = picks;
        try { sessionStorage.setItem(SOLD_CACHE_KEY, JSON.stringify(picks)); } catch { /* private mode */ }
        return picks;
      })
    .catch(() => [] as SoldPick[])
    .finally(() => { megaSoldInflight = null; });
  return megaSoldInflight;
}

/** Warm the sold cache while the browser is idle, before anyone hovers Sell. */
export function prefetchSoldPicks() {
  if (typeof window === 'undefined' || readSoldCache()) return;
  const run = () => { void fetchSoldPicks(); };
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === 'function') ric(run, { timeout: 4000 });
  else window.setTimeout(run, 2000);
}

function SellMegaPanel() {
  const [sold, setSold] = useState<SoldPick[]>(() => readSoldCache() ?? []);

  useEffect(() => {
    if (sold.length) return;
    let alive = true;
    fetchSoldPicks().then(picks => { if (alive && picks.length) setSold(picks); });
    return () => { alive = false; };
  }, [sold.length]);

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-9 lg:grid-cols-12 lg:px-8">
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">List Your Yacht</p>
        <h3 className="mt-3 text-xl font-light leading-snug tracking-wide text-white">
          Marketing that moves vessels
        </h3>
        <p className="mt-3 text-[13px] font-light leading-6 text-white/60">
          Tailored marketing, a worldwide buyer network, and brokers who negotiate for a living.
        </p>
        <a
          href="/sell"
          className="group/cta mt-5 inline-flex items-center gap-2 bg-yacht-brand px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          Get a free valuation
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </a>
      </div>
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Ownership Services</p>
        <ul className="mt-4 space-y-2.5">
          {[
            ['Sell your yacht', '/sell'],
            ['Yacht financing', '/yacht-financing'],
            ['Lease-to-own', '/lease-to-own'],
            ['New construction', '/#new-construction'],
            ['Charter your season', '/charter'],
            ['Sold by FYI', '/sold-yachts'],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} className="text-[13px] font-light tracking-wide text-white/75 transition-colors hover:text-yacht-brand">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Sold by FYI</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {(sold.length ? sold : Array.from({ length: 3 }, (_, i) => null as any)).map((b, i) => (
            b ? (
              <div key={b.id} className="relative overflow-hidden">
                <img src={b.image} alt={`${b.title} — sold by FYI Yachts`} loading="lazy" className="aspect-[16/10] w-full object-cover saturate-[0.65]" />
                <span className="absolute left-3 top-3 bg-yacht-brand px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white">Sold</span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yacht-900/90 to-transparent p-3">
                  <p className="truncate text-[11px] font-semibold tracking-wide text-white">{b.title}</p>
                </div>
              </div>
            ) : (
              <div key={i} className="aspect-[16/10] animate-pulse bg-white/5" aria-hidden="true" />
            )
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutMegaPanel() {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-9 lg:grid-cols-12 lg:px-8">
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">Florida Yachts International</p>
        <h3 className="mt-3 text-xl font-light leading-snug tracking-wide text-white">
          We make your yachting dreams come true
        </h3>
        <p className="mt-3 text-[13px] font-light leading-6 text-white/60">
          Brokerage, charter, new construction, and financing — under one roof in Miami since day one.
        </p>
        <a
          href="/about-us"
          className="group/cta mt-5 inline-flex items-center gap-2 bg-yacht-brand px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          Our story
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </a>
      </div>
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Company</p>
        <ul className="mt-4 space-y-2.5">
          {[
            ['About us', '/about-us'],
            ['Our team', '/our-team'],
            ['Contact', '/contact'],
            ['News', '/fyi-news'],
            ['My Profile', '/login'],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} className="text-[13px] font-light tracking-wide text-white/75 transition-colors hover:text-yacht-brand">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Headquarters</p>
          <p className="mt-2 text-[13px] font-light leading-6 text-white/65">{ADDRESS}</p>
          <a href={PHONE_TEL} className="mt-1 inline-block text-[13px] font-light tracking-wider text-yacht-teal">{PHONE_DISPLAY}</a>
        </div>
      </div>
      <a href="/our-team" className="group/feat relative hidden overflow-hidden lg:col-span-6 lg:block">
        <img
          src={IMG.team}
          alt="The FYI Yachts team outside the Coral Gables office"
          loading="lazy"
          className="h-full min-h-[220px] w-full object-cover transition-transform duration-700 group-hover/feat:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-yacht-900/90 via-yacht-900/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-yacht-teal">The Team</p>
          <p className="mt-1 text-[15px] font-semibold tracking-wide text-white">300+ years of combined expertise</p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-brand-light">
            Meet everyone <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </a>
    </div>
  );
}

const MEGA_PANELS: Record<MegaPanelKey, () => ReactNode> = {
  yachts: () => <YachtsMegaPanel />,
  charter: () => <CharterMegaPanel />,
  sell: () => <SellMegaPanel />,
  team: () => <TeamMegaPanel />,
  about: () => <AboutMegaPanel />,
};

export function HomeNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<MegaPanelKey | null>(null);
  // Current path for active-item accent (SPA uses full-page anchors here,
  // so reading location once per mount is accurate).
  const [path] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Warm the Sell panel's sold showcase and the Yachts panel's featured rail
  // before the first hover.
  useEffect(() => { prefetchSoldPicks(); prefetchTopPicks(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      onMouseLeave={() => setPanel(null)}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || menuOpen || panel
          ? 'bg-yacht-900/95 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20'
          : 'bg-gradient-to-b from-yacht-900/70 to-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
        {/* Goes home from anywhere. The marketing homepage is now "/" (the
            authenticated dashboard app lives under /app). On the homepage
            itself there is nowhere to navigate, so it scrolls to the top
            instead. */}
        <a
          href="/"
          className="shrink-0"
          aria-label="FYI Yachts home"
          onClick={(e) => {
            if (window.location.pathname.replace(/\/$/, '') === '') {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <FYILogo className="h-11 w-auto lg:h-14" />
        </a>

        {/* The hamburger is for phones only. On laptops the full menu shows and
            the phone number / portal link drop out first to make room, rather
            than collapsing six nav items behind an icon (client, 2026-07-27). */}
        <nav className="hidden items-center gap-5 lg:flex lg:gap-6 xl:gap-7" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const current = path === link.href || (link.href !== '/' && path.startsWith(`${link.href}/`))
              || (link.panel === 'team' && path.startsWith('/consultants'));
            return (
              <a
                key={link.label}
                href={link.href}
                onMouseEnter={() => setPanel(link.panel ?? null)}
                aria-expanded={link.panel ? panel === link.panel : undefined}
                aria-current={current ? 'page' : undefined}
                className={`relative flex items-center gap-1.5 whitespace-nowrap py-1 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors xl:tracking-[0.22em] ${
                  (link.panel && panel === link.panel) || current ? 'text-white' : 'text-white/80 hover:text-white'
                }`}
              >
                {link.label}
                {link.panel && (
                  <ChevronDown className={`h-3 w-3 text-yacht-teal transition-transform duration-300 ${panel === link.panel ? 'rotate-180' : ''}`} />
                )}
                {current && <span aria-hidden="true" className="absolute -bottom-1 left-0 right-0 h-px bg-yacht-brand" />}
              </a>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-5 lg:flex" onMouseEnter={() => setPanel(null)}>
          {/* Phone + portal link are the first things to go as the viewport
              narrows, so the nav items themselves stay visible. whitespace-nowrap
              + shrink-0 keep the number on ONE line — without them the flex row
              compresses the link and "305-854-6020" wraps under the icon. */}
          <a
            href={PHONE_TEL}
            className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-[12px] font-medium tracking-wider text-white/80 transition-colors hover:text-white 2xl:flex"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-yacht-teal" />
            {PHONE_DISPLAY}
          </a>
          {SPANISH_ENABLED && (() => {
            // ES ↔ EN toggle. Lands on the natively-written counterpart page
            // where one exists (esRoutes.ts), the Spanish front door otherwise.
            const t = languageToggleTarget(path);
            return (
              <a
                href={t.href}
                aria-label={t.label === 'ES' ? 'Ver el sitio en español' : 'View the site in English'}
                className="hidden shrink-0 border border-white/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-yacht-teal hover:text-yacht-teal lg:block"
              >
                {t.label}
              </a>
            );
          })()}
          <a
            href="/login"
            className="hidden whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.22em] text-white/80 transition-colors hover:text-white xl:inline"
          >
            My Profile
          </a>
          <a
            href="/contact"
            className="whitespace-nowrap border border-yacht-brand px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-yacht-brand xl:px-5 xl:tracking-[0.22em]"
          >
            Inquire
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="p-2 text-white lg:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mega panels — desktop only, hover-triggered (Valhalla-inspired).
          Mobile taps the item and lands on the page instead. */}
      {panel && (
        <div className="hidden border-t border-white/10 bg-yacht-900/98 motion-safe:animate-fade-in-up lg:block">
          {MEGA_PANELS[panel]()}
        </div>
      )}

      {menuOpen && (
        <nav
          className="border-t border-white/10 bg-yacht-900/95 px-5 pb-8 pt-4 backdrop-blur-md lg:hidden"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-white/5 py-3 text-xs font-medium uppercase tracking-[0.25em] text-white/85"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="border-b border-white/5 py-3 text-xs font-medium uppercase tracking-[0.25em] text-white/85"
            >
              My Profile
            </a>
            <a
              href={PHONE_TEL}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 border-b border-white/5 py-3 text-xs font-medium tracking-wider text-white/85"
            >
              <Phone className="h-3.5 w-3.5 text-yacht-teal" /> {PHONE_DISPLAY}
            </a>
            {SPANISH_ENABLED && (() => {
              const t = languageToggleTarget(path);
              return (
                <a
                  href={t.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 border-b border-white/5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/85"
                >
                  {t.label === 'ES' ? 'ES — Español' : 'EN — English'}
                </a>
              );
            })()}
            <a
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="mt-5 border border-yacht-brand px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-white"
            >
              Inquire
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ hero */

// Homepage AI search — a hero prompt box that hands the query to Brianna,
// Parse a free-text hero query into the structured filter params the
// yachts-for-sale inventory grid reads from the URL (make, type,
// length, price, year, condition — same keys as the FilterBar).
// Common builder misspellings the substring match can't absorb on its own
// (BRAND_PAGES matches "azimut" inside "azimuth" for free, but not these).
const BRAND_ALIASES: [string, string][] = [
  ['sunseaker', 'sunseeker'], ['sun seeker', 'sunseeker'],
  ['bennetti', 'benetti'], ['benneteau', 'beneteau'], ['benetau', 'beneteau'],
  ['ferreti', 'ferretti'], ['perishing', 'pershing'], ['hatterras', 'hatteras'],
  ['sea-ray', 'sea ray'], ['searay', 'sea ray'], ['princes\b', 'princess'],
];

function parseHeroQuery(raw: string): URLSearchParams {
  let q = raw.toLowerCase();
  for (const [typo, right] of BRAND_ALIASES) q = q.replace(new RegExp(typo, 'g'), right);
  const p = new URLSearchParams();

  // Brand — match any known builder name in the query.
  const brand = BRAND_PAGES.find((b) => q.includes(b.match));
  // The feed's spelling of the builder ("Cigarette", not the page's "Cigarette
  // Racing"), so the make filter matches in both FYI's book and co-brokerage.
  if (brand) p.set('make', brandMake(brand));

  // Boat type → the classCode substrings applyFilters matches on.
  const TYPES: [RegExp, string][] = [
    [/center console/, 'Center Console'], [/catamaran|cat\b/, 'Catamaran'],
    [/sport ?fish|sportfish/, 'Sport Fish'], [/motor ?yacht/, 'Motor Yacht'],
    [/express cruiser/, 'Express Cruiser'], [/flybridge/, 'Flybridge'],
    [/cruiser/, 'Cruiser'], [/sail/, 'Sail'], [/trawler/, 'Trawler'],
  ];
  const type = TYPES.find(([re]) => re.test(q));
  if (type) p.set('type', type[1]);

  // Price FIRST (so a consumed money number can't be re-read as a length).
  // Native min/max, honoring direction: "under $5M" is a CEILING — the old
  // bucket logic inverted it and showed $100M boats (found live 2026-08-20).
  // A number counts as money only when it carries a $ or a money unit;
  // comma-grouped amounts ("$800,000") parse as thousands, not decimals; a
  // bare "Nm" with no $ or direction word is METERS, not millions ("30m
  // yacht" is a 98-footer, not a $30M budget).
  const priceDirectional = /under|below|less than|up ?to|max|budget|over|above|more than|at least|starting/.test(q);
  let priceUsd = 0;
  let priceText = '';
  for (const m of q.matchAll(/(\$)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(mm?\b|million|k\b|thousand)?/g)) {
    const hasDollar = !!m[1];
    const unit = m[3] || '';
    if (!hasDollar && !unit) continue;
    if (/^m/.test(unit) && !/illion/.test(unit) && !hasDollar && !priceDirectional) continue; // bare meters
    let v = parseFloat(m[2].replace(/,/g, ''));
    if (/^m/.test(unit)) v *= 1_000_000;
    else if (/^k|thousand/.test(unit)) v *= 1_000;
    if (v >= 10_000) { priceUsd = v; priceText = m[0]; break; }
  }
  if (priceUsd > 0) {
    if (/over|above|more than|at least|minimum|starting/.test(q)) p.set('minPrice', String(priceUsd));
    else p.set('maxPrice', String(priceUsd)); // "under $5M", "up to", or a bare budget
    q = q.replace(priceText, ' '); // don't let the amount be re-read below
  }

  // Length → the worldwide search's native min/max. "90ft" means "around 90
  // feet" (band), while "over 80", "60+" and "40-60" keep their direction.
  // Metric lengths convert ("30m" / "25 meters" → feet).
  const band = (n: number) => {
    p.set('minLen', String(Math.max(0, Math.round(n * 0.9))));
    p.set('maxLen', String(Math.round(n * 1.15)));
  };
  const lenRange = q.match(/(\d{2,3})\s*(?:-|to|and)\s*(\d{2,3})\s*(?:'|ft|foot|feet)?/);
  const lenOver = q.match(/(?:over|above|>|at least|minimum)\s*(\d{2,3})\s*(?:'|ft|foot|feet)?|(\d{2,3})\s*\+/);
  const lenM = q.match(/(\d{2,3})\s*(?:'|ft|foot|feet|footer)/);
  const lenMetric = q.match(/(\d{2,3}(?:\.\d+)?)\s*(?:m\b|meters?|metres?)/);
  if (lenRange && Number(lenRange[2]) > Number(lenRange[1])) {
    p.set('minLen', lenRange[1]);
    p.set('maxLen', lenRange[2]);
  } else if (lenOver) {
    p.set('minLen', lenOver[1] || lenOver[2]);
  } else if (lenM) {
    band(parseInt(lenM[1], 10));
  } else if (lenMetric && parseFloat(lenMetric[1]) <= 120) {
    band(Math.round(parseFloat(lenMetric[1]) * 3.28084));
  } else if (/super\s?yacht|mega\s?yacht/.test(q)) {
    p.set('minLen', '80');
  }

  // Year — a stated year is a floor ("2020 Azimut" means 2020 or newer).
  // `year` is the key the inventory grid reads (it was `minYear`, which
  // nothing read, so a stated year was silently dropped).
  const yr = q.match(/\b(19|20)\d{2}\b/);
  if (yr) p.set('year', yr[0]);

  // A brand plus a bare model number ("50 Azimut", "Azimut 68", "Sundancer
  // 500") searches for that model: make + keyword, the same split the
  // inventory search box makes, so both land on the same results.
  if (brand && !p.has('minLen') && !p.has('year')) {
    const modelNum = q.match(/\b(\d{2,4})\b/);
    if (modelNum) p.set('q', modelNum[1]);
  }

  if (/\bnew\b/.test(q)) p.set('condition', 'new');
  else if (/\bused|pre-?owned|brokerage\b/.test(q)) p.set('condition', 'used');

  // Location → the feed's country filter, for the countries it actually
  // carries. Cities/states aren't filterable server-side and stay keywords.
  const COUNTRIES = [
    'france', 'italy', 'spain', 'monaco', 'greece', 'croatia', 'turkey',
    'mexico', 'bahamas', 'netherlands', 'germany', 'canada', 'australia',
    'portugal', 'malta',
  ];
  const country = COUNTRIES.find((c) => q.includes(c));
  if (country) p.set('country', country[0].toUpperCase() + country.slice(1));
  else if (/\busa\b|\bunited states\b/.test(q)) p.set('country', 'United States');

  // Nothing structured recognized → keyword fallback, minus the filler words
  // ("yachts for sale", "luxury boat") that would keyword-match nothing and
  // land the visitor on an empty page instead of the full inventory.
  if ([...p.keys()].length === 0) {
    const residual = q
      .replace(/\b(yachts?|boats?|vessels?|for sale|buy|sale|luxury|cheap|nice|best|find|show me|search|available|in)\b/g, ' ')
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (residual) p.set('q', residual);
  }

  return p;
}

// Homepage search — sends the visitor into the worldwide listings with the
// query parsed into filters (per client: open the inventory, not the chat).
function HeroSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [listening, setListening] = useState(false);
  // Web Speech API — Chrome/Edge/Safari only, so the mic renders only where it
  // exists (Firefox visitors just see the normal search box). Kept in a ref so
  // a second tap can abort the first session.
  const recRef = useRef<any>(null);
  // Gated off behind VOICE_SEARCH_ENABLED — with the flag false the mic never
  // renders and no recognition session can start, so nothing below runs.
  const SpeechRec = VOICE_SEARCH_ENABLED && typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

  const go = (query: string) => {
    // parseHeroQuery owns the keyword fallback (stopword-stripped) — an
    // all-filler query lands on the full inventory, not an empty search.
    const params = parseHeroQuery(query);
    const qs = params.toString();
    trackEvent('hero_search', { query: query.trim().slice(0, 80), filters: qs });
    navigate(qs ? `/yachts-for-sale?${qs}` : '/yachts-for-sale');
  };

  const listen = () => {
    if (listening) { recRef.current?.abort(); setListening(false); return; }
    const rec = new SpeechRec();
    recRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e: any) => {
      let text = '';
      for (const r of e.results) text += r[0].transcript;
      setQ(text);
      if (e.results[e.results.length - 1].isFinal) finalText = text;
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      // Search as soon as they stop talking — saying the boat IS the search.
      if (finalText.trim()) go(finalText);
    };
    setListening(true);
    trackEvent('hero_search_voice', {});
    rec.start();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go(q);
  };
  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-10 flex w-full max-w-xl items-center gap-2 border border-white/25 bg-white/10 p-2 backdrop-blur-md transition-colors focus-within:border-yacht-teal"
    >
      <Search className="ml-3 h-5 w-5 flex-none text-white/60" aria-hidden="true" />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search yachts — “90ft Azimut under $5M”"
        aria-label="Search the worldwide yacht inventory"
        className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] font-light text-white placeholder:text-white/50 focus:outline-none"
      />
      {SpeechRec ? (
        <button
          type="button"
          onClick={listen}
          aria-label={listening ? 'Stop listening' : 'Search by voice — say the boat you want to see'}
          aria-pressed={listening}
          title="Search by voice"
          className={`flex-none rounded-full p-2.5 transition-colors ${
            listening ? 'animate-pulse bg-yacht-brand text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          <Mic className="h-5 w-5" />
        </button>
      ) : null}
      <button
        type="submit"
        className="flex-none bg-yacht-brand px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-yacht-brand-light"
      >
        Search
      </button>
    </form>
  );
}

function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause the reel once the hero scrolls out of view. Without this the loop
  // decodes 1080p video for the whole life of the page, and that background
  // decode is a scroll-jank tax on every section below (reported as
  // intermittent glitchy scrolling, 2026-07-29).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => { /* autoplay blocked */ });
        else video.pause();
      },
      { threshold: 0.05 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="top" className="relative flex min-h-screen items-center justify-center overflow-hidden lg:max-h-screen">
      <div className="absolute inset-0">
        {/* Hero background video (the J Brothers reel from fyiyachts.com).
            The optimized hero photo is the poster, so it paints instantly
            (fast LCP) and stands in wherever autoplay is blocked or motion
            is reduced. Muted + playsInline + loop for silent autoplay. */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={optImg(IMG.hero, 1920)}
          aria-label="FYI Yachts — vessels underway offshore"
          className="h-full w-full object-cover"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-yacht-900/70 via-yacht-900/35 to-yacht-900" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-40 pb-32 text-center lg:pt-48">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.45em] text-yacht-cream/80">
            Florida Yachts International &middot; Est. Miami
          </p>
        </Reveal>
        <Reveal delay={200}>
          <h1 className="mt-8 text-4xl font-light leading-[1.15] tracking-wide text-white sm:text-5xl lg:text-6xl">
            We Make Your Yachting
            <span className="mt-2 block font-extralight italic text-yacht-cream">Dreams Come True</span>
          </h1>
        </Reveal>
        <Reveal delay={500}>
          <p className="mx-auto mt-10 max-w-xl text-base font-light leading-relaxed tracking-wide text-white sm:text-lg">
            Three centuries of combined expertise. A worldwide inventory. One devoted
            team guiding every voyage — from first sea trial to final sunset.
          </p>
        </Reveal>
        <Reveal delay={600}>
          <HeroSearch />
        </Reveal>
        <Reveal delay={700}>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#fleet"
              className="group inline-flex items-center gap-3 bg-yacht-brand px-9 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition-all duration-300 hover:bg-yacht-brand-light"
            >
              Explore the Fleet
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <a
              href="/charter"
              className="inline-flex items-center gap-3 border border-white/40 px-9 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition-all duration-300 hover:border-white hover:bg-white/10"
            >
              Charter With Us
            </a>
          </div>
        </Reveal>
      </div>

      {/* Decorative scroll cue only — no longer a link (client direction). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/60"
      >
        <ChevronDown className="h-7 w-7 animate-bounce" />
      </div>
    </section>
  );
}

function StatsBar() {
  const stats = [
    { value: '300+', label: 'Years of combined expertise' },
    { value: '30+', label: 'Featured builders & brands' },
    { value: 'Worldwide', label: 'Inventory & buyer network' },
    { value: "72'–131'", label: 'Charter fleet, Miami based' },
  ];
  return (
    <section className="border-y border-white/10 bg-yacht-800">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/10 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 120} className="px-6 py-10 text-center">
            <p className="text-2xl font-light tracking-wide text-yacht-cream lg:text-3xl">{stat.value}</p>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
              {stat.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ editorial */

function EditorialIntro() {
  return (
    <section id="experience" className="water-texture bg-yacht-cream py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <Eyebrow>The FYI Difference</Eyebrow>
        </Reveal>
        <Reveal delay={150}>
          <h2 className="mt-6 text-3xl font-light leading-snug tracking-wide text-yacht-900 lg:text-4xl">
            The sea rewards those who
            <span className="italic"> arrive prepared</span>
          </h2>
        </Reveal>
        <Reveal delay={300} className="mt-8 flex justify-center">
          <HairlineRule />
        </Reveal>
        <Reveal delay={400}>
          <p className="mt-8 text-[15px] font-light leading-8 tracking-wide text-yacht-900/75">
            From our Miami headquarters, Florida Yachts International has spent
            decades pairing discerning owners with exceptional vessels. Whether you are
            acquiring your first motor yacht, commissioning a new build, or entrusting
            us with the sale of a beloved flagship, our brokers bring quiet diligence,
            global reach, and an uncompromising standard of care to every transaction.
          </p>
        </Reveal>
        <Reveal delay={550}>
          <a
            href="/about-us"
            className="group mt-10 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-yacht-brand transition-colors hover:text-yacht-900"
          >
            About Florida Yachts International
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- services */

const SERVICES = [
  {
    title: 'Buy',
    subtitle: 'Acquisition & Financing',
    href: '/yachts-for-sale',
    copy: 'Worldwide inventory, sea-trial guidance, and financing structured around you.',
    image: IMG.servicesBuy,
    alt: 'A sportfish yacht running offshore',
  },
  {
    title: 'Sell',
    subtitle: 'Brokerage & Marketing',
    href: '/sell',
    copy: 'Tailored marketing and expert representation that moves vessels faster.',
    image: IMG.sell,
    alt: 'Aerial view of superyachts filling the marina at the Fort Lauderdale International Boat Show',
  },
  {
    title: 'Charter',
    subtitle: 'Miami & Beyond',
    href: '/charter',
    copy: 'Crewed escapes provisioned to the last detail, from a golden-hour cruise to a week away.',
    image: IMG.charter,
    // Names the boat in the photo but no longer calls it the charter flagship:
    // the Riva came off the charter page with the rest of the fleet.
    alt: 'Guests toasting on the foredeck of a 92-foot Riva Privilegio motor yacht',
  },
];

function Services() {
  return (
    <section id="services" className="bg-yacht-900 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal className="text-center">
          <Eyebrow light>Your Journey</Eyebrow>
          <h2 className="mt-6 text-3xl font-light tracking-wide text-white lg:text-4xl">
            Every voyage begins with a decision
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {SERVICES.map((service, i) => (
            <Reveal key={service.title} delay={i * 150}>
              <a href={service.href} className="group relative block aspect-[3/4] overflow-hidden">
                <img
                  src={service.image}
                  alt={service.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                {/* Gradient carried higher up the card so the copy below
                    always sits on solid tone, never on the photo. */}
                <div className="absolute inset-0 bg-gradient-to-t from-yacht-900/80 from-25% via-yacht-900/60 via-55% to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">
                    {service.subtitle}
                  </p>
                  <h3 className="mt-2 text-2xl font-light uppercase tracking-[0.2em] text-white">
                    {service.title}
                  </h3>
                  <p className="mt-3 max-w-xs text-[15px] font-light leading-7 text-white">
                    {service.copy}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-brand-light opacity-0 transition-all duration-500 group-hover:opacity-100">
                    Begin here <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <span className="absolute inset-x-8 bottom-0 h-px origin-left scale-x-0 bg-yacht-brand transition-transform duration-500 group-hover:scale-x-100" />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- browse by type */

// Allied-Marine-style yacht-type categorization grid, on real FYI listings.
const CATEGORIES = [
  { name: 'Motor Yachts', note: 'Flybridge to pilothouse', href: '/yachts-for-sale', image: IMG.catMotorYacht, alt: 'A Prestige 620 flybridge motor yacht off Miami Beach', tall: true },
  { name: 'Superyachts', note: "85 feet and beyond", href: '/super-yachts-for-sale', image: IMG.buy, alt: 'The Azimut Grande 105 superyacht at anchor', tall: true },
  { name: 'Sport Fishermen', note: 'Convertibles & battlewagons', href: '/sport-fishing-yachts-for-sale', image: IMG.catSportfish, alt: 'A Hatteras 68 Convertible sportfisher' },
  { name: 'Center Consoles', note: 'Run fast, fish hard', href: '/center-console-boats-for-sale', image: IMG.catCenterConsole, alt: 'An Intrepid 327 center console underway' },
  { name: 'Day Boats & Cruisers', note: 'Riva runabouts to express cruisers', href: '/small-yachts-for-sale', image: IMG.catDayBoat, alt: "A Riva 33' Aquariva Super on Biscayne Bay" },
];

function BrowseByType() {
  return (
    <section id="browse" className="bg-yacht-900 pb-24 lg:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal className="text-center">
          <Eyebrow light>Shop by Category</Eyebrow>
          <h2 className="mt-6 text-3xl font-light tracking-wide text-white lg:text-4xl">
            Find your kind of boat
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {CATEGORIES.map((cat, i) => (
            <Reveal
              key={cat.name}
              delay={i * 100}
              className={cat.tall ? 'lg:col-span-3' : 'lg:col-span-2'}
            >
              <a
                href={cat.href}
                className={`group relative block overflow-hidden ${cat.tall ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}
              >
                <img
                  src={cat.image}
                  alt={cat.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-yacht-900/90 via-yacht-900/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-6 lg:p-8">
                  <div>
                    <h3 className="text-xl font-semibold uppercase tracking-[0.14em] text-white lg:text-2xl">{cat.name}</h3>
                    <p className="mt-2 text-[15px] font-light leading-6 text-white/75 lg:text-base">{cat.note}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-yacht-brand-light opacity-0 transition-all duration-500 group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <span className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-yacht-brand transition-transform duration-500 group-hover:scale-x-100" />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- fleet */

function FeaturedFleet() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [fleet, setFleet] = useState<FleetCard[]>(FALLBACK_FLEET);

  // Live inventory via the app's own BoatsGroup proxy: the sixteen
  // highest-asking active listings that have photos — enough depth that the
  // drifting rail keeps showing new boats. Falls back to the harvested snapshot.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/yachts/proxy?rows=200', { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const items: any[] = Array.isArray(data?.results) ? data.results : [];
        // The feed can carry the same hull twice (relisted records — same
        // boat, name, length and price, one with a wrong year), which put a
        // doubled Garlington on the rail. Collapse those onto the oldest-year
        // record — but only when the years are close. That same Garlington is
        // listed 1997 (build) and 2022 (refit) on purpose, and the original
        // year-blind collapse hid the listing the brokerage wanted shown
        // (client, 2026-09-16). See collapseRelistedHulls.
        const cards = collapseRelistedHulls(
          items.map(toFleetCard).filter((c): c is FleetCard => !!c),
          (c) => `${c.builder}|${c.name}|${c.length}|${c.price}`,
          (c) => Number(c.year),
        )
          .sort((a, b) => {
            const num = (c: FleetCard) => parseFloat(c.price.replace(/[^0-9.]/g, '')) || 0;
            return num(b) - num(a);
          })
          .slice(0, 16);
        if (cards.length >= 3) setFleet(cards);
      } catch {
        // keep fallback
      }
    })();
    return () => controller.abort();
  }, []);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('article');
    const step = card ? card.clientWidth + 24 : 400;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  // Slow sideways drift (client request 2026-07-30): the rail advances on its
  // own so the fleet feels alive. The card list is rendered twice, so wrapping
  // scrollLeft at the halfway point loops seamlessly. The drift yields to
  // people: it pauses on mouse hover and keyboard focus, backs off for a few
  // seconds after any wheel/touch/drag, respects prefers-reduced-motion, and
  // only runs while the section is on screen (background rAF scroll work was
  // this page's scroll-jank tax once before — see the hero video fix).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const SPEED = 70; // px/s — a visible glide, roughly one card every 6s (26 read as too slow)
    let raf = 0;
    let last = 0;
    let visible = false;
    let hovered = false;
    let holdUntil = 0;

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.1 });
    io.observe(track);

    const backOff = () => { holdUntil = performance.now() + 4000; };
    const onPointerEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') hovered = true; };
    const onPointerLeave = (e: PointerEvent) => { if (e.pointerType === 'mouse') hovered = false; };
    const onFocusIn = () => { hovered = true; };
    const onFocusOut = () => { hovered = false; };

    track.addEventListener('pointerenter', onPointerEnter);
    track.addEventListener('pointerleave', onPointerLeave);
    track.addEventListener('focusin', onFocusIn);
    track.addEventListener('focusout', onFocusOut);
    track.addEventListener('touchstart', backOff, { passive: true });
    track.addEventListener('wheel', backOff, { passive: true });
    track.addEventListener('pointerdown', backOff);

    // Accumulate the position in a variable: assigning fractional values to
    // scrollLeft gets rounded by the browser, so "+0.4px per frame" read back
    // from the DOM rounds away to a near-standstill. When the user scrolls
    // (drag/wheel/arrows), resync from the DOM instead of gliding from a
    // stale position.
    let pos = track.scrollLeft;
    const onScroll = () => {
      if (Math.abs(track.scrollLeft - pos) > 2) pos = track.scrollLeft;
    };
    track.addEventListener('scroll', onScroll, { passive: true });

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
      last = t;
      if (!visible || hovered || document.hidden || t < holdUntil) return;
      const half = track.scrollWidth / 2;
      if (half <= track.clientWidth) return; // not enough content to loop
      pos += SPEED * dt;
      if (pos >= half) pos -= half;
      track.scrollLeft = pos;
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('pointerenter', onPointerEnter);
      track.removeEventListener('pointerleave', onPointerLeave);
      track.removeEventListener('focusin', onFocusIn);
      track.removeEventListener('focusout', onFocusOut);
      track.removeEventListener('touchstart', backOff);
      track.removeEventListener('wheel', backOff);
      track.removeEventListener('pointerdown', backOff);
    };
  }, []);

  // Desktop mice can't swipe and the scrollbar is hidden, so the rail felt
  // frozen unless you found the arrows (reported by FYI on the live concept).
  // Let mouse users click-drag the rail; a real drag swallows the click so it
  // doesn't also open the card link under the cursor.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let down = false;
    let startX = 0;
    let startLeft = 0;
    let dragged = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      dragged = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) dragged = true;
      if (dragged) {
        track.scrollLeft = startLeft - dx;
        e.preventDefault();
      }
    };
    const onPointerUp = () => { down = false; };
    const onClick = (e: MouseEvent) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
        dragged = false;
      }
    };

    track.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    track.addEventListener('click', onClick, true);
    return () => {
      track.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      track.removeEventListener('click', onClick, true);
    };
  }, []);

  return (
    <section id="fleet" className="bg-yacht-cream py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <Eyebrow>Curated Inventory</Eyebrow>
            <h2 className="mt-6 text-3xl font-light tracking-wide text-yacht-900 lg:text-4xl">
              Featured Listings
            </h2>
          </Reveal>
          <Reveal delay={200} className="flex items-center gap-3">
            <a
              href="/yachts-for-sale"
              className="group mr-2 inline-flex items-center gap-3 border border-yacht-900/25 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900 transition-all hover:border-yacht-brand hover:text-yacht-brand"
            >
              View all listings
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="Previous yachts"
              className="border border-yacht-900/20 p-3 text-yacht-900 transition-all hover:border-yacht-brand hover:text-yacht-brand"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="Next yachts"
              className="border border-yacht-900/20 p-3 text-yacht-900 transition-all hover:border-yacht-brand hover:text-yacht-brand"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </Reveal>
        </div>
      </div>

      <Reveal delay={250}>
        <div
          ref={trackRef}
          className="mt-14 flex gap-6 overflow-x-auto px-6 pb-6 lg:px-[max(1.5rem,calc((100vw-80rem)/2+2rem))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab select-none active:cursor-grabbing"
        >
          {/* The whole card sequence renders twice so the auto-drift can wrap
              seamlessly at the halfway point. The clone is inert + aria-hidden:
              screen readers and the tab order see each boat exactly once.
              (CSS scroll-snap was removed here — it fights the drift.) */}
          {[false, true].map((clone) => (
          <div key={clone ? 'loop-copy' : 'primary'} className="contents" aria-hidden={clone || undefined} inert={clone || undefined}>
          {fleet.map((yacht) => (
            <article
              key={yacht.id}
              className="group w-[85vw] max-w-sm shrink-0 bg-white shadow-sm transition-shadow duration-500 hover:shadow-xl sm:w-[380px]"
            >
              {/* The whole card is the link — visitors click the photo, not
                  just a small "View details" label. */}
              <a href={`/listing/${yacht.id}`} className="block" draggable={false}>
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={yacht.image}
                    alt={`${yacht.builder} — ${yacht.name}`}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 bg-yacht-900/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-yacht-cream backdrop-blur-sm">
                    {yacht.length}
                  </span>
                </div>
                <div className="p-7">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-yacht-brand">
                    {yacht.builder}
                  </p>
                  <h3 className="mt-2 text-xl font-light tracking-wide text-yacht-900">{yacht.name}</h3>
                  <dl className="mt-5 flex items-center gap-6 border-t border-yacht-900/10 pt-5 text-yacht-900/70">
                    <div>
                      <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">LOA</dt>
                      <dd className="mt-1 text-sm font-light">{yacht.length}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Year</dt>
                      <dd className="mt-1 text-sm font-light">{yacht.year}</dd>
                    </div>
                    <div className="ml-auto text-right">
                      <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Asking</dt>
                      <dd className="mt-1 text-sm font-medium text-yacht-900">{yacht.price}</dd>
                    </div>
                  </dl>
                  <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900 transition-colors group-hover:text-yacht-brand">
                    View details
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </a>
            </article>
          ))}

          <a
            href="/yachts-for-sale"
            className="flex w-[85vw] max-w-sm shrink-0 flex-col items-center justify-center gap-5 border border-dashed border-yacht-900/25 bg-transparent p-10 text-center transition-colors hover:border-yacht-brand sm:w-[380px]"
          >
            <Anchor className="h-8 w-8 text-yacht-brand" />
            <p className="text-lg font-light tracking-wide text-yacht-900">Search the worldwide inventory</p>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-brand">
              Open yacht search <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </a>
          </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------ featured charter */

// FYI's own crewed charter fleet, immediately below the for-sale rail so the
// homepage leads with both revenue lines (client direction, 2026-07-27).
function FeaturedCharter() {
  const fleet = CHARTER_FLEET.slice(0, 4);
  // The published fleet is down to one vessel, and a lone card in a four-up
  // grid reads as three failed images. Track the count instead of hard-coding
  // four, so this section stays right whichever way the fleet moves.
  const fleetCols =
    fleet.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4'
    : fleet.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3'
    : fleet.length === 2 ? 'sm:grid-cols-2'
    : 'max-w-xl';
  return (
    <section id="charter-fleet" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <Eyebrow>Charter the Fleet</Eyebrow>
            <h2 className="mt-6 text-3xl font-light tracking-wide text-yacht-900 lg:text-4xl">
              Featured for Charter
            </h2>
            <p className="mt-4 max-w-xl text-[15px] font-light leading-7 text-yacht-900/70">
              Captain, crew, fuel, and provisioning arranged by FYI — step aboard for an
              afternoon or a week. From {CHARTER_FROM_PRICE}.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <a
              href="/charter"
              className="group inline-flex items-center gap-3 border border-yacht-900/25 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900 transition-all hover:border-yacht-brand hover:text-yacht-brand"
            >
              See the whole fleet
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Reveal>
        </div>

        <div className={`mt-14 grid gap-6 ${fleetCols}`}>
          {fleet.map((v, i) => (
            <Reveal key={v.slug} delay={i * 110}>
              {/* Not a link — the section CTA above is the only route into
                  the charter fleet (client direction). */}
              <div className="group block bg-yacht-cream shadow-sm transition-shadow duration-500 hover:shadow-xl">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={optImg(v.image, 800)}
                    srcSet={srcSet(v.image, [480, 800, 1080])}
                    sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                    alt={v.alt ?? v.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 bg-yacht-900/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-yacht-cream backdrop-blur-sm">
                    {v.lengthFt}&prime;
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-light tracking-wide text-yacht-900">{v.name}</h3>
                  <p className="mt-2 line-clamp-2 text-[13px] font-light leading-6 text-yacht-900/65">{v.blurb}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-yacht-900/10 pt-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yacht-900/45">
                      Up to {v.guests} guests
                    </span>
                    <span className="text-[13px] font-medium text-yacht-brand">{fromRate(v)}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- yacht match */

const MATCH_STEPS = [
  { step: '01', title: 'Tell us your taste', copy: 'Pick the categories, sizes, and budget that fit — a 60-second profile, no account needed to browse.' },
  { step: '02', title: 'We match the fleet', copy: 'Your profile is scored against our inventory, and our brokers source anything we do not have listed.' },
  { step: '03', title: 'Never miss a move', copy: 'Save favorites as you go, and opt in to price-drop and new-listing alerts on the yachts you love.' },
];

function YachtMatchPromo() {
  return (
    <section id="yacht-match" className="border-y border-white/10 bg-yacht-800 py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <Reveal>
          <Eyebrow light>Find Your Yacht Match</Eyebrow>
          <h2 className="mt-6 text-3xl font-light leading-snug tracking-wide text-white lg:text-4xl">
            The right yacht should
            <span className="italic"> find you</span>
          </h2>
          <p className="mt-7 text-[15px] font-light leading-8 tracking-wide text-white/70">
            More marketplace than brokerage page: build a buyer profile in under a
            minute and let our matchmaking surface the vessels that fit — with
            favorites, alerts, and every spec in one place.
          </p>
          <Link
            to="/quiz"
            className="group mt-10 inline-flex items-center gap-3 bg-yacht-brand px-9 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition-all duration-300 hover:bg-yacht-brand-light"
          >
            Start your match
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <Reveal delay={200}>
          <ol className="space-y-8">
            {MATCH_STEPS.map((s) => (
              <li key={s.step} className="flex gap-6 border-b border-white/10 pb-8 last:border-b-0 last:pb-0">
                <span className="text-2xl font-extralight text-yacht-teal" aria-hidden="true">{s.step}</span>
                <div>
                  <h3 className="text-[15px] font-semibold uppercase tracking-[0.15em] text-white">{s.title}</h3>
                  <p className="mt-2 text-[13px] font-light leading-6 text-white/60">{s.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- parallax quote */

/* ------------------------------------------------- new construction band */

function NewConstruction() {
  return (
    <section id="new-construction" className="bg-yacht-cream py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <Reveal className="relative">
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={IMG.newBuild}
              alt="The 2026 Posillipo Technema 90 new build, an FYI Yachts listing"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -right-4 hidden border border-yacht-teal/40 bg-yacht-800 px-8 py-6 lg:block">
            <p className="text-2xl font-light text-yacht-cream">Lease-to-Own</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.25em] text-yacht-teal">
              Flexible ownership programs
            </p>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <Eyebrow>New Construction &amp; Ownership</Eyebrow>
          <h2 className="mt-6 text-3xl font-light leading-snug tracking-wide text-yacht-900 lg:text-4xl">
            Commission the yacht
            <span className="italic"> of your dreams</span>
          </h2>
          <p className="mt-7 text-[15px] font-light leading-8 tracking-wide text-yacht-900/75">
            As direct partners of the world&rsquo;s foremost shipyards, we shepherd new
            builds from first rendering to maiden voyage. Prefer flexibility? Our
            lease-to-own program pairs modern financing — including cryptocurrency
            settlement — with the freedom to step aboard sooner.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              'Direct shipyard relationships with 30+ featured brands',
              'Owner representation through design, build, and delivery',
              'Financing, trade-in, and lease-to-own structures',
            ].map((item) => (
              <li key={item} className="flex items-start gap-4 text-sm font-light tracking-wide text-yacht-900/80">
                <span className="mt-2 h-px w-6 shrink-0 bg-yacht-brand" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="group mt-10 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-yacht-brand transition-colors hover:text-yacht-900"
          >
            Start the conversation
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- destinations */

const DESTINATIONS = [
  {
    name: 'Miami & Biscayne Bay',
    note: 'Skyline sunsets, Nixon Sandbar, and the city at your stern.',
    image: IMG.destMiami,
    alt: 'The Miami skyline seen from Biscayne Bay',
  },
  {
    name: 'The Florida Keys',
    note: 'Islamorada to Key West — gin-clear flats and slow horizons.',
    image: IMG.destKeys,
    alt: 'An aerial view of a Florida Keys sandbar and shallow turquoise water',
  },
  {
    name: 'The Bahamas & Beyond',
    note: 'Bimini, the Exumas, and open Atlantic passages.',
    image: IMG.destBahamas,
    alt: 'A Bahamian cay ringed by clear turquoise water',
  },
];

// Lives on the charter page now (client direction) — the destinations are a
// charter question, not a brokerage one.
export function Destinations() {
  return (
    <section id="destinations" className="bg-yacht-cream py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal className="text-center">
          <Eyebrow>Where To Next</Eyebrow>
          <h2 className="mt-6 text-3xl font-light tracking-wide text-yacht-900 lg:text-4xl">
            Waters we know by heart
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {DESTINATIONS.map((destination, i) => (
            <Reveal key={destination.name} delay={i * 150}>
              <figure className="group">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={destination.image}
                    alt={destination.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-yacht-900/10 transition-colors duration-500 group-hover:bg-transparent" />
                </div>
                <figcaption className="border-b border-yacht-900/10 py-6">
                  <h3 className="text-lg font-light tracking-[0.08em] text-yacht-900">{destination.name}</h3>
                  <p className="mt-2 text-[13px] font-light leading-6 text-yacht-900/60">{destination.note}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- brands */

function BrandsMarquee() {
  return (
    <section className="overflow-hidden border-y border-white/10 bg-yacht-800 py-14">
      <Reveal className="text-center">
        <Eyebrow light>Featured Brands</Eyebrow>
      </Reveal>
      <div className="group mt-10" aria-label={`Featured brands: ${BRAND_LOGOS.map(b => b.name).join(', ')}`}>
        <div className="animate-marquee flex w-max items-center group-hover:[animation-play-state:paused]">
          {[...BRAND_LOGOS, ...BRAND_LOGOS].map((brand, i) => (
            <span key={`${brand.name}-${i}`} aria-hidden={i >= BRAND_LOGOS.length} className="flex items-center px-10">
              {/* FYI's logo set is black-on-transparent; invert renders it white on navy. */}
              <img
                src={brand.url}
                alt={i < BRAND_LOGOS.length ? brand.name : ''}
                loading="lazy"
                className="h-9 w-auto max-w-[160px] object-contain opacity-60 invert transition-opacity duration-300 hover:opacity-90"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- team */

function MeetTheTeam() {
  return (
    <section id="team" className="bg-yacht-900 py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <Reveal className="order-2 lg:order-1">
          <Eyebrow light>The People Behind the Passion</Eyebrow>
          <h2 className="mt-6 text-3xl font-light leading-snug tracking-wide text-white lg:text-4xl">
            Brokers who&rsquo;ve spent their
            <span className="italic"> lives on the water</span>
          </h2>
          <p className="mt-7 text-[15px] font-light leading-8 tracking-wide text-white/70">
            Three hundred years of combined experience under one roof in Miami
            — every broker a specialist, every client relationship built to
            outlast the sale. See who we are, what we&rsquo;ve sold, and who to call.
          </p>
          <a
            href="/our-team"
            className="group mt-10 inline-flex items-center gap-3 border border-white/40 px-9 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition-all duration-300 hover:border-yacht-brand hover:bg-yacht-brand"
          >
            Meet the team
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </Reveal>
        <Reveal delay={200} className="order-1 lg:order-2">
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={IMG.team}
              alt="The FYI Yachts team outside the Florida Yachts International office"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- contact */

function ContactBand() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const guard = useFormGuard();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/contact/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message: message || `${interest} inquiry from the homepage.`,
          attribution: getAttribution(),
          ...guardFields(guard),
          yacht: { title: interest || 'Homepage private inquiry' },
        }),
      });
      if (!res.ok) { setState('error'); return; }
      trackEvent('inquiry_submit', { context: 'homepage_contact_band' });
      trackEvent('generate_lead', { context: 'homepage_contact_band' });
      identifyVisitor(email);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <section id="contact" className="bg-yacht-900 py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2 lg:gap-24 lg:px-8">
        <Reveal>
          <Eyebrow light>Begin the Conversation</Eyebrow>
          <h2 className="mt-6 text-3xl font-light leading-snug tracking-wide text-white lg:text-4xl">
            Your next horizon is a
            <span className="italic"> phone call away</span>
          </h2>
          <div className="mt-10 space-y-6">
            <a href={PHONE_TEL} className="group flex items-center gap-5">
              <span className="flex h-12 w-12 items-center justify-center border border-white/15 transition-colors group-hover:border-yacht-brand">
                <Phone className="h-5 w-5 text-yacht-teal" />
              </span>
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
                  Call us directly
                </span>
                <span className="mt-1 block text-lg font-light tracking-wider text-white">{PHONE_DISPLAY}</span>
              </span>
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="group flex items-center gap-5">
              <span className="flex h-12 w-12 items-center justify-center border border-white/15 transition-colors group-hover:border-yacht-brand">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-yacht-teal" aria-hidden="true">
                  <path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.58-.35zM12.05 21.8h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.72.98.99-3.63-.23-.37a9.77 9.77 0 0 1-1.5-5.22c0-5.4 4.4-9.8 9.82-9.8a9.75 9.75 0 0 1 9.8 9.81c0 5.4-4.4 9.8-9.79 9.8zm8.34-18.15A11.7 11.7 0 0 0 12.04 0C5.46 0 .1 5.35.1 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.24-1.64a11.94 11.94 0 0 0 5.8 1.48c6.58 0 11.94-5.36 11.94-11.95 0-3.19-1.24-6.19-3.5-8.44z" />
                </svg>
              </span>
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
                  WhatsApp
                </span>
                <span className="mt-1 block text-lg font-light tracking-wider text-white">(786) 353-8073</span>
              </span>
            </a>
            <div className="flex items-center gap-5">
              <span className="flex h-12 w-12 items-center justify-center border border-white/15">
                <MapPin className="h-5 w-5 text-yacht-teal" />
              </span>
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
                  Headquarters
                </span>
                <span className="mt-1 block text-lg font-light tracking-wide text-white">{ADDRESS}</span>
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={200} className="lg:pt-2">
          <div className="border border-white/10 bg-yacht-800/60 p-8 lg:p-10">
            {state === 'sent' ? (
              <div className="py-12 text-center">
                <Anchor className="mx-auto h-8 w-8 text-yacht-teal" />
                <p className="mt-6 text-xl font-light tracking-wide text-white">Thank you.</p>
                <p className="mt-3 text-sm font-light leading-6 text-white/60">
                  A member of our brokerage team will reach out shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">
                  Private Inquiry
                </p>
                <p className="mt-4 text-sm font-light leading-6 text-white/60">
                  Share a few details and a broker will respond within one business day.
                </p>
                <div className="mt-8 space-y-5">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full border-b border-white/20 bg-transparent py-3 text-sm font-light tracking-wide text-white placeholder:text-white/35 focus:border-yacht-brand focus:outline-none"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full border-b border-white/20 bg-transparent py-3 text-sm font-light tracking-wide text-white placeholder:text-white/35 focus:border-yacht-brand focus:outline-none"
                  />
                  <select
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    required
                    className="w-full border-b border-white/20 bg-transparent py-3 text-sm font-light tracking-wide text-white focus:border-yacht-brand focus:outline-none [&>option]:text-yacht-900"
                  >
                    <option value="" disabled>
                      I&rsquo;m interested in&hellip;
                    </option>
                    <option>Buying a yacht</option>
                    <option>Selling my yacht</option>
                    <option>Chartering</option>
                    <option>New construction</option>
                    <option>Lease-to-own</option>
                  </select>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your ideal time on the water"
                    className="w-full resize-none border-b border-white/20 bg-transparent py-3 text-sm font-light tracking-wide text-white placeholder:text-white/35 focus:border-yacht-brand focus:outline-none"
                  />
                  <HoneypotField guard={guard} />
                </div>
                <button
                  type="submit"
                  disabled={state === 'sending'}
                  className="mt-9 w-full bg-yacht-brand py-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition-colors duration-300 hover:bg-yacht-brand-light disabled:opacity-60"
                >
                  {state === 'sending' ? 'Sending…' : 'Submit Inquiry'}
                </button>
                {state === 'error' && (
                  <p className="mt-4 text-center text-[12px] text-yacht-brand">
                    Something went wrong — please try again or call {PHONE_DISPLAY}.
                  </p>
                )}
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- footer */

/* ----------------------------------------------------- testimonials */

function Testimonials() {
  return (
    <section className="bg-yacht-cream px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl lg:px-2">
        <Reveal>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Testimonials</p>
          <h2 className="mt-4 text-center text-3xl font-light tracking-wide text-yacht-900 lg:text-4xl">What Our Clients Say</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={i} delay={i * 120}>
              <figure className="flex h-full flex-col bg-white p-8 shadow-sm">
                {/* No star row: these quotes are verbatim from FYI's published
                    testimonial wall, but we hold no verified per-review rating
                    to back a 5-star graphic. See components/public/testimonials.ts. */}
                <Quote className="h-6 w-6 text-yacht-brand" aria-hidden="true" />
                <blockquote className="mt-5 flex-1 text-[14px] font-light leading-7 text-yacht-900/75">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 border-t border-yacht-900/10 pt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/50">
                  {t.who}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeFooter() {
  const columns = [
    {
      heading: 'Discover',
      links: [
        { label: 'Yachts for Sale', href: '/yachts-for-sale' },
        { label: 'Super Yachts', href: '/super-yachts-for-sale' },
        { label: 'New Yachts', href: '/new-yachts-for-sale' },
        { label: 'Used Yachts', href: '/used-yachts-for-sale' },
        { label: 'Sport Fishing', href: '/sport-fishing-yachts-for-sale' },
      ],
    },
    {
      heading: 'Services',
      links: [
        { label: 'List Your Yacht', href: '/sell' },
        { label: 'Charters', href: '/charter' },
        { label: 'Yacht Financing', href: '/yacht-financing' },
        { label: 'Lease-to-Own', href: '/lease-to-own' },
      ],
    },
    {
      heading: 'Top Brands',
      links: [
        { label: 'OKEAN Yachts', href: '/okean-yachts-for-sale' },
        { label: 'Azimut Yachts', href: '/azimut-yachts-for-sale' },
        { label: 'Sunseeker', href: '/sunseeker-yachts-for-sale' },
        { label: 'Hatteras', href: '/hatteras-yachts-for-sale' },
        { label: 'Pershing', href: '/pershing-yachts-for-sale' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About Us', href: '/about-us' },
        { label: 'Our Team', href: '/our-team' },
        { label: 'Client Results', href: '/case-studies' },
        { label: 'News', href: '/fyi-news' },
        { label: 'Miami Yacht Brokerage', href: '/miami-yacht-brokerage' },
        { label: 'Contact', href: '/contact' },
      ],
    },
  ];

  return (
    // bg matches the navbar's scrolled state (bg-yacht-900) so the page opens
    // and closes on the same tone.
    <footer className="border-t border-white/10 bg-yacht-900">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div>
            {/* Deliberately oversized, matching the current fyiyachts.com footer. */}
            <FYILogo className="h-20 w-auto lg:h-24" />
            <p className="mt-6 max-w-xs text-[13px] font-light leading-6 text-white/55">
              Florida Yachts International — brokerage, charter, and new construction
              from the heart of Miami.
            </p>
            <p className="mt-4 max-w-xs text-[13px] font-light leading-6 text-yacht-teal">
              {RESPONSE_PROMISE}
            </p>
            <div className="mt-7 flex items-center gap-4">
              {[
                { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/fyiyachts/' },
                { icon: Facebook, label: 'Facebook', href: 'https://www.facebook.com/fyiyachts' },
                { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/company/florida-yachts-international/' },
                { icon: Youtube, label: 'YouTube', href: 'https://www.youtube.com/@FYIYACHTS' },
              ].map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Florida Yachts International on ${label}`}
                  className="flex h-9 w-9 items-center justify-center border border-white/15 text-white/60 transition-colors hover:border-yacht-brand hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">
                {column.heading}
              </h3>
              <ul className="mt-6 space-y-3.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] font-light tracking-wide text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-[11px] font-light tracking-wider text-white/40">
            &copy; {new Date().getFullYear()} Florida Yachts International. All rights reserved.
            {' · '}
            <a href="/privacy-policy" className="transition-colors hover:text-white/70">Privacy Policy</a>
          </p>
          <p className="text-[11px] font-light tracking-wider text-white/40">
            <a href={GOOGLE_DIRECTIONS} target="_blank" rel="noreferrer" className="transition-colors hover:text-white/70">
              {ADDRESS}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------- page */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-yacht-900 font-sans text-white antialiased">
      <HomeNav />
      {/* Inventory leads: the for-sale rail and the charter fleet sit directly
          under the hero for maximum exposure (client direction, 2026-07-27). */}
      <main>
        <Hero />
        <FeaturedFleet />
        <FeaturedCharter />
        <StatsBar />
        <EditorialIntro />
        <Services />
        <BrowseByType />
        <YachtMatchPromo />
        <NewConstruction />
        <BrandsMarquee />
        <MeetTheTeam />
        <Testimonials />
        <FaqSection
          heading="Buying, selling, and chartering — the questions we get most"
          faqs={GENERAL_FAQS}
          dark
          background="bg-yacht-800"
          iconClassName="text-xl"
        />
        <ContactBand />
      </main>
      <HomeFooter />
      <BriannaWidget />
      <StickyCta context="Homepage" inquireHref="/contact" label="Contact" />
    </div>
  );
}
