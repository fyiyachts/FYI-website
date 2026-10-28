// /lp/center-consoles, below the hero: inventory, the step form, why FYI,
// FAQ and the closing CTA. Loaded as its own chunk by CenterConsolePage, which
// renders the header and hero (hydrated from the prerendered HTML).
//
// Inventory is FYI's own exclusive book (the same feed as
// /center-console-boats-for-sale), locked to center consoles and filtered in
// the browser, so every filter answers instantly and the count is real.

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Anchor, ChevronDown, ExternalLink, MapPin, Search, X } from 'lucide-react';
import { track } from '../../utils/analytics';
import { optImg, srcSet } from '../../utils/img';
import { fetchActiveInventory, fmtBoatPrice, type PublicBoat } from '../public/publicData';
import {
  BUDGET_BANDS, CC_FAQS, LP_CONTEXT, LP_PHONE_DISPLAY, LP_PHONE_TEL,
  SIZE_BANDS, WHY_FYI, budgetBandFor, isCenterConsole, sizeBandFor,
} from './ccContent';
import { LP_CTA, LP_CTA_LIGHT, LP_EYEBROW, LP_WRAP, scrollToId } from './LpChrome';
import StepForm, { type Draft } from './StepForm';
import { trackPhoneClick, type ListingOfInterest } from './submitLead';

