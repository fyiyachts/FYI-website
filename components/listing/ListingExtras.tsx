import { useEffect, useState } from 'react';
import { ArrowRight, MapPin, MessageCircle, Phone, Sparkles } from 'lucide-react';
import { track } from '../../utils/analytics';
import { useStickyCtaFlag } from '../public/useStickyCtaFlag';
import { boatNameLine, yachtTitle } from '../../utils/boatTitle';
import { optImg } from '../../utils/img';
import { formatMoney, type Money } from '../../api/_lib/price';
import { fetchJsonShared } from '../../utils/sharedFetch';

/* ------------------------------------------------- city-level map */

// Approximate coordinates for every city currently in the BoatsGroup feed.
// City-level ONLY, per the 2026-07-07 meeting: never exact addresses, and
// the MLS location data is too unreliable for anything finer anyway.
const CITY_COORDS: Record<string, [number, number]> = {
  'miami': [25.7617, -80.1918],
  'miami beach': [25.7907, -80.13],
  'key biscayne': [25.6907, -80.1653],
  'coral gables': [25.7215, -80.2684],
  'fort lauderdale': [26.1224, -80.1373],
  'ft lauderdale': [26.1224, -80.1373],
  'aventura': [25.9565, -80.1393],
  'north miami': [25.8901, -80.1867],
  'north miami beach': [25.9331, -80.1625],
  'key west': [24.5551, -81.78],
  'key largo': [25.0865, -80.4473],
  'coral way': [25.75, -80.25],
  'coconut grove': [25.7126, -80.2571],
  'dinner key': [25.7276, -80.2371],
  'west palm beach': [26.7153, -80.0534],
  'palm beach': [26.7056, -80.0364],
  'delray': [26.4615, -80.0728],
  'boca raton': [26.3683, -80.1289],
  'hollywood': [26.0112, -80.1495],
  'lauderhill': [26.1403, -80.2133],
  'sunny isle': [25.9429, -80.1226],
  'sunny isles': [25.9429, -80.1226],
  'hialeah': [25.8576, -80.2781],
  'palmetto bay': [25.6218, -80.3245],
  'homestead': [25.4687, -80.4776],
  'naples': [26.142, -81.7948],
  'port richey': [28.2717, -82.7195],
  'la guaira': [10.6013, -66.9331],
  'vargas': [10.6013, -66.9331],
  'lecherías': [10.1889, -64.6945],
  'lecherias': [10.1889, -64.6945],
  'puerto la cruz': [10.2136, -64.6328],
  'morrocoy': [10.88, -68.27],
  'higuerote': [10.484, -66.098],
  'falcon tucacas': [10.7969, -68.3197],
  'falcón': [11.18, -69.85],
  'miranda': [10.3, -66.4],
  'la paz': [24.1426, -110.3128],
  'cancun': [21.1619, -86.8515],
  'benito juárez': [21.1619, -86.8515],
  'cozumel': [20.423, -86.9223],
  'puerto vallarta': [20.6534, -105.2253],
  'hermosillo': [29.0729, -110.9559],
  'fajardo': [18.3258, -65.6524],
  'santo domingo': [18.4861, -69.9312],
  'belize city': [17.5046, -88.1962],
  'cartagena': [10.391, -75.4794],
  'arzachena': [41.0803, 9.3892],
  'porto cervo': [41.136, 9.535],
  'trieste': [45.6495, 13.7768],
  'athens': [37.9838, 23.7275],
  'budva': [42.2911, 18.8403],
  'midland': [44.7501, -79.888],
  'bracebridge': [45.0384, -79.307],
  'brunswick': [31.1499, -81.4915],
  'myrtle beach': [33.6891, -78.8867],
  'dana point': [33.4669, -117.6981],
  'new orleans': [29.9511, -90.0715],
  'galveston': [29.3013, -94.7977],
};

function cityCoords(location?: string): [number, number] | null {
  if (!location) return null;
  const city = location.split(',')[0].trim().toLowerCase().replace(/\s+fl$/, '');
  return CITY_COORDS[city] ?? null;
}

