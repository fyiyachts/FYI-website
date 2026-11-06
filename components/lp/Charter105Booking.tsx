// /lp/charterspecial, below the hero: how it works, the six-step booking form
// with its live summary card, the fine print, the footer and the mobile
// sticky bar. Loaded as its own chunk by Charter105Page.
//
// A booking request goes to /api/contact/broker like every site lead, with
// context "Charter Promo": the sales@ email (cc charters@) reads "[Charter
// Promo] Booking request", the HubSpot note says so, lead_source stays
// Website. Nothing is charged on the page.

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  CalendarCheck, Check, ChefHat, ChevronLeft, ChevronRight, Info, MapPin, Martini, Minus, Plus, Sun, Sunset, Utensils, Waves,
} from 'lucide-react';
import { track, trackAdsConversion } from '../../utils/analytics';
import { getAttribution } from '../../utils/attribution';
import { HoneypotField } from '../../utils/formGuard';
import { identifyVisitor } from '../../utils/hubspotTracking';
import { metaLeadContext, trackMetaLead } from '../../utils/metaPixel';
import FYILogo from '../layout/FYILogo';
import { LP_PHONE_DISPLAY, LP_PHONE_TEL } from './ccContent';
import { LP_WRAP } from './LpChrome';
import { C105_CTAS_ID, C105_PILL_RED } from './Charter105Hero';
import {
  C105_CASH_DISCOUNT, C105_CONTEXT, C105_DEFAULT_GUESTS, C105_DEPARTS_ADDRESS, C105_DEPARTS_NAME, C105_EMAIL, C105_EXTRAS,
  C105_HOURS, C105_LEAD_DAYS, C105_MAX_GUESTS, C105_MONTHS_AHEAD, C105_PATH, C105_PAYMENTS, C105_PRICE, C105_SLOTS,
  C105_STEPS, C105_TERMS, blackoutsFor, dayKey, usd,
} from './charter105Content';
import { INPUT_CLS, LABEL_CLS, validateContact, type ContactErrors } from './leadForm';
import { firstLeadThisVisit, postLead } from './submitLead';

type PhoneClick = (placement: string) => void;

// The mock-up's muted text and hairline colours.
const MUTED = 'text-[#5b6b7d]';
const LINE = 'border-[#d9e1ea]';
const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.32em]';
const H2 = 'text-[clamp(28px,4.5vw,40px)] font-extrabold uppercase leading-[1.05] tracking-[-0.01em] text-yacht-900';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const EXTRA_ICONS: Record<(typeof C105_EXTRAS)[number], typeof ChefHat> = {
  'Private chef': ChefHat,
  Bartender: Martini,
  'Food & catering': Utensils,
  'Restaurant reservation': CalendarCheck,
  'Extra water toy': Waves,
};

const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const cashTotal = Math.round(C105_PRICE * (1 - C105_CASH_DISCOUNT));

/* ------------------------------------------------------------- sections */

