import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Anchor, Camera, ChevronLeft, ChevronRight, Loader2, Play, Share2, X } from 'lucide-react';
import { FinanceCalculator, InsuranceQuoteCta } from './BuyerTools';
import { ListingDescription, ListingDisclaimer, ListingSections, SpecGroups } from './ListingDetails';
import { buildSpecGroups, fmtDate, unmappedFields } from './specFields';
import { AiOverview, ContactButtons, LocationMap, MoreLikeThis, RecentlySoldStrip, StickyMobileCta } from './ListingExtras';
import { CreateYachtProfileCta } from './CreateYachtProfileCta';
import { HomeNav, HomeFooter } from '../home/HomePage';
import BriannaWidget from '../chat/BriannaWidget';
import { PublicInquiryForm } from '../public/PublicPages';
import { useJsonLd } from '../../utils/useJsonLd';
import { Breadcrumbs } from '../public/Breadcrumbs';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';
import { track } from '../../utils/analytics';
import { trackMetaViewContent } from '../../utils/metaPixel';
import { optImg, srcSet } from '../../utils/img';
import { countryName } from '../../api/_lib/countryName';
import { formatMoney, listPrice, usdEquivalent, type Money } from '../../api/_lib/price';
import { buildListingContent, type ListingContent } from '../../api/_lib/listingContent';
import { buildListingSeo, listingJsonLd } from '../../api/_lib/listingSeo';
import { fetchJsonShared } from '../../utils/sharedFetch';
import { reductionFor, useReducedPrices } from '../../utils/useReducedPrices';

/** Hero photo widths and layout size; api/listing.ts preloads the same pair. */
const HERO_WIDTHS = [640, 960, 1280, 1600];
const HERO_SIZES = '(min-width: 1280px) 1216px, calc(100vw - 48px)';

// Public, no-login yacht detail page (route: /listing/:id), styled after the
// listing template on fyiyachts.com (2026-07-22 client request): breadcrumb, big
// hero with a VIEW PHOTOS lightbox, thumbnail strip, serif-italic section
// headings, the standard disclaimer, and a sticky identity sidebar (model
// name, asking price, ENQUIRE modal, share, wishlist). FYI palette and
// Montserrat body stay; the serif accents mirror the template's headings.
//
// Since 2026-11-13 the page shows everything the feed has:
//   - the full description plus every AdditionalDetailDescription section
//     (cleaned, contact details filtered — api/_lib/listingContent.ts);
//   - a data-driven spec table: only the rows and groups the boat actually
//     has, never "--" (components/listing/specFields.ts);
//   - "Price Reduced" for 90 days after a recorded drop (utils/useReducedPrices).
// FYI exclusives and co-brokerage boats are indexed alike; the co-brokerage
// courtesy line (PlsDisclaimer) is shown exactly as BoatsGroup sends it.

interface Boat {
  /** 'cobrokerage' for BoatsGroup PLS listings; FYI's own boats leave it unset. */
  listingType?: string;
  id: string;
  title: string;
  boatName?: string;
  /** USD-equivalent asking price (NormPrice) — finance calculator only. */
  price?: number;
  /** Asking price in the listing's own currency — what the page displays. */
  listPrice?: Money;
  year?: number;
  make?: string;
  model?: string;
  lengthFt?: number;
  category?: string;
  condition?: string;
  location?: string;
  images: string[];
  /** Watchable YouTube videos (exclusives; api/_lib/listingVideos.ts). Shown right after the main photo. */
  videos: { id: string; title?: string }[];
  /** Plain-text description (insurance / JSON-LD); the page renders `content`. */
  description?: string;
  /** Cleaned description, detail sections, feed disclaimer and ListingTitle tag. */
  content: ListingContent;
  /** The raw feed record: the spec table is built from it (specFields.ts). */
  raw: Record<string, any>;
  /** PLS courtesy line for co-brokerage boats ("…centrally listed by Yachts360."). */
  courtesy?: string;
}

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/** The asking price as shown, in the listing's own currency ("€845,000"). */
const askingPrice = (b: Boat): string => formatMoney(b.listPrice, 'Price on Request');