export function LocationMap({ location }: { location?: string }) {
  const coords = cityCoords(location);
  if (!coords) return null;
  const [lat, lon] = coords;
  const bbox = `${lon - 0.22},${lat - 0.14},${lon + 0.22},${lat + 0.14}`;
  return (
    <section className="mt-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Location</p>
      <div className="mt-5 overflow-hidden border border-yacht-900/10 bg-white">
        <iframe
          title={`Map of ${location}`}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`}
          className="h-72 w-full border-0"
          loading="lazy"
        />
        <p className="flex items-center gap-1.5 px-4 py-3 text-[12px] font-light text-yacht-900/55">
          <MapPin className="h-3.5 w-3.5 text-yacht-teal" />
          Approximate area — {location}. Exact berth shared privately with qualified buyers.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ AI overview */

// Server-generated 3-4 sentence broker-voice overview (meeting item:
// "AI-written overview that reads human"). Hidden entirely when the
// endpoint isn't configured or fails — the description preview remains.
export function AiOverview({ id }: { id: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    let alive = true;
    setText('');
    fetch(`/api/listing/overview?id=${encodeURIComponent(id)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (alive && typeof d?.overview === 'string') setText(d.overview); })
      .catch(() => {});
    return () => { alive = false; };
  }, [id]);
  if (!text) return null;
  return (
    <section className="mt-10 border-l-2 border-yacht-brand bg-white p-6">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">
        <Sparkles className="h-3.5 w-3.5" /> Broker&rsquo;s Take
      </p>
      <p className="mt-3 text-[15px] font-light leading-8 text-yacht-900/80">{text}</p>
    </section>
  );
}

/* -------------------------------- sold strip + more like this (lazy) */

// Both strips come from ONE small request to /api/yachts/showcase, made only
// when either strip scrolls near the viewport. They used to pull whole
// inventories through the proxy on every listing view (the active book, and
// the sold book three times over), which is what tripped its per-IP limit.

interface ShowcaseCard {
  id: string; name: string; year?: number; make?: string; model?: string;
  lengthFt?: number; priceUsd?: number; listPrice?: Money; image?: string;
}
interface Showcase { similar?: ShowcaseCard[]; sold?: ShowcaseCard[] }

interface ListingRef { id: string; make?: string; lengthFt?: number }

const showcaseUrl = ({ id, make, lengthFt }: ListingRef): string => {
  const qs = new URLSearchParams({ sections: 'similar,sold', id });
  if (make) qs.set('make', make);
  if (lengthFt) qs.set('len', String(Math.round(lengthFt)));
  return `/api/yachts/showcase?${qs.toString()}`;
};

/** Fetch the listing's showcase once its strip is within ~600px of the viewport. */
function useListingShowcase(ref: ListingRef) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<Showcase | null>(null);
  const url = showcaseUrl(ref);
  useEffect(() => {
    if (!node) return;
    let alive = true;
    const load = () => {
      fetchJsonShared<Showcase>(url).then((d) => { if (alive) setData(d); }).catch(() => {});
    };
    if (typeof IntersectionObserver === 'undefined') { load(); return () => { alive = false; }; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '600px 0px' });
    io.observe(node);
    return () => { alive = false; io.disconnect(); };
  }, [node, url]);
  return { setNode, data };
}

const cardTitle = (c: ShowcaseCard) => yachtTitle(c.year, c.make, c.model) || c.name || 'Yacht';
const cardName = (c: ShowcaseCard) => boatNameLine(c.name, yachtTitle(c.year, c.make, c.model));
// Own currency ("€845,000"); USD from priceUsd when the server sent no listPrice.
const cardPrice = (c: ShowcaseCard) =>
  formatMoney(c.listPrice ?? (c.priceUsd ? { amount: c.priceUsd, currency: 'USD' } : undefined));

