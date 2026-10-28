import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Anchor, Camera, ChevronLeft, ChevronRight, Loader2, Share2, X } from 'lucide-react';
import { DescriptionPreview, FinanceCalculator, InsuranceQuoteCta } from './BuyerTools';
import { AiOverview, ContactButtons, LocationMap, MoreLikeThis, RecentlySoldStrip, StickyMobileCta } from './ListingExtras';
import { CreateYachtProfileCta } from './CreateYachtProfileCta';
import { HomeNav, HomeFooter } from '../home/HomePage';
import BriannaWidget from '../chat/BriannaWidget';
import { PublicInquiryForm } from '../public/PublicPages';
import { useJsonLd } from '../../utils/useJsonLd';
import { Breadcrumbs } from '../public/Breadcrumbs';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';
import { track } from '../../utils/analytics';
import { optImg, srcSet } from '../../utils/img';
import { countryName } from '../../api/_lib/countryName';

/** Hero photo widths and layout size; api/listing.ts preloads the same pair. */
const HERO_WIDTHS = [640, 960, 1280, 1600];
const HERO_SIZES = '(min-width: 1280px) 1216px, calc(100vw - 48px)';

// Public, no-login yacht detail page (route: /listing/:id), styled after the
// listing template on fyiyachts.com (2026-07-22 client request): breadcrumb, big
// hero with a VIEW PHOTOS lightbox, thumbnail strip, serif-italic section
// headings over hairline label/value spec rows ("--" for unknowns, grouped
// Specifications / Performance & Machinery / Accommodations & Capacities),
// the standard disclaimer, and a sticky identity sidebar (model name, asking
// price, ENQUIRE modal, share, wishlist). FYI palette and Montserrat body
// stay; the serif accents mirror the template's headings.

interface Boat {
  /** 'cobrokerage' for BoatsGroup PLS listings; FYI's own boats leave it unset. */
  listingType?: string;
  id: string;
  title: string;
  boatName?: string;
  price?: number;
  year?: number;
  make?: string;
  model?: string;
  lengthFt?: number;
  category?: string;
  condition?: string;
  cabins?: number;
  berths?: number;
  heads?: number;
  beam?: string;
  draft?: string;
  designer?: string;
  hull?: string;
  engines?: string;
  totalPower?: string;
  engineHours?: string;
  fuelType?: string;
  driveType?: string;
  cruiseSpeed?: string;
  maxSpeed?: string;
  range?: string;
  fuelCap?: string;
  waterCap?: string;
  holdingCap?: string;
  location?: string;
  images: string[];
  description?: string;
  /** PLS courtesy line for co-brokerage boats ("…centrally listed by Yachts360."). */
  courtesy?: string;
}

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const usd = (n?: number) =>
  n != null && n > 0
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : 'Price on Request';

const stripHtml = (s: string) =>
  s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// "500|gallon" → "500 gal", "1,320 hp" passes through.
const cap = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  return v.replace('|gallon', ' gal').replace('|liter', ' L').replace('|horsepower', ' hp');
};

