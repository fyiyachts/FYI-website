import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, ChevronDown, Shield, Sparkles } from 'lucide-react';
import { YACHT_MATCH_ENABLED } from '../../utils/featureFlags';
import { getAttribution } from '../../utils/attribution';
import { useFormGuard, guardFields, HoneypotField } from '../../utils/formGuard';
import { identifyVisitor } from '../../utils/hubspotTracking';

/**
 * Buyer tools for the listing detail pages, requested by FYI in the
 * 2026-07-17 meeting (Joel/Sebastian): finance calculator, insurance quote
 * lead capture, a Find-Your-Yacht-Match banner for the sidebar, and an
 * SEO-safe half-height description preview. Each component supports a
 * `tone` for the dark portal page and the light public listing page.
 */

type Tone = 'dark' | 'light';

const card = (tone: Tone) =>
  tone === 'dark'
    ? 'rounded-xl border border-white/10 bg-white/5 p-5'
    : 'rounded-2xl border border-slate-200 bg-white p-5';
const heading = (tone: Tone) =>
  tone === 'dark' ? 'text-white' : 'text-yacht-900';
const subtle = (tone: Tone) =>
  tone === 'dark' ? 'text-white/50' : 'text-slate-500';
const inputCls = (tone: Tone) =>
  tone === 'dark'
    ? 'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-yacht-brand focus:outline-none'
    : 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-yacht-900 placeholder:text-slate-400 focus:border-yacht-brand focus:outline-none';

/* ---------------------------------------------------- description preview */

/**
 * Shows ~half of a long description with a fade + "Continue reading".
 * SEO-safe by design: the full text is always in the DOM (no accordion
 * hiding), only visually clipped — per the meeting decision that hidden
 * accordion text hurts ranking. Keeps Specifications above the fold.
 */