const SORTS = [
  { key: 'length-desc', label: 'Length: longest first' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'year-desc', label: 'Year: newest first' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];
const DEFAULT_SORT: SortKey = 'length-desc';

const YEARS = [2024, 2020, 2015, 2010];
// Two rows on desktop; on a phone, six cards keep the form within reach.
const PAGE = 6;

const boatLocation = (b: PublicBoat) => [b.city, b.state || b.country].filter(Boolean).join(', ');

function compare(sort: SortKey) {
  const len = (b: PublicBoat) => b.lengthFt ?? 0;
  const price = (b: PublicBoat) => b.priceUsd ?? 0;
  switch (sort) {
    case 'price-desc': return (a: PublicBoat, b: PublicBoat) => price(b) - price(a) || len(b) - len(a);
    // Boats without a price go last, not first.
    case 'price-asc': return (a: PublicBoat, b: PublicBoat) => (price(a) || Infinity) - (price(b) || Infinity) || len(b) - len(a);
    case 'year-desc': return (a: PublicBoat, b: PublicBoat) => (b.year ?? 0) - (a.year ?? 0) || len(b) - len(a);
    default: return (a: PublicBoat, b: PublicBoat) => len(b) - len(a) || price(b) - price(a);
  }
}

function toListing(b: PublicBoat): ListingOfInterest {
  return {
    id: b.id, title: b.title, price: fmtBoatPrice(b),
    year: b.year, make: b.make, model: b.model, lengthFt: b.lengthFt, location: boatLocation(b) || undefined,
  };
}

/** Size and budget answers a boat already gives; only the ones it has. */
function prefillFor(b: PublicBoat): Partial<Draft> {
  const p: Partial<Draft> = {};
  const size = sizeBandFor(b.lengthFt);
  const budget = budgetBandFor(b.priceUsd);
  if (size) p.size = size.label;
  if (budget) p.budget = budget.label;
  return p;
}

/* ------------------------------------------------------------------ card */

function CcCard({ boat, onRequest }: { boat: PublicBoat; onRequest: (b: PublicBoat) => void }) {
  const where = boatLocation(boat);
  return (
    <article className="flex flex-col bg-white shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden bg-yacht-900/5">
        {boat.image ? (
          <img
            src={optImg(boat.image, 640)}
            srcSet={srcSet(boat.image, [320, 480, 640, 960])}
            sizes="(min-width:1024px) 380px, (min-width:640px) 50vw, 100vw"
            alt={`${boat.title} for sale`}
            width={640}
            height={480}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center"><Anchor className="h-8 w-8 text-yacht-900/25" aria-hidden="true" /></div>
        )}
        {boat.lengthFt ? (
          <span className="absolute left-4 top-4 bg-yacht-900/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
            {Math.round(boat.lengthFt)}&#39;
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-light tracking-wide text-yacht-900">{boat.title}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-light text-yacht-900/75">
          {boat.lengthFt ? <span>{Math.round(boat.lengthFt * 10) / 10} ft</span> : null}
          {where ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{where}</span> : null}
        </p>
        <p className="mt-3 text-base font-semibold text-yacht-900">{fmtBoatPrice(boat)}</p>
        <div className="mt-auto flex items-center gap-4 pt-5">
          <button type="button" onClick={() => onRequest(boat)} className={`${LP_CTA_LIGHT} flex-1`}>
            Request info
          </button>
          <a
            href={`/listing/${boat.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-yacht-900/80 hover:text-yacht-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yacht-900"
          >
            Details<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">for the {boat.title} (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------------------- modal */

function RequestModal({ boat, onClose }: { boat: PublicBoat; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const listing = useMemo(() => toListing(boat), [boat]);
  const prefill = useMemo(() => prefillFor(boat), [boat]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click that lands on the dialog itself (not its panel) is the backdrop.
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      aria-labelledby="lp-modal-title"
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-yacht-900/70 sm:m-auto sm:h-auto sm:max-h-[92vh] sm:max-w-xl"
    >
      <div className="min-h-full bg-white px-5 pb-8 pt-5 sm:min-h-0 sm:px-8 sm:pt-6">
        <div className="flex items-start gap-4 border-b border-yacht-900/10 pb-5">
          {boat.image ? (
            <img src={optImg(boat.image, 160)} alt="" width={96} height={72} className="h-[72px] w-24 shrink-0 object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/75">Request info</p>
            <h2 id="lp-modal-title" className="mt-1 text-lg font-light leading-snug tracking-wide text-yacht-900">{boat.title}</h2>
            <p className="mt-0.5 text-[14px] font-semibold text-yacht-900">{listing.price}</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center text-yacht-900/80 hover:text-yacht-brand focus-visible:outline-2 focus-visible:outline-yacht-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="pt-6">
          <StepForm listing={listing} prefill={prefill} placement="modal" onPhoneClick={trackPhoneClick} />
        </div>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------- inventory */

const selectCls =
  'w-full appearance-none rounded-lg border border-yacht-900/25 bg-white py-3 pl-4 pr-10 text-[15px] font-light text-yacht-900 focus:border-yacht-brand focus:outline-none focus:ring-2 focus:ring-yacht-brand/30';
const fieldLabel = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/80';
const chip = (on: boolean) =>
  `min-h-[44px] rounded-lg border px-4 text-[13px] font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yacht-900 ${
    on ? 'border-yacht-900 bg-yacht-900 text-white' : 'border-yacht-900/25 bg-white text-yacht-900 hover:border-yacht-900/60'
  }`;

function Select({ id, label, value, onChange, children }: {
  id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>{label}</label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>{children}</select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-yacht-900/70" aria-hidden="true" />
      </div>
    </div>
  );
}

function Inventory({ boats, state, onRequest }: {
  boats: PublicBoat[];
  state: 'loading' | 'ready' | 'error';
  onRequest: (b: PublicBoat) => void;
}) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const brand = params.get('brand') ?? '';
  const len = params.get('len') ?? '';
  const price = params.get('price') ?? '';
  const year = Number(params.get('year')) || 0;
  const sortParam = params.get('sort') ?? '';
  const sort: SortKey = SORTS.some((s) => s.key === sortParam) ? (sortParam as SortKey) : DEFAULT_SORT;
  const [shown, setShown] = useState(PAGE);

  // Filters live in the URL (shareable, survive a reload) next to the ad's
  // utm_* params, which are left untouched. replace: no history entry per keystroke.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
    setShown(PAGE);
  };
  const clearAll = () => {
    const next = new URLSearchParams(params);
    for (const k of ['q', 'brand', 'len', 'price', 'year', 'sort']) next.delete(k);
    setParams(next, { replace: true, preventScrollReset: true });
    setShown(PAGE);
  };

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of boats) if (b.make) counts.set(b.make, (counts.get(b.make) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [boats]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const size = SIZE_BANDS.find((s) => s.key === len);
    const budget = BUDGET_BANDS.find((b) => b.key === price);
    return boats
      .filter((b) => {
        if (brand && b.make.toLowerCase() !== brand.toLowerCase()) return false;
        if (size && !(b.lengthFt && b.lengthFt >= size.min && b.lengthFt < size.max)) return false;
        if (budget && !(b.priceUsd && b.priceUsd >= budget.min && b.priceUsd < budget.max)) return false;
        if (year && !(b.year && b.year >= year)) return false;
        if (words.length) {
          const hay = [b.title, b.boatName, b.make, b.model, b.city, b.state, b.country].filter(Boolean).join(' ').toLowerCase();
          if (!words.every((w) => hay.includes(w))) return false;
        }
        return true;
      })
      .sort(compare(sort));
  }, [boats, q, brand, len, price, year, sort]);

  const filtered = !!(q || brand || len || price || year);
  const total = boats.length;

  return (
    <section id="inventory" className="scroll-mt-4 bg-yacht-cream py-16 sm:py-24">
      <div className={LP_WRAP}>
        <p className={`${LP_EYEBROW} text-yacht-900/75`}>Inventory</p>
        <h2 className="mt-4 text-3xl font-light tracking-wide text-yacht-900 sm:text-4xl">Center consoles available now</h2>

        <div className="mt-10 space-y-6">
          <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
            <div>
              <label htmlFor="lp-q" className={fieldLabel}>Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-yacht-900/70" aria-hidden="true" />
                <input
                  id="lp-q"
                  type="search"
                  value={q}
                  onChange={(e) => setParam('q', e.target.value)}
                  placeholder="Model, brand or location"
                  className="w-full rounded-lg border border-yacht-900/25 bg-white py-3 pl-11 pr-4 text-base font-light text-yacht-900 placeholder:text-yacht-900/50 focus:border-yacht-brand focus:outline-none focus:ring-2 focus:ring-yacht-brand/30"
                />
              </div>
            </div>
            <Select id="lp-brand" label="Brand" value={brand} onChange={(v) => setParam('brand', v)}>
              <option value="">All brands</option>
              {brands.map(([name, n]) => <option key={name} value={name}>{name} ({n})</option>)}
            </Select>
          </div>

          <div role="group" aria-labelledby="lp-len-label">
            <p id="lp-len-label" className={fieldLabel}>Length</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!len} onClick={() => setParam('len', '')} className={chip(!len)}>Any</button>
              {SIZE_BANDS.map((s) => (
                <button key={s.key} type="button" aria-pressed={len === s.key} onClick={() => setParam('len', len === s.key ? '' : s.key)} className={chip(len === s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Select id="lp-price" label="Price" value={price} onChange={(v) => setParam('price', v)}>
              <option value="">Any price</option>
              {BUDGET_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </Select>
            <Select id="lp-year" label="Year" value={year ? String(year) : ''} onChange={(v) => setParam('year', v)}>
              <option value="">Any year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y} and newer</option>)}
            </Select>
            <Select id="lp-sort" label="Sort" value={sort} onChange={(v) => setParam('sort', v === DEFAULT_SORT ? '' : v)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="mt-8 flex min-h-[44px] flex-wrap items-center justify-between gap-3 border-t border-yacht-900/10 pt-6">
          <p className="text-[14px] font-light text-yacht-900/80" aria-live="polite">
            {state === 'loading' ? 'Loading center consoles…'
              : state === 'error' ? ''
                : filtered ? `${results.length} of ${total} center consoles` : `${total} center consoles`}
          </p>
          {filtered && (
            <button type="button" onClick={clearAll} className="min-h-[44px] text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900 underline underline-offset-4 hover:text-yacht-brand focus-visible:outline-2 focus-visible:outline-yacht-900">
              Clear filters
            </button>
          )}
        </div>

        {state === 'loading' ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="bg-white shadow-sm">
                <div className="aspect-[4/3] animate-pulse bg-yacht-900/10" />
                <div className="space-y-3 p-6"><div className="h-5 w-3/4 bg-yacht-900/10" /><div className="h-4 w-1/2 bg-yacht-900/10" /></div>
              </div>
            ))}
          </div>
        ) : results.length ? (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.slice(0, shown).map((b) => <CcCard key={b.id} boat={b} onRequest={onRequest} />)}
            </div>
            {results.length > shown && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setShown(results.length)}
                  className="min-h-[52px] border border-yacht-900 px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900 transition-colors hover:bg-yacht-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yacht-900"
                >
                  Show all {results.length}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 bg-white px-6 py-12 text-center shadow-sm sm:px-12">
            <h3 className="text-2xl font-light tracking-wide text-yacht-900">Don’t see it? We’ll source it.</h3>
            <p className="mx-auto mt-3 max-w-lg text-base font-light leading-7 text-yacht-900/80">
              {state === 'error'
                ? 'Our inventory didn’t load just now. Tell us what you’re after and a specialist will send you matches, including boats not yet on the market.'
                : 'Most of the right boats never sit on a website for long. Tell us what you’re after and a specialist will find it, including boats not yet on the market.'}
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="#get-matched" onClick={(e) => { e.preventDefault(); scrollToId('get-matched', 'lp-form-title'); }} className={LP_CTA_LIGHT}>
                Get matched
              </a>
              {filtered && (
                <button type="button" onClick={clearAll} className="min-h-[44px] text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900 underline underline-offset-4 hover:text-yacht-brand">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ body */

export interface BodyProps {
  /** Reports the live center console count for the hero's trust strip. */
  onCount: (n: number) => void;
}

export default function CenterConsoleBody({ onCount }: BodyProps) {
  const [boats, setBoats] = useState<PublicBoat[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [requested, setRequested] = useState<PublicBoat | null>(null);

  useEffect(() => {
    let alive = true;
    fetchActiveInventory()
      .then((all) => {
        if (!alive) return;
        const cc = all.filter((b) => isCenterConsole(b.classCode));
        setBoats(cc);
        setState(cc.length ? 'ready' : 'error');
        if (cc.length) onCount(cc.length);
      })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [onCount]);

  const toForm = (placement: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    track('lp_cta_click', { context: LP_CONTEXT, placement });
    scrollToId('get-matched', 'lp-form-title');
  };

  return (
    <>
      <Inventory boats={boats} state={state} onRequest={(b) => { track('lp_request_info', { context: LP_CONTEXT, listing_id: b.id }); setRequested(b); }} />

      <section id="get-matched" className="scroll-mt-4 bg-white py-16 sm:py-24" aria-labelledby="lp-form-title">
        <div className={`${LP_WRAP} max-w-[760px]`}>
          <p className={`${LP_EYEBROW} text-yacht-brand`}>Get matched · about 45 seconds</p>
          <h2 id="lp-form-title" tabIndex={-1} className="mt-4 text-3xl font-light tracking-wide text-yacht-900 focus:outline-none sm:text-4xl">
            Tell us what you’re looking for
          </h2>
          <p className="mt-3 text-base font-light leading-7 text-yacht-900/80">
            Four quick taps and a few details. A center console specialist will come back with boats that fit — on our dock or off it.
          </p>
          <div className="mt-10 rounded-lg border border-yacht-900/10 bg-yacht-cream/60 p-5 sm:p-8">
            <StepForm placement="form" onPhoneClick={trackPhoneClick} />
          </div>
        </div>
      </section>

      <section className="bg-yacht-cream py-16 sm:py-24" aria-labelledby="lp-why">
        <div className={LP_WRAP}>
          <p className={`${LP_EYEBROW} text-yacht-900/75`}>Why FYI</p>
          <h2 id="lp-why" className="mt-4 text-3xl font-light tracking-wide text-yacht-900 sm:text-4xl">Buy from people who run these boats</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {WHY_FYI.map((w) => (
              <div key={w.title} className="bg-white p-7 shadow-sm">
                <span className="block h-0.5 w-10 bg-yacht-brand" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-light tracking-wide text-yacht-900">{w.title}</h3>
                <p className="mt-3 text-[15px] font-light leading-7 text-yacht-900/80">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24" aria-labelledby="lp-faq">
        <div className={`${LP_WRAP} max-w-[860px]`}>
          <p className={`${LP_EYEBROW} text-yacht-brand`}>FAQ</p>
          <h2 id="lp-faq" className="mt-4 text-3xl font-light tracking-wide text-yacht-900 sm:text-4xl">Center console questions, answered</h2>
          <div className="mt-10 divide-y divide-yacht-900/10 border-y border-yacht-900/10">
            {CC_FAQS.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[17px] font-light text-yacht-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yacht-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-yacht-900/70 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="pb-6 text-[15px] font-light leading-7 text-yacht-900/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-yacht-900 py-16 sm:py-20">
        <div className={`${LP_WRAP} text-center`}>
          <p className={`${LP_EYEBROW} text-yacht-teal`}>Center console specialists since 1994</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-light leading-snug tracking-wide text-white sm:text-4xl">
            Tell us the boat. We’ll find it.
          </h2>
          <div className="mt-9 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
            <a href="#get-matched" onClick={toForm('cta-band')} className={LP_CTA}>Get matched</a>
            <a
              href={`tel:${LP_PHONE_TEL}`}
              onClick={() => trackPhoneClick('cta-band')}
              className="inline-flex min-h-[44px] items-center text-[13px] font-semibold tracking-[0.08em] text-white underline decoration-white/40 underline-offset-8 hover:decoration-yacht-teal focus-visible:outline-2 focus-visible:outline-white"
            >
              or call {LP_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>
      {requested && <RequestModal boat={requested} onClose={() => setRequested(null)} />}
    </>
  );
}