// Listing lookup: retry a failed request after 1s, then 3s. The per-attempt
// timeout sits above the proxy's own worst case (feed + retry, PLS + retry).
const LISTING_RETRY_DELAYS = [1000, 3000];
const LISTING_FETCH_TIMEOUT_MS = 45_000;
// Longest a 429's Retry-After is honoured before the next attempt.
const LISTING_MAX_RETRY_AFTER_MS = 60_000;

const stripHtml = (s: string) =>
  s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function normalize(it: any): Boat {
  const loc = it.BoatLocation || {};
  const images: string[] = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  const title = it.BoatName || [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim() || 'Yacht';
  const content = buildListingContent(it);
  return {
    id: String(it.DocumentID || ''),
    listingType: it.ListingType || undefined,
    title,
    boatName: it.BoatName || undefined,
    price: usdEquivalent(it),
    listPrice: listPrice(it),
    year: it.ModelYear ? Number(it.ModelYear) : undefined,
    make: it.MakeString || undefined,
    model: it.Model || undefined,
    lengthFt: num(it.LengthOverall ?? it.NominalLength),
    category: it.BoatCategoryCode || undefined,
    condition: it.SaleClassCode || undefined,
    location: [loc.BoatCityName && loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : null, loc.BoatStateCode || countryName(loc.BoatCountryID)]
      .filter(Boolean).join(', ') || undefined,
    // Every photo the feed has. The gallery loads one at a time (lightbox) and
    // the page itself shows only the hero and six thumbnails, so a 200-photo
    // listing costs no more to load than a 30-photo one.
    images,
    videos: Array.isArray(it.FyiVideos)
      ? it.FyiVideos.filter((v: any) => typeof v?.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.id))
        .map((v: any) => ({ id: v.id, ...(typeof v.title === 'string' ? { title: v.title } : {}) }))
      : [],
    description: content.descriptionText || undefined,
    content,
    raw: it,
    courtesy: typeof it.PlsDisclaimer === 'string' ? stripHtml(it.PlsDisclaimer) || undefined : undefined,
  };
}

/* ------------------------------------------------ template pieces */

// Moved to GalleryPieces.tsx so the eager public bundle (CharterPages) can
// use them without pulling this whole page in; re-exported for compatibility.
import { SpecSection, Lightbox, isGalleryVideo, youtubeThumb, type GalleryEntry } from './GalleryPieces';
export { SpecSection, Lightbox };