function HowItWorks() {
  return (
    <section aria-labelledby="c105-how" className="bg-yacht-cream py-14">
      <div className={LP_WRAP}>
        <p className={`${EYEBROW} text-yacht-brand`}>How it works</p>
        <h2 id="c105-how" className={`mt-2 ${H2}`}>Three steps to the water</h2>
        <div className="mt-7 grid gap-3.5 min-[760px]:grid-cols-3 min-[760px]:gap-5">
          {C105_STEPS.map((s, i) => (
            <div key={s.title} className={`flex items-start gap-4 rounded-2xl border ${LINE} bg-white p-[22px]`}>
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-yacht-900 font-extrabold text-white">{i + 1}</span>
              <div>
                <h3 className="text-[15px] font-extrabold uppercase tracking-[0.04em] text-yacht-900">{s.title}</h3>
                <p className={`mt-1 text-sm ${MUTED}`}>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Terms() {
  return (
    <section aria-label="Good to know" className="bg-yacht-cream py-9">
      <ul className={`${LP_WRAP} grid gap-2.5 min-[760px]:grid-cols-2 min-[760px]:gap-x-8 min-[760px]:gap-y-3`}>
        {C105_TERMS.map((t, i) => {
          const Icon = i === 0 ? MapPin : Info;
          return (
            <li key={t} className={`flex gap-2.5 text-sm ${MUTED}`}>
              <Icon className="mt-0.5 h-[18px] w-[18px] flex-none text-yacht-900" aria-hidden="true" />
              {t}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One numbered step of the booking form. */
function Block({ id, n, title, optional, done, invalid, error, children }: {
  id: string; n: number; title: string; optional?: boolean; done: boolean; invalid?: boolean; error?: string; children: ReactNode;
}) {
  return (
    <div id={id} className={`scroll-mt-24 border-b ${LINE} py-[26px] last:border-b-0`}>
      <div className="mb-4 flex items-center gap-3">
        <span className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[13px] font-extrabold transition-colors ${done ? 'bg-yacht-teal text-white' : 'bg-yacht-cream text-yacht-900'}`}>
          {n}
        </span>
        <h3 className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-yacht-900">{title}</h3>
        {optional && <span className={`ml-auto text-[11px] font-semibold uppercase tracking-[0.12em] ${MUTED}`}>Optional</span>}
      </div>
      {children}
      {invalid && error && <p className="mt-2.5 text-[13px] font-semibold text-yacht-brand">{error}</p>}
    </div>
  );
}

const cardBox = `flex h-full flex-col gap-1 rounded-[14px] border-2 ${LINE} px-[18px] py-4 transition hover:border-[#b9c6d3] peer-checked:border-yacht-900 peer-checked:bg-[#f5f8fb] peer-checked:shadow-[0_0_0_3px_rgba(15,39,64,0.08)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-yacht-teal`;

/* ------------------------------------------------------------- booking */

type Step = 'date' | 'time' | 'pay' | 'you';
const STEP_ID: Record<Step, string> = { date: 'c105-b-date', time: 'c105-b-time', pay: 'c105-b-pay', you: 'c105-b-you' };

function Booking({ onPhoneClick }: { onPhoneClick: PhoneClick }) {
  // Bookable window and this year's (and next year's) holiday blackouts.
  const { minD, maxD, today, holidays } = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const min = new Date(t);
    min.setDate(min.getDate() + C105_LEAD_DAYS);
    const max = new Date(t.getFullYear(), t.getMonth() + C105_MONTHS_AHEAD + 1, 0);
    const hol = new Map<string, string>();
    for (let y = t.getFullYear(); y <= max.getFullYear(); y++) for (const [k, v] of blackoutsFor(y)) hol.set(k, v);
    return { minD: min, maxD: max, today: t, holidays: hol };
  }, []);

  const [view, setView] = useState(() => new Date(minD.getFullYear(), minD.getMonth(), 1));
  const [date, setDate] = useState<Date | null>(null);
  const [calMsg, setCalMsg] = useState('');
  const [slot, setSlot] = useState<number | null>(null);
  const [guests, setGuests] = useState(C105_DEFAULT_GUESTS);
  const [extras, setExtras] = useState<string[]>([]);
  const [pay, setPay] = useState<string | null>(null);
  const [c, setC] = useState({ name: '', email: '', phone: '', message: '' });
  const [fieldErr, setFieldErr] = useState<ContactErrors>({});
  const [flagged, setFlagged] = useState<Set<Step>>(new Set());
  const [sendErr, setSendErr] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [company, setCompany] = useState('');
  const openedAt = useRef(Date.now());
  const doneRef = useRef<HTMLDivElement>(null);

  const cash = pay === 'Cash';
  const total = cash ? cashTotal : C105_PRICE;
  const contactOk = Object.keys(validateContact(c)).length === 0;
  const complete: Record<Step, boolean> = { date: !!date, time: slot !== null, pay: !!pay, you: contactOk };
  // A step stays red only until it is filled in; so does the summary's note.
  const isInvalid = (s: Step) => flagged.has(s) && !complete[s];
  const formErr = [...flagged].some((s) => !complete[s]) ? 'Please complete the highlighted steps.' : sendErr;

  const firstMonth = new Date(minD.getFullYear(), minD.getMonth(), 1);
  const lastMonth = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
  const shiftMonth = (by: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + by, 1));

  const pickDay = (d: Date) => {
    const hol = holidays.get(dayKey(d));
    if (hol) { setCalMsg(`${hol} is a holiday blackout. Please pick another date.`); return; }
    if (d < minD) { setCalMsg('Please choose a date from tomorrow onward.'); return; }
    if (d > maxD) { setCalMsg(''); return; }
    setCalMsg('');
    setDate(d);
  };

  const setField = (k: keyof typeof c, v: string) => {
    setC((cur) => ({ ...cur, [k]: v }));
    if (k in fieldErr) setFieldErr((e) => { const n = { ...e }; delete n[k as keyof ContactErrors]; return n; });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status !== 'idle') return;
    const errs = validateContact(c);
    setFieldErr(errs);
    const missing = (['date', 'time', 'pay', 'you'] as Step[]).filter((s) => (s === 'you' ? Object.keys(errs).length > 0 : !complete[s]));
    setFlagged(new Set(missing));
    setSendErr('');
    if (missing.length) {
      const block = document.getElementById(STEP_ID[missing[0]]);
      block?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const target = block?.querySelector<HTMLElement>('[aria-invalid=true], input, button[data-day]:not([aria-disabled=true])');
      if (target) setTimeout(() => target.focus({ preventScroll: true }), 350);
      return;
    }
    setStatus('sending');
    const s = C105_SLOTS[slot!];
    const a = getAttribution();
    const utm = (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const).filter((k) => a[k]).map((k) => `${k}=${a[k]}`).join(' ');
    const message = [
      'Charter Promo booking request — 105′ Azimut Daily Charter Special',
      `Date: ${longDate(date!)}`,
      `Time slot: ${s.label}, ${s.time}`,
      `Departs: ${C105_DEPARTS_NAME}, ${C105_DEPARTS_ADDRESS}`,
      `Guests: ${guests}`,
      `Extras: ${extras.join(', ') || 'None'}`,
      `Payment method: ${pay}`,
      `Quoted total: ${usd(total)}${cash ? ` (5% cash discount on ${usd(C105_PRICE)})` : ''}, gratuity included`,
      `Occasion/requests: ${c.message.trim() || 'None'}`,
      `Page: ${C105_PATH}`,
      `UTM: ${utm || 'none'}`,
    ].join('\n');
    const meta = metaLeadContext();
    const res = await postLead({
      yacht: { title: '105′ Azimut — Daily Charter Special', price: `${usd(C105_PRICE)} / ${C105_HOURS} hours` },
      name: c.name.trim(),
      email: c.email.trim(),
      phone: c.phone.trim(),
      message,
      attribution: a,
      context: 'Charter Promo',
      meta,
      company,
      formOpenedAt: openedAt.current,
    });
    if (!res.ok) {
      setStatus('idle');
      setSendErr(`${res.error ? `${res.error.replace(/[.!]?$/, '.')} ` : 'We couldn’t send that just now. '}Your answers are still here — please try again, or call ${LP_PHONE_DISPLAY}.`);
      return;
    }
    // Conversion tags once per visit.
    if (firstLeadThisVisit('fyi_lp_c105_converted')) {
      track('generate_lead', { context: C105_CONTEXT, page_path: C105_PATH, value: total, currency: 'USD', payment: pay ?? undefined, slot: s.label });
      trackAdsConversion(C105_CONTEXT);
      // FYI Pixel Lead (utils/metaPixel.ts), with advanced matching.
      void trackMetaLead({
        contentName: 'Charter request — 105′ Azimut Daily Charter Special',
        user: { email: c.email.trim(), phone: c.phone.trim(), fullName: c.name.trim() },
        eventId: meta.eventId,
      });
      // Plain 'track' = the other pixel on the page only (HubSpot's legacy
      // pixel; metaPixel.ts keeps it away from FYI's). Left as it was.
      try { window.fbq?.('track', 'Lead'); } catch { /* noop */ }
    }
    identifyVisitor(c.email.trim());
    setStatus('sent');
  };

  useEffect(() => {
    if (status !== 'sent') return;
    doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    doneRef.current?.focus({ preventScroll: true });
  }, [status]);

  // Calendar cells for the month in view.
  const lead = view.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

  const sumRow = (label: string, value: ReactNode, empty?: boolean) => (
    <div className="flex justify-between gap-4 border-b border-white/[0.12] py-[11px] text-sm">
      <dt className="text-white/65">{label}</dt>
      <dd className={`text-right ${empty ? 'font-medium text-white/40' : 'font-bold'}`}>{value}</dd>
    </div>
  );
  const slotObj = slot !== null ? C105_SLOTS[slot] : null;

  return (
    <section id="book" aria-labelledby="c105-book-h" className="scroll-mt-4 bg-white pb-20 pt-16">
      <div className={LP_WRAP}>
        <div className="max-w-[640px]">
          <p className={`${EYEBROW} text-yacht-brand`}>Book your date</p>
          <h2 id="c105-book-h" className={`mt-2 ${H2}`}>Reserve the 105′ Azimut</h2>
          <p className={`mt-2.5 ${MUTED}`}>Takes about a minute. No payment today: we confirm availability first.</p>
        </div>

        <form onSubmit={submit} noValidate className="mt-8 grid items-start gap-6 min-[1000px]:grid-cols-[1fr_380px] min-[1000px]:gap-8">
          <div className={`rounded-[20px] border ${LINE} bg-white`}>
            {status === 'sent' ? (
              <div ref={doneRef} tabIndex={-1} role="status" className="px-7 py-12 text-center focus:outline-none">
                <span className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-yacht-teal">
                  <Check className="h-[34px] w-[34px] text-white" strokeWidth={3} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-[26px] font-extrabold uppercase text-yacht-900">Request received!</h3>
                <p className={`mx-auto mt-2.5 max-w-[460px] ${MUTED}`}>
                  Thanks, {c.name.trim().split(/\s+/)[0]}. Our charter team will contact you shortly to confirm availability and payment.
                </p>
                <div className="mx-auto mt-[22px] max-w-[420px] rounded-[14px] bg-yacht-cream px-[18px] py-4 text-left text-sm leading-[1.8]">
                  <b>Date:</b> {date && longDate(date)}<br />
                  <b>Time:</b> {slotObj && `${slotObj.label}, ${slotObj.time}`}<br />
                  <b>Guests:</b> {guests}<br />
                  <b>Extras:</b> {extras.join(', ') || 'None'}<br />
                  <b>Payment:</b> {pay}<br />
                  <b>Total:</b> {usd(total)}{cash ? ' (5% cash discount)' : ''}, gratuity included
                </div>
              </div>
            ) : (
              <div className="px-5 py-2 sm:px-8 sm:py-3">
                <Block id={STEP_ID.date} n={1} title="Choose your date" done={complete.date} invalid={isInvalid('date')} error="Please choose a date.">
                  <div className="max-w-[480px]">
                    <div className="mb-2.5 flex items-center justify-between">
                      <button type="button" aria-label="Previous month" disabled={view <= firstMonth} onClick={() => shiftMonth(-1)}
                        className={`grid h-10 w-10 place-items-center rounded-full border ${LINE} bg-white transition hover:enabled:bg-yacht-cream disabled:cursor-default disabled:opacity-30`}>
                        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      <b aria-live="polite" className="text-base font-extrabold text-yacht-900">{MONTHS[view.getMonth()]} {view.getFullYear()}</b>
                      <button type="button" aria-label="Next month" disabled={view >= lastMonth} onClick={() => shiftMonth(1)}
                        className={`grid h-10 w-10 place-items-center rounded-full border ${LINE} bg-white transition hover:enabled:bg-yacht-cream disabled:cursor-default disabled:opacity-30`}>
                        <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </div>
                    <div aria-hidden="true" className="grid grid-cols-7 gap-1">
                      {DOW.map((d) => <span key={d} className={`py-1.5 text-center text-[11px] font-bold tracking-[0.08em] ${MUTED}`}>{d}</span>)}
                    </div>
                    <div role="group" aria-label="Choose a charter date" className="grid grid-cols-7 gap-1">
                      {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const d = new Date(view.getFullYear(), view.getMonth(), i + 1);
                        const hol = holidays.get(dayKey(d));
                        const out = d < minD || d > maxD;
                        const sel = !!date && +d === +date;
                        const label = `${longDate(d)}${hol ? `, ${hol}, holiday blackout` : out ? ', not available' : ''}`;
                        return (
                          <button
                            key={i}
                            type="button"
                            data-day=""
                            aria-label={label}
                            aria-disabled={hol || out ? true : undefined}
                            aria-pressed={sel || undefined}
                            title={hol ? `${hol} (blackout)` : undefined}
                            onClick={() => pickDay(d)}
                            className={`relative aspect-square rounded-xl text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-yacht-teal ${
                              sel ? 'bg-yacht-900 text-white'
                                : hol ? 'cursor-not-allowed bg-[repeating-linear-gradient(135deg,#fdf0ee_0_4px,#fff_4px_8px)] text-yacht-brand line-through'
                                  : out ? 'cursor-not-allowed text-[#b8c2cc]'
                                    : 'text-yacht-800 hover:bg-yacht-cream'
                            } ${+d === +today ? "after:absolute after:bottom-1.5 after:left-1/2 after:-ml-0.5 after:h-1 after:w-1 after:rounded-full after:bg-yacht-teal after:content-['']" : ''}`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                    <div className={`mt-3 flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs ${MUTED}`}>
                      <span className="inline-flex items-center gap-2"><i className="inline-block h-3.5 w-3.5 rounded bg-yacht-900" />Selected</span>
                      <span className="inline-flex items-center gap-2"><i className="inline-block h-3.5 w-3.5 rounded border border-[#f0c4bd] bg-[repeating-linear-gradient(135deg,#f7d5d0_0_3px,#fff_3px_6px)]" />Holiday blackout</span>
                    </div>
                    <p aria-live="polite" className="mt-2.5 min-h-5 text-[13px] font-semibold text-yacht-brand">{calMsg}</p>
                  </div>
                </Block>

                <Block id={STEP_ID.time} n={2} title="Choose your time" done={complete.time} invalid={isInvalid('time')} error="Please choose a time slot.">
                  <div role="radiogroup" aria-label="Time slot" className="grid gap-3 min-[560px]:grid-cols-2">
                    {C105_SLOTS.map((s, i) => {
                      const Icon = s.icon === 'sun' ? Sun : Sunset;
                      return (
                        <label key={s.label} className="relative block cursor-pointer">
                          <input type="radio" name="c105-slot" className="peer sr-only" checked={slot === i} onChange={() => setSlot(i)} />
                          <span className={cardBox}>
                            <span className={`absolute right-3.5 top-3.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 transition ${slot === i ? 'border-yacht-900 bg-yacht-900' : LINE}`}>
                              <Check className={`h-3 w-3 text-white ${slot === i ? 'opacity-100' : 'opacity-0'}`} strokeWidth={4} aria-hidden="true" />
                            </span>
                            <Icon className="mb-1.5 h-7 w-7 text-yacht-900" strokeWidth={1.8} aria-hidden="true" />
                            <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${MUTED}`}>{s.label}</span>
                            <span className="text-lg font-extrabold text-yacht-900">{s.time}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </Block>

                <Block id="c105-b-guests" n={3} title="Number of guests" done>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <div className={`inline-flex items-center overflow-hidden rounded-full border-2 ${LINE}`}>
                      <button type="button" aria-label="Fewer guests" disabled={guests <= 1} onClick={() => setGuests((g) => Math.max(1, g - 1))}
                        className="grid h-14 w-14 place-items-center bg-white text-yacht-900 hover:enabled:bg-yacht-cream disabled:cursor-default disabled:opacity-30">
                        <Minus className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <output aria-live="polite" className="min-w-24 text-center text-xl font-extrabold text-yacht-900">
                        {guests}
                        <small className={`block text-[10px] font-bold uppercase tracking-[0.18em] ${MUTED}`}>{guests === 1 ? 'guest' : 'guests'}</small>
                      </output>
                      <button type="button" aria-label="More guests" disabled={guests >= C105_MAX_GUESTS} onClick={() => setGuests((g) => Math.min(C105_MAX_GUESTS, g + 1))}
                        className="grid h-14 w-14 place-items-center bg-white text-yacht-900 hover:enabled:bg-yacht-cream disabled:cursor-default disabled:opacity-30">
                        <Plus className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    <span className={`text-[13px] ${MUTED}`}>Up to {C105_MAX_GUESTS} guests on board.</span>
                  </div>
                </Block>

                <Block id="c105-b-extras" n={4} title="Add extras" optional done={extras.length > 0}>
                  <div className="flex flex-wrap gap-2.5">
                    {C105_EXTRAS.map((x) => {
                      const Icon = EXTRA_ICONS[x];
                      const on = extras.includes(x);
                      return (
                        <label key={x} className="relative cursor-pointer">
                          <input type="checkbox" className="peer sr-only" checked={on}
                            onChange={() => setExtras((cur) => (on ? cur.filter((y) => y !== x) : [...cur, x]))} />
                          <span className={`inline-flex min-h-[46px] items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-yacht-teal ${
                            on ? 'border-yacht-900 bg-yacht-900 text-white' : `${LINE} text-yacht-900 hover:border-[#b9c6d3]`}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />{x}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className={`mt-3 text-[13px] ${MUTED}`}>Available on request for an additional fee. We'll quote any extras when we confirm.</p>
                </Block>

                <Block id={STEP_ID.pay} n={5} title="How would you like to pay?" done={complete.pay} invalid={isInvalid('pay')} error="Please choose a payment method.">
                  <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
                    {C105_PAYMENTS.map((p) => (
                      <label key={p.value} className="relative block cursor-pointer">
                        <input type="radio" name="c105-pay" className="peer sr-only" checked={pay === p.value} onChange={() => setPay(p.value)} />
                        {'badge' in p && (
                          <span className="absolute -top-2.5 right-2.5 z-[1] rounded-full bg-yacht-brand px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">{p.badge}</span>
                        )}
                        <span className={cardBox}>
                          <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${MUTED}`}>{p.kicker}</span>
                          <span className="text-[15px] font-extrabold text-yacht-900">{p.label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className={`mt-3 text-[13px] ${MUTED}`}>You won't be charged today. We send payment details once your date is confirmed.</p>
                </Block>

                <Block id={STEP_ID.you} n={6} title="Your details" done={complete.you}>
                  <div className="relative grid gap-3.5 sm:grid-cols-2">
                    {([
                      ['name', 'Full name', 'text', 'name', undefined, true],
                      ['email', 'Email', 'email', 'email', 'email', false],
                      ['phone', 'Phone number', 'tel', 'tel', 'tel', false],
                    ] as const).map(([k, label, type, auto, mode, full]) => (
                      <div key={k} className={full ? 'sm:col-span-2' : ''}>
                        <label htmlFor={`c105-${k}`} className={LABEL_CLS}>{label}</label>
                        <input
                          id={`c105-${k}`}
                          type={type}
                          autoComplete={auto}
                          inputMode={mode}
                          required
                          value={c[k]}
                          onChange={(e) => setField(k, e.target.value)}
                          aria-invalid={fieldErr[k] ? true : undefined}
                          aria-describedby={fieldErr[k] ? `c105-${k}-err` : undefined}
                          maxLength={k === 'phone' ? 40 : 200}
                          className={INPUT_CLS}
                        />
                        {fieldErr[k] && <p id={`c105-${k}-err`} className="mt-1.5 text-[13px] text-yacht-brand">{fieldErr[k]}</p>}
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <label htmlFor="c105-msg" className={LABEL_CLS}>
                        Occasion or requests <span className="font-medium normal-case tracking-normal">(optional)</span>
                      </label>
                      <textarea id="c105-msg" rows={3} value={c.message} onChange={(e) => setField('message', e.target.value)}
                        placeholder="Birthday, anniversary, corporate outing…" maxLength={2000} className={`${INPUT_CLS} resize-y`} />
                    </div>
                    <HoneypotField guard={{ company, setCompany, formOpenedAt: openedAt.current, fieldId: 'c105-hp' }} />
                  </div>
                </Block>
              </div>
            )}
          </div>

          <aside aria-labelledby="c105-sum-h" className="relative overflow-hidden rounded-[20px] bg-yacht-900 p-[26px] text-white min-[1000px]:sticky min-[1000px]:top-5">
            <div aria-hidden="true" className="absolute inset-0 bg-[url(/charter/hero-105-1100.webp)] bg-cover bg-center opacity-[0.16]" />
            <div className="relative">
              <p className={`${EYEBROW} text-[#6fe0e4]`}>Your charter</p>
              <h3 id="c105-sum-h" className="mt-1.5 text-[22px] font-extrabold uppercase">105′ Azimut</h3>
              <dl className="mt-[18px]">
                {sumRow('Date', date ? longDate(date) : 'Choose a date', !date)}
                {sumRow('Time', slotObj ? `${slotObj.label}, ${slotObj.time}` : 'Choose a time', !slotObj)}
                {sumRow('Guests', guests)}
                {sumRow('Extras', extras.join(', ') || 'None', !extras.length)}
                {sumRow('Payment', pay ?? 'Choose one', !pay)}
                {sumRow('Departs', C105_DEPARTS_NAME)}
              </dl>
              <div className="mt-[18px] flex items-end justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.16em] text-white/70">Charter total</span>
                <span className="text-4xl font-extrabold leading-none">
                  {usd(total)}
                  {cash && <s className="block text-right text-sm font-semibold text-white/55">{usd(C105_PRICE)}</s>}
                </span>
              </div>
              {cash && <p className="mt-2 text-right text-[13px] font-bold text-[#6fe0e4]">Cash discount: you save {usd(C105_PRICE - cashTotal)}</p>}
              <p className="mt-1.5 text-xs text-white/70">Gratuity included. Extras quoted separately.</p>
              <button type="submit" disabled={status !== 'idle'} className={`${C105_PILL_RED} mt-[22px] w-full disabled:translate-y-0 disabled:opacity-70`}>
                {status === 'sent' ? 'Request sent' : status === 'sending' ? 'Sending…' : 'Request my booking'}
              </button>
              <p className="mt-3 text-center text-xs text-white/70">No payment today · We confirm before you pay</p>
              {formErr && <p role="alert" className="mt-3 rounded-[10px] bg-yacht-brand/20 px-3 py-2.5 text-center text-[13px] font-semibold">{formErr}</p>}
              <div className="mt-4 flex flex-col gap-1.5 border-t border-white/[0.12] pt-4 text-center text-[13px]">
                <span className="text-white/60">Prefer to talk?</span>
                <a href={`tel:${LP_PHONE_TEL}`} onClick={() => onPhoneClick('summary')} className="font-bold text-white hover:underline">{LP_PHONE_DISPLAY}</a>
                <a href={`mailto:${C105_EMAIL}`} className="font-bold text-white hover:underline">{C105_EMAIL}</a>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- page */

export default function Charter105Body({ onPhoneClick }: { onPhoneClick: PhoneClick }) {
  return (
    <>
      <HowItWorks />
      <Booking onPhoneClick={onPhoneClick} />
      <Terms />
    </>
  );
}

export function C105Footer({ onPhoneClick }: { onPhoneClick: PhoneClick }) {
  return (
    // Extra room at the bottom on a phone so the sticky bar never covers the contact lines.
    <footer className="bg-yacht-800 pb-[calc(96px+env(safe-area-inset-bottom))] pt-10 text-sm text-white/75 min-[1000px]:pb-10">
      <div className={`${LP_WRAP} grid gap-6 min-[760px]:grid-cols-[auto_1fr_auto] min-[760px]:items-center`}>
        <FYILogo className="h-11 w-auto" />
        <div>
          FYI Yachts · 2424 Coral Way, Miami, FL 33145<br />
          Charters depart {C105_DEPARTS_NAME}, {C105_DEPARTS_ADDRESS}<br />
          <a href={`tel:${LP_PHONE_TEL}`} onClick={() => onPhoneClick('footer')} className="font-semibold text-white hover:underline">{LP_PHONE_DISPLAY}</a>
          {' · '}
          <a href={`mailto:${C105_EMAIL}`} className="font-semibold text-white hover:underline">{C105_EMAIL}</a>
        </div>
        <div className="text-xs text-white/50">© {new Date().getFullYear()} FYI Yachts</div>
      </div>
    </footer>
  );
}

/**
 * Phone-only bar ($4,800 · Book now). Shows once the hero's buttons have
 * scrolled up off screen, hides while the booking form is on screen.
 *
 * "On screen" means the form crosses the middle of the viewport. The mock-up
 * hid it once 5% of the booking section showed, but that section is ~3,000px
 * tall on a phone and "How it works" is shorter than the screen, so its
 * heading was always in view by the time the hero buttons left — the bar
 * never appeared at all.
 */
export function C105StickyBar({ onBook }: { onBook: () => void }) {
  const [heroOut, setHeroOut] = useState(false);
  const [bookIn, setBookIn] = useState(false);
  useEffect(() => {
    const ctas = document.getElementById(C105_CTAS_ID);
    const form = document.querySelector('#book form');
    if (!ctas || !form || !('IntersectionObserver' in window)) return;
    const a = new IntersectionObserver(([e]) => setHeroOut(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    const b = new IntersectionObserver(([e]) => setBookIn(e.isIntersecting), { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    a.observe(ctas);
    b.observe(form);
    return () => { a.disconnect(); b.disconnect(); };
  }, []);
  const on = heroOut && !bookIn;
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 bg-yacht-900/[0.96] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 text-white backdrop-blur-[8px] transition-transform duration-250 min-[1000px]:hidden ${on ? 'translate-y-0' : 'translate-y-[110%]'}`}
    >
      <div>
        <b className="block text-xl font-extrabold leading-[1.1]">{usd(C105_PRICE)}</b>
        <small className="text-[11px] uppercase tracking-[0.12em] text-white/70">{C105_HOURS} hours · up to {C105_MAX_GUESTS} guests</small>
      </div>
      <a href="#book" tabIndex={-1} onClick={(e) => { e.preventDefault(); onBook(); }} className={`${C105_PILL_RED} min-h-12 px-[22px] text-xs`}>
        Book now
      </a>
    </div>
  );
}
