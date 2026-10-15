import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Camera, Check, Mail, MapPin, Phone, Share2, Users } from 'lucide-react';
import { PublicShell, ImagePageHero, PublicInquiryForm, SectionHead } from './PublicPages';
import { HomeNav, HomeFooter, Destinations } from '../home/HomePage';
import BriannaWidget from '../chat/BriannaWidget';
import { Lightbox, SpecSection } from '../listing/GalleryPieces';
import { StickyMobileCta } from '../listing/ListingExtras';
import { CreateYachtProfileCta } from '../listing/CreateYachtProfileCta';
import { FaqSection, CHARTER_FAQS } from './Faq';
import NotFoundPage from './NotFoundPage';
import { StickyCta } from './StickyCta';
import { Breadcrumbs } from './Breadcrumbs';
import { usePageMeta } from '../../utils/usePageMeta';
import { optImg, srcSet } from '../../utils/img';
import {
  CHARTER_FLEET, CHARTER_ON_REQUEST, TERM_CHARTER, CHARTER_INCLUDES, CHARTER_POLICIES,
  CAPTAIN_RATES, MATE_STEW_RATES, BOUNDARY_MAP, APA_NOTE, CHARTER_FROM_PRICE,
  CHARTER_PHONE_DISPLAY, CHARTER_PHONE_TEL, CHARTER_EMAIL,
  CHARTER_MARINA_NAME, CHARTER_MARINA_ADDRESS,
  findCharterVessel, isTermVessel,
  type CharterVessel, type TermCharterVessel,
} from './charterFleet';

/**
 * Charter tier — the landing page at /charter plus a real page per vessel at
 * /charter/:slug (the per-vessel pages FYI was promised). All content is
 * transcribed from the live fyiyachts.com charter pages; see charterFleet.ts
 * for which of the two live pages each figure came from.
 */

/* ------------------------------------------------------------- shared */

function RateTable({ rates, extraHour, dark = false }: {
  rates: { hours: string; price: string; note?: string }[];
  extraHour?: string;
  dark?: boolean;
}) {
  if (!rates.length) {
    return <p className={`text-[13px] font-medium ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`}>Rates on request</p>;
  }
  return (
    <>
      <dl className={`grid grid-cols-2 gap-x-6 gap-y-2 ${dark ? '' : ''}`}>
        {rates.map(r => (
          <div key={r.hours} className="flex items-baseline justify-between gap-2">
            <dt className={`text-[12px] font-light ${dark ? 'text-white/55' : 'text-yacht-900/55'}`}>{r.hours}</dt>
            <dd className={`text-[14px] font-medium ${dark ? 'text-white' : 'text-yacht-900'}`}>{r.price}</dd>
          </div>
        ))}
      </dl>
      {rates.some(r => r.note) && (
        <p className={`mt-2 text-[11px] font-light ${dark ? 'text-white/45' : 'text-yacht-900/45'}`}>
          {rates.find(r => r.note)?.note}
        </p>
      )}
      {extraHour && (
        <p className={`mt-2 text-[11px] font-light ${dark ? 'text-white/45' : 'text-yacht-900/45'}`}>
          Each additional hour {extraHour}
        </p>
      )}
    </>
  );
}