function normalize(it: any): Boat {
  const loc = it.BoatLocation || {};
  const images: string[] = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  const eng = Array.isArray(it.Engines) && it.Engines.length ? it.Engines[0] : null;
  const engines = eng
    ? `${it.Engines.length}× ${[eng.Make, eng.Model].filter(Boolean).join(' ')}`.trim()
    : undefined;
  const title = it.BoatName || [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim() || 'Yacht';
  return {
    id: String(it.DocumentID || ''),
    listingType: it.ListingType || undefined,
    title,
    boatName: it.BoatName || undefined,
    price: it.PriceHideInd ? undefined : num(it.NormPrice ?? it.Price),
    year: it.ModelYear ? Number(it.ModelYear) : undefined,
    make: it.MakeString || undefined,
    model: it.Model || undefined,
    lengthFt: num(it.LengthOverall ?? it.NominalLength),
    category: it.BoatCategoryCode || undefined,
    condition: it.SaleClassCode || undefined,
    cabins: it.CabinsCountNumeric ? Number(it.CabinsCountNumeric) : undefined,
    berths: it.BerthsCountNumeric ? Number(it.BerthsCountNumeric) : undefined,
    heads: it.HeadsCountNumeric ? Number(it.HeadsCountNumeric) : undefined,
    beam: it.BeamMeasure || undefined,
    draft: it.DraftMeasure || undefined,
    designer: it.DesignerName || undefined,
    hull: it.BoatHullMaterialCode || undefined,
    engines,
    totalPower: cap(it.TotalEnginePowerQuantity),
    engineHours: eng?.Hours ? `${eng.Hours}` : undefined,
    fuelType: eng?.Fuel || undefined,
    driveType: it.DriveTypeCode || eng?.Type || undefined,
    cruiseSpeed: it.CruisingSpeedMeasure || undefined,
    maxSpeed: it.MaximumSpeedMeasure || undefined,
    range: it.RangeMeasure || undefined,
    fuelCap: cap(it.FuelTankCapacityMeasure),
    waterCap: cap(it.WaterTankCapacityMeasure),
    holdingCap: cap(it.HoldingTankCapacityMeasure),
    location: [loc.BoatCityName && loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : null, loc.BoatStateCode || countryName(loc.BoatCountryID)]
      .filter(Boolean).join(', ') || undefined,
    images: images.slice(0, 30),
    description: typeof it.GeneralBoatDescription === 'string' ? stripHtml(it.GeneralBoatDescription) : undefined,
    courtesy: typeof it.PlsDisclaimer === 'string' ? stripHtml(it.PlsDisclaimer) || undefined : undefined,
  };
}

/* ------------------------------------------------ template pieces */

// Moved to GalleryPieces.tsx so the eager public bundle (CharterPages) can
// use them without pulling this whole page in; re-exported for compatibility.
import { SpecSection, Lightbox } from './GalleryPieces';
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

/* --------------------------------------------------------- page */

export default function PublicListingPage() {
  const { id = '' } = useParams();
  const [boat, setBoat] = useState<Boat | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [enquire, setEnquire] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setState('loading');
    fetch(`/api/yachts/proxy?documentid=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const item = Array.isArray(d?.results) ? d.results[0] : null;
        if (!item) { setState('error'); return; }
        const b = normalize(item);
        setBoat(b);
        setState('ready');
        document.title = `${b.title} — FYI Yachts`;
      })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [id]);

  // Co-brokerage boats: usable but not indexed (api/listing.ts sends the same
  // meta + X-Robots-Tag). Set for them, removed for every other boat — the SPA
  // can move between listings without a reload, so a stale tag must not stay.
  useEffect(() => {
    const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (boat?.listingType === 'cobrokerage') {
      const tag = existing ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }));
      tag.content = 'noindex, follow';
    } else if (boat && existing) {
      existing.remove();
    }
    return () => {
      document.head.querySelector('meta[name="robots"][content="noindex, follow"]')?.remove();
    };
  }, [boat]);

  // Product markup only for priced listings with a photo: without an offer
  // (or the reviews listings never have) Google flags the Product as an
  // invalid item in Search Console instead of showing a rich result.
  useJsonLd('listing', useMemo(() => boat && boat.price && boat.images[0] ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: boat.title,
    image: boat.images.slice(0, 5),
    ...(boat.description ? { description: boat.description.slice(0, 500) } : {}),
    brand: boat.make ? { '@type': 'Brand', name: boat.make } : undefined,
    offers: {
      '@type': 'Offer',
      price: boat.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: (boat.condition || '').toLowerCase() === 'new'
        ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: 'Florida Yachts International' },
    },
  } : null, [boat]));

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
  if (state === 'error' || !boat) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-yacht-900 px-6 text-center">
        <Anchor className="h-10 w-10 text-white/30" />
        <p className="text-lg font-light text-white/80">This listing is no longer available.</p>
        <a
          href="/yachts-for-sale"
          className="mt-2 bg-yacht-brand px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          Browse all yachts
        </a>
      </div>
    );
  }

  const gallery = boat.images;
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
                src={optImg(gallery[0], 1280)}
                srcSet={srcSet(gallery[0], HERO_WIDTHS)}
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
              <Camera className="h-4 w-4" /> View Photos ({gallery.length})
            </button>
          </div>
          {gallery.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-6">
              {gallery.slice(1, 7).map((src, idx) => (
                <button key={src + idx} type="button" onClick={() => setLightbox(idx + 1)} aria-label={`Photo ${idx + 2}`}
                  className="group relative overflow-hidden">
                  <img src={optImg(src, 320)} alt="" width={320} height={240} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {idx === 5 && gallery.length > 7 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-yacht-900/60 text-[13px] font-semibold tracking-widest text-white">
                      +{gallery.length - 7}
                    </span>
                  )}
                </button>
              ))}
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
              {boat.description ? (
                <div className="mt-6">
                  <DescriptionPreview text={boat.description} tone="light" />
                </div>
              ) : (
                <p className="mt-4 text-[14px] font-light text-yacht-900/50">
                  Full details available on request — enquire and a broker will send the complete specification.
                </p>
              )}
            </div>
          </section>

          <SpecSection
            heading="Specifications"
            rows={[
              ['Asking Price', usd(boat.price)],
              ['Length', metric],
              ['Beam', boat.beam],
              ['Draft', boat.draft],
              ['Year', boat.year ? String(boat.year) : undefined],
              ['Builder', boat.make],
              ['Designer', boat.designer],
              ['Hull Material', boat.hull],
              ['Condition', boat.condition],
            ]}
          />
          <SpecSection
            heading="Performance & Machinery"
            rows={[
              ['Engines', boat.engines],
              ['Total Power', boat.totalPower],
              ['Total Hours', boat.engineHours],
              ['Fuel Type', boat.fuelType],
              ['Drive Type', boat.driveType],
              ['Cruising Speed', boat.cruiseSpeed],
              ['Max Speed', boat.maxSpeed],
              ['Range', boat.range],
            ]}
          />
          <SpecSection
            heading="Accommodations & Capacities"
            rows={[
              ['Cabins', boat.cabins ? String(boat.cabins) : undefined],
              ['Berths', boat.berths ? String(boat.berths) : undefined],
              ['Heads', boat.heads ? String(boat.heads) : undefined],
              ['Fuel Capacity', boat.fuelCap],
              ['Water Capacity', boat.waterCap],
              ['Holding Capacity', boat.holdingCap],
            ]}
          />

          {/* City-level location map — never an exact berth */}
          <LocationMap location={boat.location} />

          {/* Buyer tools (FYI meeting 2026-07-17): financing + insurance */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <FinanceCalculator price={boat.price} tone="light" />
            <InsuranceQuoteCta
              tone="light"
              yacht={{
                title: boat.title,
                price: usd(boat.price),
                year: boat.year ? String(boat.year) : undefined,
                make: boat.make,
                model: boat.model,
                length: boat.lengthFt ? `${boat.lengthFt} ft` : undefined,
                location: boat.location,
              }}
            />
          </div>

          <MoreLikeThis id={boat.id} make={boat.make} lengthFt={boat.lengthFt} />
          <RecentlySoldStrip />

          {/* Standard disclaimer */}
          <p className="mt-12 border-t border-yacht-900/10 pt-6 text-[12px] font-light italic leading-6 text-yacht-900/45">
            This company offers the details of this vessel in good faith but cannot guarantee or warrant the accuracy of
            this information nor warrant the condition of the vessel. A buyer should instruct his agents, or his surveyors,
            to investigate such details as the buyer desires validated. This vessel is offered subject to prior sale,
            price change or withdrawal without notice.
          </p>
        </div>

        {/* Right: identity sidebar */}
        <aside id="inquire" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="border border-yacht-900/10 bg-white p-7">
            {boat.listingType !== 'cobrokerage' && (
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-yacht-brand">
                FYI Exclusive
              </p>
            )}
            <h1 className="font-serif text-3xl italic leading-snug text-yacht-900">{displayModel}</h1>
            <p className="mt-2 text-[13px] font-light tracking-wide text-yacht-900/55">
              {[boat.make ? boat.make.toUpperCase() : null, metric].filter(Boolean).join(' · ')}
              {boat.location ? ` · ${boat.location}` : ''}
            </p>
            <p className="mt-5 border-t border-yacht-900/10 pt-5 text-[14px] font-light text-yacht-900/60">
              Asking Price: <span className="text-xl font-semibold tracking-wide text-yacht-900">{usd(boat.price)}</span>
            </p>
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
      <StickyMobileCta price={usd(boat.price)} context={boat.title} />
      <BriannaWidget />

      {lightbox !== null && (
        <Lightbox images={gallery} title={boat.title} start={lightbox} onClose={() => setLightbox(null)} />
      )}
      {enquire && <EnquireModal boat={boat} onClose={() => setEnquire(false)} />}
    </div>
  );
}