function EnquireModal({ boat, onClose }: { boat: Boat; onClose: () => void }) {
  useLockBodyScroll(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-label="Enquire about this yacht">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-yacht-900/80 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white p-8">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-yacht-900/50 transition-colors hover:text-yacht-brand">
          <X className="h-5 w-5" />
        </button>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yacht-teal">Private Inquiry</p>
        <h3 className="mt-2 font-serif text-2xl italic text-yacht-900">{boat.title}</h3>
        {/* FYI Exclusives are listed by the brokerage, never a named broker
            (client, 2026-10-27). Co-brokerage boats show no line at all. */}
        {boat.listingType !== 'cobrokerage' && (
          <p className="mt-2 text-[13px] font-light text-yacht-900/60">
            Listed by <span className="font-semibold text-yacht-900">FYI Yachts</span>
          </p>
        )}
        <div className="mt-5">
          <PublicInquiryForm context={boat.title} messagePlaceholder="Your message (optional)" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------- no longer available */

interface SimilarCard { id: string; title: string; boatName?: string; price: string; image?: string; location?: string }

/**
 * A listing that has left the feeds (sold or withdrawn): never an empty page.
 * api/listing.ts answers these URLs 410 with the same content and leaves the
 * similar boats it found in a #fyi-similar data block; after an in-app hop
 * there is no such block, so FYI's leading boats are fetched instead.
 */
function GoneListing({ id }: { id: string }) {
  const [boats, setBoats] = useState<SimilarCard[]>(() => {
    try {
      const data = JSON.parse(document.getElementById('fyi-similar')?.textContent || 'null');
      return data && String(data.id) === id && Array.isArray(data.boats) ? data.boats : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (boats.length) return;
    let alive = true;
    fetchJsonShared<any>('/api/yachts/showcase?sections=menuTop')
      .then((d) => {
        if (!alive || !Array.isArray(d?.menuTop)) return;
        setBoats(d.menuTop.slice(0, 6).map((c: any) => ({
          id: String(c.id),
          title: [c.year, c.make, c.model].filter(Boolean).join(' ') || c.name,
          price: formatMoney(c.listPrice),
          image: c.image,
        })));
      })
      .catch(() => { /* the page stands without suggestions */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="min-h-dvh bg-yacht-cream font-sans text-yacht-900 antialiased">
      <HomeNav />
      <div className="bg-yacht-900 px-6 pb-14 pt-36 text-center">
        <Anchor className="mx-auto h-10 w-10 text-white/30" />
        <h1 className="mt-5 text-2xl font-light tracking-wide text-white">This yacht is no longer available</h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] font-light text-white/65">
          It has been sold or withdrawn from the market. Our brokers can find you one like it.
        </p>
        <a
          href="/yachts-for-sale"
          className="mt-7 inline-block bg-yacht-brand px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          Browse all yachts for sale
        </a>
      </div>
      {boats.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">Similar yachts available now</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {boats.map((b) => (
              <a key={b.id} href={`/listing/${b.id}`} className="group block overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-md">
                {b.image && (
                  <img src={optImg(b.image, 640)} alt={`${b.title} for sale`} width={640} height={480} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                )}
                <div className="p-4">
                  <h3 className="truncate text-[14px] font-medium tracking-wide text-yacht-900">{b.title}</h3>
                  {b.boatName && <p className="truncate text-[12px] font-light italic text-yacht-900/55">{b.boatName}</p>}
                  <p className="mt-1 text-[13px] font-semibold text-yacht-900/80">{b.price}{b.location ? ` · ${b.location}` : ''}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
      <HomeFooter />
    </div>
  );
}

/* --------------------------------------------------------- page */

export default function PublicListingPage() {
  const { id = '' } = useParams();
  const [boat, setBoat] = useState<Boat | null>(null);
  // 'gone' only on a clean 200 with no such boat; 'unavailable' when the
  // lookup failed (network, timeout, non-OK status) even after retries.
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'unavailable'>('loading');
  const [reload, setReload] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [enquire, setEnquire] = useState(false);
  const [shared, setShared] = useState(false);

  // Never tell a visitor a live boat is gone because of an error: only a clean
  // 200 with no results means "no longer available". Anything else — network
  // error, timeout, 429/5xx, a body that isn't the expected JSON — is retried
  // after 1s and 3s, then shown as a temporary problem with a Retry button.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let ctl: AbortController | null = null;
    setState('loading');
    (async () => {
      // A 429 is retried only after the server's Retry-After (capped), never
      // on the short 1s/3s schedule.
      let waitMs = 0;
      for (let attempt = 0; attempt <= LISTING_RETRY_DELAYS.length; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, waitMs || LISTING_RETRY_DELAYS[attempt - 1]));
        if (!alive) return;
        waitMs = 0;
        ctl = new AbortController();
        const timer = setTimeout(() => ctl?.abort(), LISTING_FETCH_TIMEOUT_MS);
        try {
          const r = await fetch(`/api/yachts/proxy?documentid=${encodeURIComponent(id)}`, { signal: ctl.signal });
          if (r.status === 429) {
            const ra = Number(r.headers.get('Retry-After'));
            waitMs = Math.min((Number.isFinite(ra) && ra > 0 ? ra : 30) * 1000, LISTING_MAX_RETRY_AFTER_MS);
          }
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await r.json();
          if (!d || typeof d !== 'object' || d.error) throw new Error('bad response');
          const item = Array.isArray(d.results) ? d.results[0] : null;
          if (!alive) return;
          if (item) {
            const b = normalize(item);
            setBoat(b);
            setState('ready');
            // Same title the server render sends (api/_lib/listingSeo.ts).
            document.title = buildListingSeo(item, b.content, window.location.origin).pageTitle;
            // Fields the API returned that the spec map doesn't know yet —
            // add them to SPEC_FIELDS (api/_lib/specFields.ts). Dev only.
            if (import.meta.env.DEV) {
              const unknown = unmappedFields(item);
              if (Object.keys(unknown).length) console.info('[listing] unmapped API fields:', unknown);
            }
            return;
          }
          if (d.numResults === 0 || d.results == null || (Array.isArray(d.results) && d.results.length === 0)) {
            setState('gone');
            return;
          }
          throw new Error('unexpected response');
        } catch {
          // fall through to the next attempt
        } finally {
          clearTimeout(timer);
        }
      }
      if (alive) setState('unavailable');
    })();
    return () => { alive = false; ctl?.abort(); };
  }, [id, reload]);

  // Meta ViewContent once the listing has loaded: DocumentID, "<year> <make>
  // <model>", never the price.
  useEffect(() => {
    if (boat) trackMetaViewContent({ id: boat.id || id, year: boat.year, make: boat.make, model: boat.model, title: boat.title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boat?.id]);

  // Co-brokerage boats are indexed exactly like exclusives (2026-11-13). A
  // noindex tag left by an earlier build or another page must not survive an
  // SPA hop onto a listing.
  useEffect(() => {
    if (boat) document.head.querySelector('meta[name="robots"][content^="noindex"]')?.remove();
  }, [boat]);

  const reducedMap = useReducedPrices();
  // Never for a hidden price: reductionFor needs a shown price to compare with.
  const reduction = boat ? reductionFor(reducedMap, boat.id, boat.listPrice) : undefined;
  const specGroups = useMemo(
    () => (boat ? buildSpecGroups(boat.raw, { reduction }) : []),
    [boat, reduction],
  );

  // Product / Vehicle markup — the same object api/listing.ts puts in the
  // server HTML (offers only when the price is shown). Skipped when that
  // server copy is already in <head>, so a listing never carries it twice.
  useJsonLd('listing', useMemo(() => {
    if (!boat) return null;
    const canonical = `https://fyiyachts.com/listing/${boat.id}`;
    const fromServer = [...document.head.querySelectorAll('script[type="application/ld+json"]:not([data-jsonld])')]
      .some((el) => (el.textContent || '').includes(`"url":"${canonical}"`));
    if (fromServer) return null;
    return listingJsonLd(boat.raw, boat.content, buildListingSeo(boat.raw, boat.content, 'https://fyiyachts.com'), canonical);
  }, [boat]));

  const share = async () => {
    const url = window.location.href;
    track('share_click', { context: boat?.title });
    try {
      if (navigator.share) { await navigator.share({ title: boat?.title, url }); return; }
    } catch { /* fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* ignore */ }
  };

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-yacht-900">
        <Loader2 className="h-6 w-6 animate-spin text-yacht-brand" />
      </div>
    );
  }
  if (state === 'unavailable') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-yacht-900 px-6 text-center">
        <Anchor className="h-10 w-10 text-white/30" />
        <p className="max-w-md text-lg font-light text-white/80">
          We&rsquo;re having trouble loading this listing — please refresh in a moment.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className="bg-yacht-brand px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
          >
            Retry
          </button>
          <a
            href="/yachts-for-sale"
            className="border border-white/25 px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:border-yacht-brand"
          >
            Browse all yachts
          </a>
        </div>
      </div>
    );
  }
  if (state === 'gone' || !boat) return <GoneListing id={id} />;

  // Main photo first, then the listing's videos, then the other photos.
  const gallery: GalleryEntry[] = boat.images.length
    ? [boat.images[0], ...boat.videos.map((v) => ({ youtube: v.id, title: v.title })), ...boat.images.slice(1)]
    : [];
  const hero = boat.images[0];
  const metric = boat.lengthFt ? `${Math.round(boat.lengthFt)}'/${(boat.lengthFt * 0.3048).toFixed(1)}m` : undefined;
  const displayModel = boat.model || boat.title;

  return (
    <div className="min-h-dvh bg-yacht-cream font-sans text-yacht-900 antialiased">
      <HomeNav />

      {/* Breadcrumb — the shared semantic <nav><ol>, matching the
          BreadcrumbList JSON-LD this route emits (api/listing.ts). The
          "← Back to Search" affordance is kept underneath it. */}
      <div className="mx-auto max-w-7xl px-6 pb-4 pt-28 lg:px-8 lg:pt-32">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Yachts for Sale', href: '/yachts-for-sale' },
            { label: [boat.make, boat.model].filter(Boolean).join(' ') || boat.title },
          ]}
        />
        <p className="mt-2 text-[13px] font-light text-yacht-900/60">
          <a href="/yachts-for-sale" className="transition-colors hover:text-yacht-brand">&larr; Back to Search</a>
        </p>
      </div>

      {/* Hero photo + VIEW PHOTOS lightbox trigger */}
      {gallery.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden bg-yacht-900/5">
            <button type="button" onClick={() => setLightbox(0)} aria-label={`View ${gallery.length} photos`} className="block w-full cursor-zoom-in">
              {/* The page's largest paint: fetched first, at the width it is shown.
                  api/listing.ts preloads this same src/srcset — keep the two in
                  step (HERO_WIDTHS / HERO_SIZES). */}
              <img
                src={optImg(hero, 1280)}
                srcSet={srcSet(hero, HERO_WIDTHS)}
                sizes={HERO_SIZES}
                width={1280}
                height={960}
                loading="eager"
                fetchPriority="high"
                alt={`${boat.title} — main photo`}
                className="max-h-[70vh] min-h-[320px] w-full object-cover lg:aspect-[16/8]"
              />
            </button>
            <button
              type="button"
              onClick={() => setLightbox(0)}
              className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-yacht-900 shadow-sm transition-colors hover:bg-yacht-brand hover:text-white"
            >
              <Camera className="h-4 w-4" /> View Photos ({boat.images.length}){boat.videos.length ? ` & Video${boat.videos.length > 1 ? 's' : ''}` : ''}
            </button>
          </div>
          {gallery.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-6">
              {gallery.slice(1, 7).map((entry, idx) => {
                const video = isGalleryVideo(entry);
                return (
                <button key={(video ? entry.youtube : entry) + idx} type="button" onClick={() => setLightbox(idx + 1)}
                  aria-label={video ? `Play video${entry.title ? `: ${entry.title}` : ''}` : `Photo ${idx + 2}`}
                  className="group relative overflow-hidden">
                  <img src={video ? youtubeThumb(entry.youtube) : optImg(entry, 320)} alt="" width={320} height={240} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {video && (
                    <span className="absolute inset-0 flex items-center justify-center bg-yacht-900/25 transition-colors group-hover:bg-yacht-900/10">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-yacht-900 shadow-md transition-colors group-hover:bg-yacht-brand group-hover:text-white">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </span>
                    </span>
                  )}
                  {idx === 5 && gallery.length > 7 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-yacht-900/60 text-[13px] font-semibold tracking-widest text-white">
                      +{gallery.length - 7}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <main className="mx-auto grid max-w-7xl gap-12 px-6 py-12 lg:grid-cols-3 lg:px-8">
        {/* Left: listing sections */}
        <div className="lg:col-span-2">
          {/* Description */}
          <section>
            <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">Description</h2>
            <div className="mt-5">
              <AiOverview id={boat.id} />
              <ListingDescription content={boat.content} />
            </div>
          </section>

          {/* Order (client, 2026-11-13): description, specifications, then the
              longer detail sections as drop-downs. api/listing.ts matches. */}
          <SpecGroups groups={specGroups} />
          <ListingSections sections={boat.content.sections} />

          {/* City-level location map — never an exact berth */}
          <LocationMap location={boat.location} />

          {/* Buyer tools (FYI meeting 2026-07-17): financing + insurance */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <FinanceCalculator price={boat.price} tone="light" />
            <InsuranceQuoteCta
              tone="light"
              yacht={{
                title: boat.title,
                price: askingPrice(boat),
                year: boat.year ? String(boat.year) : undefined,
                make: boat.make,
                model: boat.model,
                length: boat.lengthFt ? `${boat.lengthFt} ft` : undefined,
                location: boat.location,
              }}
            />
          </div>

          <MoreLikeThis id={boat.id} make={boat.make} lengthFt={boat.lengthFt} />
          <RecentlySoldStrip id={boat.id} make={boat.make} lengthFt={boat.lengthFt} />

          {/* The feed's own Disclaimer section when it has one, else ours — shown once. */}
          <ListingDisclaimer html={boat.content.disclaimerHtml} />
        </div>

        {/* Right: identity sidebar */}
        <aside id="inquire" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="border border-yacht-900/10 bg-white p-7">
            {boat.listingType !== 'cobrokerage' && (
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-yacht-brand">
                FYI Exclusive
              </p>
            )}
            <h1 className="font-serif text-3xl italic leading-snug text-yacht-900">
              {displayModel}
              {/* ListingTitle from the feed ("New arrival"), when it is short enough to be a tag. */}
              {boat.content.tag && (
                <span className="ml-2.5 inline-block bg-yacht-900 px-2 py-1 align-middle font-sans text-[9px] font-semibold not-italic uppercase tracking-[0.2em] text-white">
                  {boat.content.tag}
                </span>
              )}
            </h1>
            <p className="mt-2 text-[13px] font-light tracking-wide text-yacht-900/55">
              {[boat.make ? boat.make.toUpperCase() : null, metric].filter(Boolean).join(' · ')}
              {boat.location ? ` · ${boat.location}` : ''}
            </p>
            <p className="mt-5 border-t border-yacht-900/10 pt-5 text-[14px] font-light text-yacht-900/60">
              Asking Price:{' '}
              {reduction && (
                <s className="mr-1.5 text-[15px] text-yacht-900/45">{formatMoney({ amount: reduction.previous, currency: reduction.currency })}</s>
              )}
              <span className="text-xl font-semibold tracking-wide text-yacht-900">{askingPrice(boat)}</span>
            </p>
            {/* Shown for 90 days after a recorded drop (daily price snapshot); never with a hidden price. */}
            {reduction && (
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-light text-yacht-900/60">
                <span className="bg-yacht-brand px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white">Price Reduced</span>
                <span>
                  was {formatMoney({ amount: reduction.previous, currency: reduction.currency })} · {fmtDate(reduction.date)}
                </span>
              </p>
            )}
            {/* PLS courtesy line ("…centrally listed by …"): its own line by the price so it is seen at first glance. */}
            {boat.listingType === 'cobrokerage' && boat.courtesy && (
              <p className="mt-3 text-[12px] font-light leading-5 text-yacht-900/60">{boat.courtesy}</p>
            )}

            <button
              type="button"
              onClick={() => { setEnquire(true); track('enquire_open', { context: boat.title }); }}
              className="mt-6 w-full bg-yacht-900 py-3.5 text-[12px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand"
            >
              ✉ Enquire
            </button>
            <button
              type="button"
              onClick={share}
              className="mt-2.5 flex w-full items-center justify-center gap-2 border border-yacht-900/15 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand"
            >
              <Share2 className="h-4 w-4" /> {shared ? 'Link copied' : 'Share'}
            </button>
            <ContactButtons context={boat.title} />
            {/* A gold "Create Yacht Profile" pairs with the wishlist here. */}
            <CreateYachtProfileCta id={String(boat.id)} name={boat.title} />
            {/* FYI Exclusives: the brokerage, never a named broker (client, 2026-10-27). */}
            {boat.listingType !== 'cobrokerage' && (
              <p className="mt-5 border-t border-yacht-900/10 pt-4 text-[13px] font-light text-yacht-900/60">
                Listed by <span className="font-semibold text-yacht-900">FYI Yachts</span>
              </p>
            )}
          </div>
        </aside>
      </main>

      <HomeFooter />
      <div className="h-16 lg:hidden" />
      <StickyMobileCta price={askingPrice(boat)} context={boat.title} />
      <BriannaWidget />

      {lightbox !== null && (
        <Lightbox images={gallery} title={boat.title} start={lightbox} onClose={() => setLightbox(null)} />
      )}
      {enquire && <EnquireModal boat={boat} onClose={() => setEnquire(false)} />}
    </div>
  );
}