function VesselCard({ v }: { v: CharterVessel }) {
  return (
    <article className="group flex flex-col overflow-hidden bg-yacht-cream shadow-sm transition-shadow duration-500 hover:shadow-xl">
      <Link to={`/charter/${v.slug}`} className="relative block aspect-[4/3] overflow-hidden">
        <img
          src={optImg(v.image, 900)}
          srcSet={srcSet(v.image, [480, 900, 1200])}
          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
          alt={v.alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <span className="absolute left-4 top-4 bg-yacht-900/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-yacht-cream backdrop-blur-sm">
          Up to {v.guests} guests
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-light tracking-wide text-yacht-900">
          <Link to={`/charter/${v.slug}`} className="transition-colors hover:text-yacht-brand">{v.name}</Link>
        </h3>
        <p className="mt-2 flex-1 text-[14px] font-light leading-7 text-yacht-900/70">{v.blurb}</p>

        {v.included && v.included.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {v.included.map(i => (
              <li key={i} className="flex items-start gap-2 text-[12px] font-light leading-5 text-yacht-900/60">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yacht-teal" aria-hidden="true" />{i}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 border-t border-yacht-900/10 pt-5">
          {v.weekdayRates?.length ? (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Fri – Sun</p>
              <RateTable rates={v.rates} extraHour={v.extraHour} />
              <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-yacht-900/45">Mon – Thu</p>
              <RateTable rates={v.weekdayRates} extraHour={v.weekdayExtraHour} />
            </>
          ) : (
            <RateTable rates={v.rates} extraHour={v.extraHour} />
          )}
        </div>

        {v.availability && (
          <p className="mt-3 text-[11px] font-light uppercase tracking-[0.15em] text-yacht-brand">{v.availability}</p>
        )}

        <Link
          to={`/charter/${v.slug}`}
          className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-brand transition-colors hover:text-yacht-900"
        >
          View this yacht <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function CrewRatesBlock({ dark = false }: { dark?: boolean }) {
  const head = dark ? 'text-white' : 'text-yacht-900';
  const soft = dark ? 'text-white/60' : 'text-yacht-900/60';
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.25em] ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`}>Captain</p>
        <dl className="mt-4 space-y-2">
          {CAPTAIN_RATES.map(r => (
            <div key={r.hours} className="flex items-baseline justify-between gap-4 border-b border-current/10 pb-2">
              <dt className={`text-[13px] font-light ${soft}`}>{r.hours}</dt>
              <dd className={`text-[14px] font-medium ${head}`}>{r.price}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.25em] ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`}>Mate / Stew</p>
        <dl className="mt-4 space-y-2">
          {MATE_STEW_RATES.map(r => (
            <div key={r.hours} className="flex items-baseline justify-between gap-4 border-b border-current/10 pb-2">
              <dt className={`text-[13px] font-light ${soft}`}>{r.hours}</dt>
              <dd className={`text-[14px] font-medium ${head}`}>{r.price}</dd>
            </div>
          ))}
        </dl>
        <p className={`mt-3 text-[11px] font-light ${soft}`}>Additional mate and stew rates on request.</p>
      </div>
    </div>
  );
}

function CharterContact({ dark = false, departsFrom }: { dark?: boolean; departsFrom?: string }) {
  const head = dark ? 'text-white' : 'text-yacht-900';
  const soft = dark ? 'text-white/65' : 'text-yacht-900/65';
  return (
    <div className="space-y-6">
      <a href={CHARTER_PHONE_TEL} className="group flex items-center gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center border ${dark ? 'border-white/15' : 'border-yacht-900/15'} transition-colors group-hover:border-yacht-brand`}>
          <Phone className="h-4 w-4 text-yacht-teal" />
        </span>
        <span>
          <span className={`block text-[10px] font-semibold uppercase tracking-[0.25em] ${dark ? 'text-white/45' : 'text-yacht-900/45'}`}>Charter desk</span>
          <span className={`mt-0.5 block whitespace-nowrap text-lg font-light tracking-wider ${head}`}>{CHARTER_PHONE_DISPLAY}</span>
        </span>
      </a>
      <a href={`mailto:${CHARTER_EMAIL}`} className="group flex items-center gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center border ${dark ? 'border-white/15' : 'border-yacht-900/15'} transition-colors group-hover:border-yacht-brand`}>
          <Mail className="h-4 w-4 text-yacht-teal" />
        </span>
        <span>
          <span className={`block text-[10px] font-semibold uppercase tracking-[0.25em] ${dark ? 'text-white/45' : 'text-yacht-900/45'}`}>Email</span>
          <span className={`mt-0.5 block break-all text-[15px] font-light tracking-wide ${head}`}>{CHARTER_EMAIL}</span>
        </span>
      </a>
      <div className="flex items-center gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center border ${dark ? 'border-white/15' : 'border-yacht-900/15'}`}>
          <MapPin className="h-4 w-4 text-yacht-teal" />
        </span>
        <span>
          <span className={`block text-[10px] font-semibold uppercase tracking-[0.25em] ${dark ? 'text-white/45' : 'text-yacht-900/45'}`}>Departs from</span>
          <span className={`mt-0.5 block text-[15px] font-light leading-6 ${soft}`}>
            {departsFrom ?? <>{CHARTER_MARINA_NAME}<br />{CHARTER_MARINA_ADDRESS}</>}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ landing page */

export function CharterPage() {
  usePageMeta(
    'Miami Yacht Charters & Rentals | Day & Term — FYI Yachts',
    `Charter or rent a crewed luxury yacht in Miami with FYI Yachts — XTREME (80′ Azimut S8) and the 105′ Azimut, from ${CHARTER_FROM_PRICE}. Fuel, crew, and up to 13 guests included.`,
    '/charter/',
    [{ hreflang: 'en', path: '/charter/' }, { hreflang: 'es', path: '/es/charter/' }, { hreflang: 'x-default', path: '/charter/' }],
  );

  const steps: [string, string][] = [
    ['Tell us the day', 'Your date, your group size, and the day you’re imagining — a sandbar afternoon, a sunset cruise, a full day to the Keys.'],
    ['We match the yacht', 'A charter specialist puts the right boat and the right crew against your plan, and confirms availability the same day where we can.'],
    ['Step aboard', 'Fuel, captain and crew, water, ice, coolers, and towels are already handled. You bring the guests and the playlist.'],
  ];

  return (
    <PublicShell>
      <ImagePageHero
        eyebrow="Charter"
        h1="Miami Yacht Charters"
        intro="Crewed day charters out of Coconut Grove — Biscayne Bay, the sandbar, and the Miami coastline, with captain and crew aboard."
        // Aerials over the Exumas and a superyacht at anchor. The vessels in
        // the footage are not the published fleet, and that is deliberate
        // (client, 2026-08-26): motion sells the day out better than any one
        // still of one boat can. The Miami stills stay as the poster and the
        // no-autoplay fallback, so the page still opens on Biscayne Bay
        // wherever the video can't play.
        //
        // The 105′ Azimut shot is the page's social/link image instead — set
        // as `image` on the /charter route in seoData.ts, so the boat we
        // actually charter is what a shared link shows.
        video="/hero/charter-hero.mp4"
        src="/charter/hero-miami-1600.webp"
        sources="/charter/hero-miami-1100.webp 1100w, /charter/hero-miami-1600.webp 1600w, /charter/hero-miami-2400.webp 2400w"
        srcMobile="/charter/hero-miami-mobile.webp"
        alt="A Pershing motor yacht running across Biscayne Bay with the Miami skyline and Rickenbacker Causeway behind it"
        stats={[`From ${CHARTER_FROM_PRICE}`, 'Up to 13 guests', '105 feet', 'Bayshore Landing, Coconut Grove']}
      >
        <a href="#fleet" className="inline-flex items-center gap-2 rounded-full bg-yacht-brand px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-yacht-brand-light">
          Explore the fleet <ArrowRight className="h-4 w-4" />
        </a>
        <a href="#charter-inquiry" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/10">
          Check availability
        </a>
      </ImagePageHero>

      {/* The fleet — day boats and on-request vessels in one grid, largest
          first. These were two sections ("the fleet" + "also chartering") and
          the client asked for one feed (2026-07-29); the cards already say
          "Rates on request" where no rates are published. Sits directly under
          the hero, ahead of the copy sections (client ask, 2026-08-20). */}
      <section id="fleet" className="scroll-mt-24 bg-white px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHead eyebrow="The fleet" title="Available charter vessels" />
          <p className="mt-4 max-w-2xl text-[15px] font-light leading-7 text-yacht-900/70">
            Every vessel below charters with a captain and crew out of Miami. Published rates include
            tax and fuel, with crew quoted separately and paid directly to the captain and crew.
            The charter desk confirms availability the same day wherever it can.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...CHARTER_FLEET, ...CHARTER_ON_REQUEST]
              // Largest first (client, 2026-10-01).
              .sort((a, b) => b.lengthFt - a.lengthFt)
              .map(v => <VesselCard key={v.slug} v={v} />)}
          </div>
        </div>
      </section>

      {/* Intro + charter-desk contact */}
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          <div>
            <SectionHead eyebrow="The programme" title="Whether you’re cruising in splendour or fishing in style" />
            <p className="mt-5 text-[15px] font-light leading-8 text-yacht-900/75">
              Our international luxury yacht consultants have 300+ years of combined experience in the
              yachting industry and are experts at building the right programme around what you actually
              want from a day on the water. Charters run out of Bayshore Landing in Coconut Grove, cruise
              Biscayne Bay and Miami, and stop at the sandbar — and a term charter can take you all the
              way through the Bahamas.
            </p>
          </div>
          <div className="border-l-0 lg:border-l lg:border-yacht-900/10 lg:pl-12">
            <CharterContact />
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="bg-yacht-900 px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHead eyebrow="Every charter" title="What’s included" dark />
          <div className="mt-10 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHARTER_INCLUDES.map(i => (
              <div key={i} className="flex items-start gap-3 border-b border-white/10 pb-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-yacht-teal" aria-hidden="true" />
                <span className="text-[15px] font-light text-white/80">{i}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-[14px] font-light leading-7 text-white/55">
            If you’d like to stop and eat somewhere, that’s welcome — just keep in mind additional
            dockage charges apply at the restaurant’s marina.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <SectionHead eyebrow="How it works" title="Your crew, your course, your pace" center />
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="border-t-2 border-yacht-brand pt-5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/40">Step {i + 1}</span>
              <h3 className="mt-2 text-lg font-light tracking-wide text-yacht-900">{title}</h3>
              <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Term charter */}
      {TERM_CHARTER.map(v => (
        <section key={v.slug} className="bg-yacht-900 px-6 py-16 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Link to={`/charter/${v.slug}`} className="group block overflow-hidden">
              <img
                src={optImg(v.image, 1200)}
                srcSet={srcSet(v.image, [640, 1200, 1600])}
                sizes="(min-width:1024px) 50vw, 100vw"
                alt={v.alt}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </Link>
            <div>
              <SectionHead eyebrow="Term charter" title={`A week aboard the ${v.name}`} dark />
              <p className="mt-5 text-[15px] font-light leading-8 text-white/70">{v.blurb}</p>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {v.terms.map(t => (
                  <div key={t.region} className="border border-white/10 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-teal">{t.region}</p>
                    <p className="mt-3 text-[14px] font-light leading-6 text-white/80">
                      <span className="block text-[10px] uppercase tracking-[0.2em] text-white/40">Weekly</span>
                      {t.weekly}
                    </p>
                    <p className="mt-3 text-[14px] font-light leading-6 text-white/80">
                      <span className="block text-[10px] uppercase tracking-[0.2em] text-white/40">Daily</span>
                      {t.daily}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[13px] font-light leading-6 text-white/50">{APA_NOTE}</p>
              <Link to={`/charter/${v.slug}`} className="mt-8 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-teal hover:text-white">
                View the {v.name} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      ))}

      {/* Crew rates + policies */}
      <section className="bg-yacht-cream px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHead eyebrow="Crew & fees" title="What’s quoted separately" />
          <div className="mt-10 grid gap-14 lg:grid-cols-2 lg:gap-20">
            <CrewRatesBlock />
            <dl className="space-y-5">
              {CHARTER_POLICIES.map(p => (
                <div key={p.label} className="border-b border-yacht-900/10 pb-4">
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-900">{p.label}</dt>
                  <dd className="mt-1.5 text-[14px] font-light leading-6 text-yacht-900/65">{p.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Boundaries map */}
      <section className="bg-yacht-900 px-6 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHead eyebrow="Where we cruise" title="Charter boundaries" dark />
            <p className="mt-5 text-[15px] font-light leading-8 text-white/75">
              Standard charters run within the Miami boundary shown here — Haulover and Monument Island
              to the north, down through Nixon Sandbar and Key Biscayne to Elliott Key, Billy’s Point,
              and Fowey Rocks. Heading beyond it is absolutely possible; additional fuel charges simply
              accrue for the distance.
            </p>
            <a href="#charter-inquiry" className="mt-8 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-teal hover:text-white">
              Ask about a longer run <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <img
            src={optImg(BOUNDARY_MAP, 1000)}
            alt="Map of FYI Yachts' Miami charter boundaries, from Haulover south to Fowey Rocks"
            loading="lazy"
            className="w-full border border-white/15 bg-white"
          />
        </div>
      </section>

      {/* Cruising grounds — moved here from the homepage, since where you can
          go is a charter question. */}
      <Destinations />

      {/* Inquiry */}
      <section id="charter-inquiry" className="scroll-mt-24 bg-yacht-900 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">Plan your charter</h2>
            <p className="mt-4 text-[15px] font-light leading-7 text-white/70">
              Tell us your date, group size, and the day you&rsquo;re imagining — a charter specialist
              responds within one business day.
            </p>
            <div className="mt-8"><CharterContact dark /></div>
          </div>
          <PublicInquiryForm context="Yacht charter" dark />
        </div>
      </section>

      <FaqSection heading="Miami yacht charter FAQs" faqs={CHARTER_FAQS} />
      <StickyCta context="Charter landing" inquireHref="#inquire" label="Inquire" />
    </PublicShell>
  );
}


/* --------------------------------------------------- per-vessel page */

/**
 * Charter vessel detail page, built to match the listing template used for the
 * sale listings at /listing/:id (client request 2026-07-27) — breadcrumb,
 * big hero with a VIEW PHOTOS lightbox and thumbnail strip, serif-italic
 * section headings over hairline spec rows, and a sticky identity sidebar.
 * The spec rows carry charter facts (rates, crew, what's included) instead
 * of a sale spec sheet.
 */
export function CharterVesselPage() {
  const { slug = '' } = useParams();
  const vessel = findCharterVessel(slug);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [shared, setShared] = useState(false);

  // Unknown slug → the 404 page, not a redirect to /charter. Only the real
  // vessel slugs are prerendered, so the server already answered this request
  // with a genuine HTTP 404 (api/not-found.ts); rendering the 404 keeps what
  // the visitor sees consistent with the status the crawler got.
  if (!vessel) return <NotFoundPage />;

  const term = isTermVessel(vessel) ? vessel : null;
  const dayRates = term ? [] : (vessel as CharterVessel).rates;
  const extraHour = term ? undefined : (vessel as CharterVessel).extraHour;
  const day = term ? null : (vessel as CharterVessel);
  const marina = day?.departsFrom ?? CHARTER_MARINA_NAME;
  const departs = day?.departsFrom ?? `${CHARTER_MARINA_NAME}, Coconut Grove`;

  const others = [...CHARTER_FLEET, ...TERM_CHARTER, ...CHARTER_ON_REQUEST]
    .filter(v => v.slug !== vessel.slug)
    .slice(0, 4);

  const gallery = vessel.gallery?.length ? vessel.gallery : [vessel.image];
  const metric = `${vessel.lengthFt}'/${(vessel.lengthFt * 0.3048).toFixed(1)}m`;
  const headlineRate = term
    ? term.terms[0].daily
    : dayRates.length ? `${dayRates[0].price} / ${dayRates[0].hours}` : 'On request';

  const rateSummary = term
    ? term.terms.map(t => `${t.region}: ${t.daily}`).join(' · ')
    : dayRates.length ? `From ${dayRates[0].price} for ${dayRates[0].hours}` : 'Rates on request';

  usePageMeta(
    `${vessel.name} Charter in Miami | FYI Yachts`,
    `Charter the ${vessel.name} (${vessel.builder}) in Miami with FYI Yachts — up to ${vessel.guests} guests, captain and crew, fuel included. ${rateSummary}.`,
    `/charter/${vessel.slug}/`,
  );

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) await navigator.share({ title: vessel.name, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch { /* dismissed */ }
  };

  return (
    <div className="min-h-dvh bg-yacht-cream font-sans text-yacht-900 antialiased">
      <HomeNav />

      {/* Breadcrumb — the shared semantic <nav><ol>, matching the
          BreadcrumbList JSON-LD this route emits (scripts/seoData.ts). */}
      <div className="mx-auto max-w-7xl px-6 pb-4 pt-28 lg:px-8 lg:pt-32">
        <Breadcrumbs
          items={[{ label: 'Home', href: '/' }, { label: 'Charter', href: '/charter' }, { label: vessel.name }]}
        />
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-light text-yacht-900/60">
          <Link to="/charter" className="transition-colors hover:text-yacht-brand">&larr; Back to Charter Fleet</Link>
        </p>
      </div>

      {/* Hero photo + VIEW PHOTOS lightbox trigger */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden bg-yacht-900/5">
          <button type="button" onClick={() => setLightbox(0)} aria-label={`View ${gallery.length} photos`} className="block w-full cursor-zoom-in">
            <img
              src={optImg(gallery[0], 1600)}
              srcSet={srcSet(gallery[0], [800, 1200, 1600, 2000])}
              sizes="(min-width:1024px) 80vw, 100vw"
              alt={vessel.alt}
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
              <button key={src + idx} type="button" onClick={() => setLightbox(idx + 1)} aria-label={`Photo ${idx + 2}`} className="group relative overflow-hidden">
                <img src={optImg(src, 400)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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

      <main className="mx-auto grid max-w-7xl gap-12 px-6 py-12 lg:grid-cols-3 lg:px-8">
        {/* Left: listing-style sections */}
        <div className="lg:col-span-2">
          <section>
            <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">About this yacht</h2>
            <p className="mt-5 text-[15px] font-light leading-8 text-yacht-900/75">{vessel.blurb}</p>
            <p className="mt-4 text-[15px] font-light leading-8 text-yacht-900/75">
              The {vessel.name} charters out of {marina}{day?.departsFrom ? '' : ' in Coconut Grove'} with a captain and
              crew for up to {vessel.guests} guests. Fuel, water, ice, coolers, and towels are included, and
              the day is yours to shape — cruising Miami and Biscayne Bay, anchoring at the sandbar, or
              running further afield.
            </p>
          </section>

          <SpecSection
            heading="Vessel"
            rows={[
              ['Builder & Model', vessel.builder],
              ['Length', metric],
              ['Guest Capacity', `Up to ${vessel.guests}`],
              ['Departs From', departs],
              ['Charter Type', term ? 'Term & day charter' : 'Day charter'],
              ['Availability', vessel.availability ?? 'Booking now'],
            ]}
          />

          {term ? (
            <>
              {term.terms.map(t => (
                <SpecSection
                  key={t.region}
                  heading={`${t.region} — term rates`}
                  rows={[['Weekly', t.weekly], ['Daily (8 hours)', t.daily]]}
                />
              ))}
              <p className="mt-4 text-[13px] font-light leading-6 text-yacht-900/55">{APA_NOTE}</p>
            </>
          ) : (
            <>
              <SpecSection
                heading={day?.weekdayRates?.length ? 'Charter rates — Friday to Sunday' : 'Charter rates'}
                rows={[
                  ...dayRates.map(r => [r.hours, `${r.price}${r.note ? ` ${r.note}` : ''}`] as [string, string]),
                  ...(extraHour ? ([['Each additional hour', extraHour]] as [string, string][]) : []),
                ]}
              />
              {day?.weekdayRates?.length ? (
                <SpecSection
                  heading="Charter rates — Monday to Thursday"
                  rows={[
                    ...day.weekdayRates.map(r => [r.hours, r.price] as [string, string]),
                    ...(day.weekdayExtraHour ? ([['Each additional hour', day.weekdayExtraHour]] as [string, string][]) : []),
                  ]}
                />
              ) : null}
            </>
          )}

          {day?.allInclusive ? (
            <p className="mt-6 text-[14px] font-light leading-7 text-yacht-900/70">
              All-inclusive pricing — captain, crew, and gratuity are included in the rates above.
            </p>
          ) : (
            <SpecSection
              heading="Crew (quoted separately)"
              rows={[
                ...CAPTAIN_RATES.map(r => [`Captain — ${r.hours}`, r.price] as [string, string]),
                ...MATE_STEW_RATES.map(r => [`Mate / stew — ${r.hours}`, r.price] as [string, string]),
              ]}
            />
          )}

          {day?.rules?.length ? (
            <SpecSection
              heading="Capacity & rules"
              rows={day.rules}
            />
          ) : null}

          {/* What's included + vessel-specific toys */}
          <section className="mt-12">
            <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">What&rsquo;s included</h2>
            <ul className="mt-5 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
              {CHARTER_INCLUDES.map(i => (
                <li key={i} className="flex items-start gap-2.5 text-[14px] font-light leading-6 text-yacht-900/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-yacht-teal" aria-hidden="true" />{i}
                </li>
              ))}
            </ul>
            {vessel.included && vessel.included.length > 0 && (
              <>
                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">Aboard this yacht</p>
                <ul className="mt-3 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
                  {vessel.included.map(i => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px] font-light leading-6 text-yacht-900/75">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-yacht-brand" aria-hidden="true" />{i}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Policies */}
          <section className="mt-12">
            <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">Good to know</h2>
            <dl className="mt-5 space-y-4">
              {CHARTER_POLICIES.filter(p => !(day?.allInclusive && (p.label === 'Gratuity' || p.label === 'Taxes & crew'))).map(p => (
                <div key={p.label} className="border-b border-yacht-900/10 pb-3.5">
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-900">{p.label}</dt>
                  <dd className="mt-1.5 text-[14px] font-light leading-6 text-yacht-900/65">{p.detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Boundaries */}
          <section className="mt-12">
            <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">Where we cruise</h2>
            <p className="mt-4 text-[14px] font-light leading-7 text-yacht-900/70">
              Standard charters run within the Miami boundary below — Haulover and Monument Island north,
              down through Nixon Sandbar and Key Biscayne to Elliott Key and Fowey Rocks. Going beyond it is
              welcome; additional fuel charges simply accrue for the distance.
            </p>
            <img
              src={optImg(BOUNDARY_MAP, 1000)}
              alt="Map of FYI Yachts' Miami charter boundaries"
              loading="lazy"
              className="mt-5 w-full border border-yacht-900/10 bg-white"
            />
          </section>

          {/* Other vessels. Hidden when this is the only vessel we publish —
              otherwise the heading stands over an empty grid. */}
          {others.length > 0 && (
          <section className="mt-12">
            <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">More of the fleet</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {others.map(v => (
                  <Link key={v.slug} to={`/charter/${v.slug}`} className="group block">
                    <div className="aspect-[4/3] overflow-hidden bg-yacht-900/5">
                      <img src={optImg(v.image, 640)} alt={v.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <h3 className="mt-3 text-[15px] font-light tracking-wide text-yacht-900 group-hover:text-yacht-brand">{v.name}</h3>
                    <p className="mt-1 text-[12px] font-light text-yacht-900/55">Up to {v.guests} guests</p>
                  </Link>
                ))}
            </div>
          </section>
          )}

          <p className="mt-12 border-t border-yacht-900/10 pt-6 text-[12px] font-light italic leading-6 text-yacht-900/45">
            Charter rates and availability are offered in good faith and may vary with the season, the
            itinerary, and any special requirements.{day?.allInclusive
              ? ' Rates are all-inclusive, gratuity included.'
              : ' Rates include tax; crew rate and gratuity are paid directly to the captain and crew.'} Bookings are subject to confirmation.
          </p>
        </div>

        {/* Right: sticky identity sidebar, mirroring the sale listing */}
        <aside id="charter-inquiry" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="border border-yacht-900/10 bg-white p-7">
            <h1 className="font-serif text-3xl italic leading-snug text-yacht-900">{vessel.name}</h1>
            <p className="mt-2 text-[13px] font-light tracking-wide text-yacht-900/55">
              {vessel.builder.toUpperCase()} · {metric}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] font-light text-yacht-900/55">
              <Users className="h-3.5 w-3.5 text-yacht-teal" /> Up to {vessel.guests} guests
            </p>
            <p className="mt-5 border-t border-yacht-900/10 pt-5 text-[14px] font-light text-yacht-900/60">
              {term ? 'Daily from: ' : 'From: '}
              <span className="text-xl font-semibold tracking-wide text-yacht-900">{headlineRate}</span>
            </p>
            {vessel.availability && (
              <p className="mt-2 text-[11px] font-light uppercase tracking-[0.15em] text-yacht-brand">{vessel.availability}</p>
            )}

            <a
              href="#book"
              className="mt-6 block w-full bg-yacht-900 py-3.5 text-center text-[12px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand"
            >
              ✉ Check Availability
            </a>
            <button
              type="button"
              onClick={share}
              className="mt-2.5 flex w-full items-center justify-center gap-2 border border-yacht-900/15 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand"
            >
              <Share2 className="h-4 w-4" /> {shared ? 'Link copied' : 'Share'}
            </button>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <a href={CHARTER_PHONE_TEL} className="flex items-center justify-center gap-2 border border-yacht-900/15 py-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand">
                <Phone className="h-4 w-4" /> Call
              </a>
              <a href={`mailto:${CHARTER_EMAIL}?subject=${encodeURIComponent(`Charter inquiry — ${vessel.name}`)}`} className="flex items-center justify-center gap-2 border border-yacht-900/15 py-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand">
                <Mail className="h-4 w-4" /> Email
              </a>
            </div>

            <CreateYachtProfileCta id={`charter-${vessel.slug}`} name={vessel.name} />

            <p className="mt-5 border-t border-yacht-900/10 pt-4 text-[13px] font-light leading-6 text-yacht-900/60">
              Charter desk <span className="block font-semibold text-yacht-900">{CHARTER_PHONE_DISPLAY}</span>
              <span className="mt-1 block text-[12px]">{day?.departsFrom ?? `${CHARTER_MARINA_NAME} · ${CHARTER_MARINA_ADDRESS}`}</span>
            </p>
          </div>
        </aside>
      </main>

      {/* Booking form */}
      <section id="book" className="scroll-mt-24 bg-yacht-900 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">Charter the {vessel.name}</h2>
            <p className="mt-4 text-[15px] font-light leading-7 text-white/70">
              Tell us your date and group size — a charter specialist confirms availability and walks you
              through the day.
            </p>
            <div className="mt-8"><CharterContact dark departsFrom={day?.departsFrom} /></div>
          </div>
          <PublicInquiryForm context={`Charter inquiry — ${vessel.name}`} dark />
        </div>
      </section>

      <HomeFooter />
      <div className="h-16 lg:hidden" />
      <StickyMobileCta price={headlineRate} context={`Charter — ${vessel.name}`} />
      <BriannaWidget />

      {lightbox !== null && (
        <Lightbox images={gallery} title={vessel.name} start={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
