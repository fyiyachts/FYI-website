// /lp/center-consoles, below the hero: inventory, why FYI, FAQ, and the
// optional step form. Loaded as its own chunk by CenterConsolePage, which
// renders the header and hero (hydrated from the prerendered HTML).
//
// Inventory is the same as /center-console-boats-for-sale: FYI's own center
// consoles first ("FYI Exclusive", filtered and sorted in the browser), then
// every co-brokerage center console from BoatsGroup PLS, which searches,
// sorts and pages server-side (/api/yachts/cobrokerage) and loads in as the
// visitor asks for more. The same filters drive both.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Anchor, ChevronDown, ExternalLink, MapPin, Search, X } from 'lucide-react';
import { track } from '../../utils/analytics';
import { optImg, srcSet } from '../../utils/img';
import { fetchActiveInventory, fmtBoatPrice, searchCobrokerage, type PublicBoat } from '../public/publicData';
import {
  BUDGET_BANDS, CC_FAQS, LP_CONTEXT, LP_PHONE_DISPLAY, LP_PHONE_TEL, SIZE_BANDS, WHY_FYI, isCenterConsole,
} from './ccContent';
import { LP_CTA_LIGHT, LP_EYEBROW, LP_WRAP, scrollToId } from './LpChrome';
import QuickForm from './QuickForm';
import StepForm from './StepForm';
import { submitCcLead, trackPhoneClick, type ListingOfInterest } from './submitLead';