export function RecentlySoldStrip(props: ListingRef) {
  const { setNode, data } = useListingShowcase(props);
  const sold = (data?.sold ?? []).filter((c) => c.image);
  if (!sold.length) return <div ref={setNode} aria-hidden="true" />;
  return (
    <section ref={setNode} className="mt-12">
      <div className="flex items-end justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Sold by FYI</p>
        <a href="/sold-yachts" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/50 transition-colors hover:text-yacht-brand">
          All sold yachts <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {sold.map(c => (
          <div key={c.id} className="relative overflow-hidden bg-white">
            <img src={optImg(c.image, 480)} alt={`${cardTitle(c)} — sold by FYI Yachts`} width={480} height={300} loading="lazy" className="aspect-[16/10] w-full object-cover saturate-[0.7]" />
            <span className="absolute left-3 top-3 bg-yacht-brand px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white">Sold</span>
            <div className="px-3 py-2.5">
              <p className="truncate text-[12px] font-medium tracking-wide text-yacht-900">{cardTitle(c)}</p>
              {cardName(c) && <p className="truncate text-[11px] font-light italic text-yacht-900/55">{cardName(c)}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Similar active vessels — cheapest cross-sell on the site. Matches on make
// and length band, excludes the current listing (scored server-side).
export function MoreLikeThis(props: ListingRef) {
  const { setNode, data } = useListingShowcase(props);
  const picks = (data?.similar ?? []).filter((c) => c.image);
  if (picks.length < 2) return <div ref={setNode} aria-hidden="true" />;
  return (
    <section ref={setNode} className="mt-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">More Like This</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {picks.map(c => (
          <a key={c.id} href={`/listing/${c.id}`} className="group block overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-md">
            <img src={optImg(c.image, 640)} alt={cardTitle(c)} width={640} height={480} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="p-4">
              <h3 className="truncate text-[14px] font-medium tracking-wide text-yacht-900">{cardTitle(c)}</h3>
              {cardName(c) && <p className="truncate text-[12px] font-light italic text-yacht-900/55">{cardName(c)}</p>}
              <p className="mt-1 text-[13px] font-semibold text-yacht-900/80">{cardPrice(c)}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------- contact CTAs */

const PHONE = '+13058546020';
const PHONE_DISPLAY = '305-854-6020';
// WhatsApp is a separate line from the office phone — see the contact pages.
const WHATSAPP = '17863538073';

export function ContactButtons({ context }: { context: string }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5">
      <a
        href={`tel:${PHONE}`}
        onClick={() => track('phone_click', { context })}
        className="flex items-center justify-center gap-2 border border-yacht-900/15 py-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand"
      >
        <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
      </a>
      <a
        href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi FYI Yachts — I'm interested in ${context}.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('whatsapp_click', { context })}
        className="flex items-center justify-center gap-2 bg-[#25D366]/10 py-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-[#128C4A] transition-colors hover:bg-[#25D366]/20"
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
    </div>
  );
}

// Mobile-only bottom bar: price always visible, one tap to inquire or call
// (mobile-first, per the meeting's sticky-sidebar note).
export function StickyMobileCta({ price, context }: { price: string; context: string }) {
  // Lifts the Brianna launcher clear of this bar (see useStickyCtaFlag).
  useStickyCtaFlag();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-white/10 bg-yacht-900/95 px-4 py-3 backdrop-blur-md lg:hidden">
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/45">Asking</p>
        <p className="truncate text-base font-light tracking-wide text-white">{price}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <a
          href={`tel:${PHONE}`}
          onClick={() => track('phone_click', { context, placement: 'sticky' })}
          aria-label={`Call ${PHONE_DISPLAY}`}
          className="flex h-11 w-11 items-center justify-center border border-white/20 text-white transition-colors hover:border-yacht-brand hover:text-yacht-brand"
        >
          <Phone className="h-4 w-4" />
        </a>
        <a
          href="#inquire"
          onClick={() => track('inquire_scroll', { context })}
          className="bg-yacht-brand px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          Inquire
        </a>
      </div>
    </div>
  );
}