export function DescriptionPreview({ text, tone = 'light' }: { text: string; tone?: Tone }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 600;
  return (
    <div>
      <div
        className={`relative overflow-hidden transition-all ${!expanded && isLong ? 'max-h-52' : ''}`}
      >
        <p className={`whitespace-pre-line text-[14px] leading-relaxed ${tone === 'dark' ? 'text-white/75' : 'text-slate-700'}`}>
          {text}
        </p>
        {!expanded && isLong && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t ${
              tone === 'dark' ? 'from-yacht-900' : 'from-yacht-cream'
            } to-transparent`}
          />
        )}
      </div>
      {!expanded && isLong && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-yacht-brand hover:underline"
        >
          Continue reading <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------- finance calculator */

const fmtUsd = (n: number): string =>
  `$${Math.round(n).toLocaleString('en-US')}`;

export function FinanceCalculator({ price, tone = 'dark' }: { price?: number; tone?: Tone }) {
  const [amount, setAmount] = useState(price && price > 0 ? String(Math.round(price)) : '');
  const [downPct, setDownPct] = useState('20');
  const [apr, setApr] = useState('7.49');
  const [years, setYears] = useState('20');

  const monthly = useMemo(() => {
    const total = parseFloat(amount.replace(/[^0-9.]/g, ''));
    const down = parseFloat(downPct) / 100;
    const rate = parseFloat(apr) / 100 / 12;
    const n = parseFloat(years) * 12;
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(rate) || !Number.isFinite(n) || n <= 0) return null;
    const principal = total * (1 - (Number.isFinite(down) ? Math.min(Math.max(down, 0), 0.95) : 0.2));
    if (principal <= 0) return null;
    if (rate === 0) return principal / n;
    return (principal * rate) / (1 - Math.pow(1 + rate, -n));
  }, [amount, downPct, apr, years]);

  return (
    <div className={card(tone)}>
      <h3 className={`flex items-center gap-2 text-[15px] font-bold ${heading(tone)}`}>
        <Calculator className="h-4 w-4 text-yacht-teal" /> Estimate your monthly payment
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${subtle(tone)}`}>Boat price (USD)</span>
          <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1,500,000" className={`mt-1 ${inputCls(tone)}`} />
        </label>
        <label className="block">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${subtle(tone)}`}>Down payment %</span>
          <input type="text" inputMode="decimal" value={downPct} onChange={(e) => setDownPct(e.target.value)} className={`mt-1 ${inputCls(tone)}`} />
        </label>
        <label className="block">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${subtle(tone)}`}>Rate % APR</span>
          <input type="text" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} className={`mt-1 ${inputCls(tone)}`} />
        </label>
        <label className="col-span-2 block">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${subtle(tone)}`}>Term</span>
          <select value={years} onChange={(e) => setYears(e.target.value)} className={`mt-1 ${inputCls(tone)} ${tone === 'dark' ? '[&>option]:text-yacht-900' : ''}`}>
            <option value="10">10 years</option>
            <option value="15">15 years</option>
            <option value="20">20 years</option>
          </select>
        </label>
      </div>
      <div className={`mt-4 rounded-lg px-4 py-3 ${tone === 'dark' ? 'bg-yacht-900/60' : 'bg-yacht-cream'}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${subtle(tone)}`}>Estimated monthly</p>
        <p className={`text-2xl font-bold ${monthly ? 'text-yacht-brand' : subtle(tone)}`}>
          {monthly ? `${fmtUsd(monthly)}/mo` : '—'}
        </p>
      </div>
      <p className={`mt-2 text-[11px] leading-snug ${subtle(tone)}`}>
        Estimate only — not an offer of credit. Ask us about marine financing tailored to you.
      </p>
      <Link
        to="/lease-to-own"
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-yacht-brand transition-colors hover:underline"
      >
        Not ready to buy outright? Lease-to-own is available <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
      </Link>
    </div>
  );
}

/* ----------------------------------------------- insurance lead capture */

export function InsuranceQuoteCta({
  yacht,
  tone = 'dark',
}: {
  yacht: { title: string; price?: string; year?: string; make?: string; model?: string; length?: string; location?: string };
  tone?: Tone;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
          phone: phone || null,
          message: `Insurance quote request for ${yacht.title}. Please connect me with FYI's insurance partner.`,
          attribution: getAttribution(),
          ...guardFields(guard),
          yacht,
        }),
      });
      setState(res.ok ? 'sent' : 'error');
      if (res.ok) identifyVisitor(email);
    } catch {
      setState('error');
    }
  };

  return (
    <div className={card(tone)}>
      <h3 className={`flex items-center gap-2 text-[15px] font-bold ${heading(tone)}`}>
        <Shield className="h-4 w-4 text-yacht-teal" /> Insure this yacht
      </h3>
      <p className={`mt-1.5 text-[13px] leading-relaxed ${subtle(tone)}`}>
        Get a quote through FYI&rsquo;s marine insurance partner.
      </p>
      {state === 'sent' ? (
        <p className="mt-3 text-[13px] font-semibold text-yacht-teal">
          Request received — our team will reach out with your quote.
        </p>
      ) : open ? (
        <form onSubmit={submit} className="mt-3 space-y-2.5">
          <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls(tone)} />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputCls(tone)} />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={inputCls(tone)} />
          <HoneypotField guard={guard} />
          <button
            type="submit"
            disabled={state === 'sending'}
            className="w-full rounded-lg bg-yacht-brand py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-yacht-brand-light disabled:opacity-60"
          >
            {state === 'sending' ? 'Sending…' : 'Request my quote'}
          </button>
          {state === 'error' && (
            <p className="text-[12px] text-yacht-brand">Something went wrong — please try again.</p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`mt-3 w-full rounded-lg border py-2.5 text-[13px] font-bold transition-colors ${
            tone === 'dark'
              ? 'border-white/20 text-white hover:border-yacht-brand hover:text-yacht-brand'
              : 'border-yacht-900/25 text-yacht-900 hover:border-yacht-brand hover:text-yacht-brand'
          }`}
        >
          Request an insurance quote
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------- yacht match banner */

export function YachtMatchBanner({ tone = 'dark' }: { tone?: Tone }) {
  if (!YACHT_MATCH_ENABLED) return null;
  return (
    <Link
      to="/quiz"
      className="group block overflow-hidden rounded-xl bg-gradient-to-br from-yacht-700 via-yacht-900 to-yacht-800 p-5 ring-1 ring-white/10 transition-shadow hover:shadow-lg"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-teal">
        <Sparkles className="h-3.5 w-3.5" /> Find Your Yacht Match
      </p>
      <p className="mt-2 text-[15px] font-bold leading-snug text-white">
        Tell us what you love. We&rsquo;ll surface the yachts that fit.
      </p>
      <p className="mt-1 text-[12px] text-white/60">
        A 60-second profile — matches, price-drop alerts, and favorites in one place.
      </p>
      <span className="mt-3 inline-block rounded-lg bg-yacht-brand px-4 py-2 text-[12px] font-bold text-white transition-colors group-hover:bg-yacht-brand-light">
        Start matching
      </span>
    </Link>
  );
}