const SORTS = [
  { key: 'length-desc', label: 'Length: longest first' },
  { key: 'newest', label: 'Newest listings' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'price-asc', label: 'Price: low to high' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];
const DEFAULT_SORT: SortKey = 'length-desc';

const YEARS = [2024, 2020, 2015, 2010];
// Two rows on desktop; on a phone, six cards keep the rest of the page within reach.
const FIRST_PAGE = 6;
const MORE = 12;
const CO_PAGE = 24;

// Builders a center console buyer types most, offered as suggestions in the
// brand box alongside every make actually showing on the page.
const CC_BUILDERS = [
  'Boston Whaler', 'Contender', 'Yellowfin', 'Intrepid', 'SeaVee', 'Grady-White', 'Regulator',
  'Freeman', 'Invincible', 'Scout', 'Pursuit', 'Everglades', 'Robalo', 'Sea Hunt', 'Mako',
  'Cobia', 'Sportsman', 'Sea Fox', 'Midnight Express', 'Cigarette', 'Valhalla', 'Nor-Tech',
];

const boatLocation = (b: PublicBoat) => [b.city, b.state || b.country].filter(Boolean).join(', ');
const ts = (iso?: string) => (iso ? Date.parse(iso) || 0 : 0);

/** FYI Exclusives' order; PLS applies the same keys to co-brokerage. Unknowns go last. */
function compare(sort: SortKey) {
  const v = (n?: number) => (n && Number.isFinite(n) ? n : -1);
  switch (sort) {
    case 'price-desc': return (a: PublicBoat, b: PublicBoat) => v(b.priceUsd) - v(a.priceUsd);
    case 'price-asc': return (a: PublicBoat, b: PublicBoat) => (v(a.priceUsd) === -1 ? 1 : v(b.priceUsd) === -1 ? -1 : v(a.priceUsd) - v(b.priceUsd));
    case 'newest': return (a: PublicBoat, b: PublicBoat) => ts(b.listedAt) - ts(a.listedAt);
    default: return (a: PublicBoat, b: PublicBoat) => v(b.lengthFt) - v(a.lengthFt);
  }
}

function toListing(b: PublicBoat): ListingOfInterest {
  return {
    id: b.id, title: b.title, price: fmtBoatPrice(b),
    year: b.year, make: b.make, model: b.model, lengthFt: b.lengthFt, location: boatLocation(b) || undefined,
  };
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
        {/* Same badge as the cards across the site. */}
        {boat.source === 'fyi' && (
          <span className="absolute bottom-3 left-4 bg-yacht-brand px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white">
            FYI Exclusive
          </span>
        )}
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

function RequestModal({ boat, onClose, onMore }: { boat: PublicBoat; onClose: () => void; onMore: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const listing = useMemo(() => toListing(boat), [boat]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click that lands on the dialog itself (not its panel) is the backdrop.
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      aria-labelledby="lp-modal-title"
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-yacht-900/70 sm:m-auto sm:h-auto sm:max-h-[92vh] sm:max-w-lg"
    >
      <div className="min-h-full bg-white px-5 pb-8 pt-5 sm:min-h-0 sm:px-8 sm:pt-6">
        <div className="flex items-start gap-4 border-b border-yacht-900/10 pb-5">
          {boat.image ? (
            <img src={optImg(boat.image, 160)} alt="" width={96} height={72} className="h-[72px] w-24 shrink-0 object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/75">Request info</p>
            <p id="lp-modal-title" className="mt-1 text-lg font-light leading-snug tracking-wide text-yacht-900">{boat.title}</p>
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
          <QuickForm
            idPrefix="lp-mf"
            placement="modal"
            title="Ask about this boat"
            intro="Name, email and phone — a specialist will come back to you on this boat."
            onSubmit={(c, guard) => submitCcLead({ kind: 'quick', ...c, listing }, guard)}
            onPhoneClick={trackPhoneClick}
            onMore={() => { ref.current?.close(); onMore(); }}
          />
        </div>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------- inventory */

const selectCls =
  'w-full appearance-none rounded-lg border border-yacht-900/25 bg-white py-3 pl-4 pr-10 text-[15px] font-light text-yacht-900 focus:border-yacht-brand focus:outline-none focus:ring-2 focus:ring-yacht-brand/30';
const textCls =
  'w-full rounded-lg border border-yacht-900/25 bg-white py-3 pr-4 text-base font-light text-yacht-900 placeholder:text-yacht-900/50 focus:border-yacht-brand focus:outline-none focus:ring-2 focus:ring-yacht-brand/30';
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

interface CoState {
  boats: PublicBoat[];
  /** PLS's total less every FYI boat removed from the pages loaded so far. */
  numResults: number;
  dropped: number;
  nextStart: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
}
const CO_EMPTY: CoState = { boats: [], numResults: 0, dropped: 0, nextStart: 0, hasMore: false, loading: true, error: false };

function Inventory({ all, exState, onRequest, onUnfilteredTotal }: {
  /** FYI's own center consoles, unfiltered. */
  all: PublicBoat[];
  exState: 'loading' | 'ready' | 'error';
  onRequest: (b: PublicBoat) => void;
  onUnfilteredTotal: (n: number) => void;
}) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const brand = params.get('brand') ?? '';
  const len = params.get('len') ?? '';
  const price = params.get('price') ?? '';
  const year = Number(params.get('year')) || 0;
  const sortParam = params.get('sort') ?? '';
  const sort: SortKey = SORTS.some((s) => s.key === sortParam) ? (sortParam as SortKey) : DEFAULT_SORT;
  const size = SIZE_BANDS.find((s) => s.key === len);
  const budget = BUDGET_BANDS.find((b) => b.key === price);
  const filtered = !!(q || brand || size || budget || year);

  // Filters live in the URL (shareable, survive a reload) next to the ad's
  // utm_* params, which are left untouched. replace: no history entry per keystroke.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  };
  const clearAll = () => {
    const next = new URLSearchParams(params);
    for (const k of ['q', 'brand', 'len', 'price', 'year', 'sort']) next.delete(k);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  // FYI Exclusives: all loaded, so they filter as the visitor types. Ranges
  // are inclusive at both ends, as PLS's are.
  const exclusives = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all
      .filter((b) => {
        if (brand && !b.make.toLowerCase().includes(brand.toLowerCase())) return false;
        if (size && !(b.lengthFt && b.lengthFt >= size.min && b.lengthFt <= size.max)) return false;
        if (budget && !(b.priceUsd && b.priceUsd >= budget.min && b.priceUsd <= budget.max)) return false;
        if (year && !(b.year && b.year >= year)) return false;
        if (words.length) {
          const hay = [b.title, b.boatName, b.make, b.model, b.city, b.state, b.country].filter(Boolean).join(' ').toLowerCase();
          if (!words.every((w) => hay.includes(w))) return false;
        }
        return true;
      })
      .sort(compare(sort));
  }, [all, q, brand, size, budget, year, sort]);

  // Co-brokerage: PLS searches, sorts and pages. Any change to the request
  // starts over at the first page; typing is debounced so each keystroke
  // doesn't become a search.
  const request = useMemo(() => {
    const p: Record<string, string> = { type: 'Center Consoles', sort };
    if (q.trim()) p.q = q.trim();
    if (brand.trim()) p.make = brand.trim();
    if (size) { p.minLen = String(size.min); if (Number.isFinite(size.max)) p.maxLen = String(size.max); }
    if (budget) { if (budget.min) p.minPrice = String(budget.min); if (Number.isFinite(budget.max)) p.maxPrice = String(budget.max); }
    if (year) p.year = String(year);
    return JSON.stringify(p);
  }, [q, brand, size, budget, year, sort]);
  const [co, setCo] = useState<CoState>(CO_EMPTY);
  const [visible, setVisible] = useState(FIRST_PAGE);
  const inflight = useRef<AbortController | null>(null);

  const load = (start: number, reset: boolean) => {
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    setCo((c) => ({ ...(reset ? CO_EMPTY : c), loading: true, error: false }));
    searchCobrokerage(JSON.parse(request), start, CO_PAGE, ctl.signal)
      .then((page) => {
        if (ctl.signal.aborted) return;
        setCo((c) => {
          // Same boat on two PLS pages (the order shifted between calls) shows once.
          const seen = new Set(reset ? [] : c.boats.map((b) => b.id));
          const fresh = page.boats.filter((b) => !seen.has(b.id));
          // Each page's total is corrected only for its own drops; keep a
          // running sum so the count doesn't tick up on "Show more".
          const dropped = (reset ? 0 : c.dropped) + page.dropped;
          return {
            boats: reset ? fresh : [...c.boats, ...fresh],
            numResults: Math.max(page.numResults + page.dropped - dropped, 0),
            dropped,
            nextStart: page.nextStart,
            hasMore: page.hasMore,
            loading: false,
            error: false,
          };
        });
      })
      .catch(() => {
        if (!ctl.signal.aborted) setCo((c) => ({ ...c, loading: false, error: true, hasMore: false }));
      });
  };

  useEffect(() => {
    setVisible(FIRST_PAGE);
    setCo(CO_EMPTY);
    const t = window.setTimeout(() => load(0, true), 300);
    return () => { window.clearTimeout(t); inflight.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // "Show more" reveals the next cards. FYI Exclusives are already all loaded;
  // once the reveal runs past what co-brokerage has loaded, fetch its next page.
  const needCo = visible - exclusives.length;
  useEffect(() => {
    if (needCo > co.boats.length && co.hasMore && !co.loading) load(co.nextStart, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needCo, co.boats.length, co.hasMore, co.loading]);

  const shown = [...exclusives.slice(0, visible), ...co.boats.slice(0, Math.max(0, visible - exclusives.length))];
  const total = exclusives.length + co.numResults;
  const settled = exState !== 'loading' && !co.loading;
  const canShowMore = visible < exclusives.length + co.boats.length || co.hasMore;
  const stillLoading = exState === 'loading' || (co.loading && co.boats.length === 0 && exclusives.length === 0);
  const failed = exState === 'error' && co.error;

  // The hero's trust strip counts the whole, unfiltered book.
  useEffect(() => {
    if (!filtered && settled && total) onUnfilteredTotal(total);
  }, [filtered, settled, total, onUnfilteredTotal]);

  const brandOptions = useMemo(
    () => [...new Set([...all.map((b) => b.make), ...co.boats.map((b) => b.make), ...CC_BUILDERS].filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [all, co.boats],
  );

  return (
    <section id="inventory" className="scroll-mt-4 bg-yacht-cream py-16 sm:py-24">
      <div className={LP_WRAP}>
        <p className={`${LP_EYEBROW} text-yacht-900/75`}>Inventory</p>
        <h2 className="mt-4 text-3xl font-light tracking-wide text-yacht-900 sm:text-4xl">Center consoles available now</h2>
        <p className="mt-3 max-w-2xl text-base font-light leading-7 text-yacht-900/80">
          FYI Exclusives first, then every center console on the market that we can sell for you.
        </p>

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
                  placeholder="Model, brand or keyword"
                  className={`${textCls} pl-11`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="lp-brand" className={fieldLabel}>Brand</label>
              <input
                id="lp-brand"
                type="text"
                list="lp-brands"
                value={brand}
                onChange={(e) => setParam('brand', e.target.value)}
                placeholder="All brands"
                autoComplete="off"
                className={`${textCls} pl-4`}
              />
              <datalist id="lp-brands">
                {brandOptions.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
          </div>

          <div role="group" aria-labelledby="lp-len-label">
            <p id="lp-len-label" className={fieldLabel}>Length</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!size} onClick={() => setParam('len', '')} className={chip(!size)}>Any</button>
              {SIZE_BANDS.map((s) => (
                <button key={s.key} type="button" aria-pressed={len === s.key} onClick={() => setParam('len', len === s.key ? '' : s.key)} className={chip(len === s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Select id="lp-price" label="Price" value={budget ? price : ''} onChange={(v) => setParam('price', v)}>
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
            {failed ? ''
              : settled || co.boats.length > 0
                ? `${total.toLocaleString('en-US')} ${filtered ? 'matching ' : ''}center console${total === 1 ? '' : 's'}`
                : 'Searching center consoles…'}
          </p>
          {filtered && (
            <button type="button" onClick={clearAll} className="min-h-[44px] text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900 underline underline-offset-4 hover:text-yacht-brand focus-visible:outline-2 focus-visible:outline-yacht-900">
              Clear filters
            </button>
          )}
        </div>

        {stillLoading ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="bg-white shadow-sm">
                <div className="aspect-[4/3] animate-pulse bg-yacht-900/10" />
                <div className="space-y-3 p-6"><div className="h-5 w-3/4 bg-yacht-900/10" /><div className="h-4 w-1/2 bg-yacht-900/10" /></div>
              </div>
            ))}
          </div>
        ) : shown.length ? (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((b) => <CcCard key={b.id} boat={b} onRequest={onRequest} />)}
            </div>
            {canShowMore && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + MORE)}
                  disabled={co.loading && needCo > co.boats.length}
                  className="min-h-[52px] border border-yacht-900 px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900 transition-colors hover:bg-yacht-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yacht-900 disabled:opacity-60"
                >
                  {co.loading && needCo > co.boats.length ? 'Loading…' : 'Show more center consoles'}
                </button>
              </div>
            )}
          </>
        ) : settled || failed ? (
          <div className="mt-6 bg-white px-6 py-12 text-center shadow-sm sm:px-12">
            <h3 className="text-2xl font-light tracking-wide text-yacht-900">Don’t see it? We’ll source it.</h3>
            <p className="mx-auto mt-3 max-w-lg text-base font-light leading-7 text-yacht-900/80">
              {failed
                ? 'Our inventory didn’t load just now. Tell us what you’re after and a specialist will send you matches, including boats not yet on the market.'
                : 'Most of the right boats never sit on a website for long. Tell us what you’re after and a specialist will find it, including boats not yet on the market.'}
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="#contact" onClick={(e) => { e.preventDefault(); scrollToId('contact', 'lp-qf-name'); }} className={LP_CTA_LIGHT}>
                Talk to a specialist
              </a>
              {filtered && (
                <button type="button" onClick={clearAll} className="min-h-[44px] text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900 underline underline-offset-4 hover:text-yacht-brand">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : null}
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
  const [exclusives, setExclusives] = useState<PublicBoat[]>([]);
  const [exState, setExState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [requested, setRequested] = useState<PublicBoat | null>(null);

  useEffect(() => {
    let alive = true;
    fetchActiveInventory()
      .then((all) => {
        if (!alive) return;
        const cc = all.filter((b) => isCenterConsole(b.classCode));
        setExclusives(cc);
        setExState(cc.length ? 'ready' : 'error');
      })
      .catch(() => { if (alive) setExState('error'); });
    return () => { alive = false; };
  }, []);

  const toStepForm = () => scrollToId('get-matched', 'lp-form-title');

  return (
    <>
      <Inventory
        all={exclusives}
        exState={exState}
        onRequest={(b) => { track('lp_request_info', { context: LP_CONTEXT, listing_id: b.id }); setRequested(b); }}
        onUnfilteredTotal={onCount}
      />

      <section className="bg-white py-16 sm:py-24" aria-labelledby="lp-why">
        <div className={LP_WRAP}>
          <p className={`${LP_EYEBROW} text-yacht-brand`}>Why FYI</p>
          <h2 id="lp-why" className="mt-4 text-3xl font-light tracking-wide text-yacht-900 sm:text-4xl">Buy from people who run these boats</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {WHY_FYI.map((w) => (
              <div key={w.title} className="bg-yacht-cream p-7">
                <span className="block h-0.5 w-10 bg-yacht-brand" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-light tracking-wide text-yacht-900">{w.title}</h3>
                <p className="mt-3 text-[15px] font-light leading-7 text-yacht-900/80">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-yacht-cream py-16 sm:py-24" aria-labelledby="lp-faq">
        <div className={`${LP_WRAP} max-w-[860px]`}>
          <p className={`${LP_EYEBROW} text-yacht-900/75`}>FAQ</p>
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

      {/* The optional step form closes the page, on navy. */}
      <section id="get-matched" className="scroll-mt-4 bg-yacht-900 py-16 sm:py-24" aria-labelledby="lp-form-title">
        <div className={`${LP_WRAP} max-w-[760px]`}>
          <p className={`${LP_EYEBROW} text-yacht-teal`}>Optional · about 45 seconds</p>
          <h2 id="lp-form-title" tabIndex={-1} className="mt-4 text-3xl font-light tracking-wide text-white focus:outline-none sm:text-4xl">
            Want sharper matches? Tell us more.
          </h2>
          <p className="mt-3 text-base font-light leading-7 text-white/80">
            Four quick taps on size, budget and how you’ll use the boat. A center console specialist comes back with boats that fit — on our dock or off it.
          </p>
          <div className="mt-10 bg-white p-5 sm:p-8">
            <StepForm placement="form" onPhoneClick={trackPhoneClick} />
          </div>
          <p className="mt-8 text-center text-[13px] font-semibold tracking-[0.08em] text-white">
            Rather talk?{' '}
            <a
              href={`tel:${LP_PHONE_TEL}`}
              onClick={() => trackPhoneClick('closing')}
              className="underline decoration-white/40 underline-offset-8 hover:decoration-yacht-teal focus-visible:outline-2 focus-visible:outline-white"
            >
              Call {LP_PHONE_DISPLAY}
            </a>
          </p>
        </div>
      </section>

      {requested && <RequestModal boat={requested} onClose={() => setRequested(null)} onMore={toStepForm} />}
    </>
  );
}
