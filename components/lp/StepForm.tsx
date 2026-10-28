// The "Get matched" step form: one question per screen, tap a tile and it
// moves on. Four taps and a contact screen — about 45 seconds.
//
// Everything typed is kept in sessionStorage as it changes, so a failed
// submit, a reload or closing the listing modal never loses an answer; the
// draft is cleared only once a lead has landed.

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, Phone } from 'lucide-react';
import { HoneypotField, guardFields, useFormGuard } from '../../utils/formGuard';
import { BUDGET_BANDS, LP_PHONE_DISPLAY, LP_PHONE_TEL, OWNS, SIZE_BANDS, USES } from './ccContent';
import { submitCcLead, type ListingOfInterest } from './submitLead';

export interface Draft {
  size: string;
  budget: string;
  use: string;
  owns: string;
  currentBoat: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}

const EMPTY: Draft = { size: '', budget: '', use: '', owns: '', currentBoat: '', name: '', email: '', phone: '', message: '' };
const DRAFT_KEY = 'fyi_lp_cc_draft';

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY;
  } catch { return EMPTY; }
}
function saveDraft(d: Draft): void {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
}
function clearDraft(): void {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }
}

type ChoiceKey = 'size' | 'budget' | 'use' | 'owns';
const CHOICES: { key: ChoiceKey; question: string; options: string[] }[] = [
  { key: 'size', question: 'What size center console?', options: [...SIZE_BANDS.map((b) => b.label), 'Not sure'] },
  { key: 'budget', question: 'What’s your budget?', options: BUDGET_BANDS.map((b) => b.label) },
  { key: 'use', question: 'How will you mostly use it?', options: [...USES] },
  { key: 'owns', question: 'Do you currently own a boat?', options: OWNS.map((o) => o.label) },
];
const TOTAL = CHOICES.length + 1;
const OWNS_NO = OWNS[0].label;
const ADVANCE_MS = 220;

const firstOpenStep = (d: Draft) => {
  const i = CHOICES.findIndex((c) => !d[c.key]);
  return i === -1 ? CHOICES.length : i;
};

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'consent', string>>;

function validate(d: Draft, consent: boolean): Errors {
  const e: Errors = {};
  if (d.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Please enter a valid email address.';
  if (d.phone.replace(/\D/g, '').length < 10) e.phone = 'Please enter a phone number with area code.';
  if (!consent) e.consent = 'Please tick the box so a specialist can contact you.';
  return e;
}

const tile = (on: boolean) =>
  `flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg border px-5 py-4 text-left text-[15px] font-light text-yacht-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yacht-brand focus-visible:ring-offset-2 ${
    on ? 'border-yacht-brand bg-yacht-brand/[0.06]' : 'border-yacht-900/20 bg-white hover:border-yacht-900/50'
  }`;
const input =
  'w-full rounded-lg border border-yacht-900/25 bg-white px-4 py-3.5 text-base font-light text-yacht-900 placeholder:text-yacht-900/50 focus:border-yacht-brand focus:outline-none focus:ring-2 focus:ring-yacht-brand/30 aria-[invalid=true]:border-yacht-brand';
const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/80';
const submitBtn =
  'inline-flex min-h-[56px] w-full items-center justify-center bg-yacht-brand px-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-yacht-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yacht-brand focus-visible:ring-offset-2 disabled:opacity-60';

export default function StepForm({
  listing, prefill, onPhoneClick, placement,
}: {
  /** The boat a card's "Request info" opened the form for. */
  listing?: ListingOfInterest | null;
  /** Answers known from that boat (its size and price bands). */
  prefill?: Partial<Draft>;
  onPhoneClick: (placement: string) => void;
  /** Where this form sits, for the phone-click event ("form", "modal"). */
  placement: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...loadDraft(), ...prefill }));
  const [step, setStep] = useState(() => firstOpenStep({ ...loadDraft(), ...prefill }));
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const guard = useFormGuard();
  const uid = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { if (status !== 'sent') saveDraft(draft); }, [draft, status]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Move focus to the new question after a step change the visitor made, so
  // keyboard and screen-reader users land on it; never on first render.
  useEffect(() => { if (moved.current) headingRef.current?.focus({ preventScroll: true }); }, [step]);

  const go = (to: number) => {
    window.clearTimeout(timer.current);
    moved.current = true;
    setStep(Math.max(0, Math.min(to, CHOICES.length)));
  };
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const choose = (key: ChoiceKey, value: string) => {
    set({ [key]: value });
    // "Yes" on the boat question opens the optional make/model/year field, so
    // that one waits for Continue.
    if (key === 'owns' && value !== OWNS_NO) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go(step + 1), ADVANCE_MS);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(draft, consent);
    setErrors(found);
    const firstBad = (['name', 'email', 'phone', 'consent'] as const).find((k) => found[k]);
    if (firstBad) {
      document.getElementById(`${uid}-${firstBad}`)?.focus();
      return;
    }
    // A step answer can be missing if the visitor skipped ahead via a card; ask it.
    const open = firstOpenStep(draft);
    if (open < CHOICES.length) { go(open); return; }
    setStatus('sending');
    const res = await submitCcLead(
      {
        ...draft,
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        message: draft.message.trim(),
        currentBoat: draft.owns === OWNS_NO ? '' : draft.currentBoat.trim(),
        listing: listing ?? null,
      },
      guardFields(guard),
    );
    if (res.ok) {
      clearDraft();
      setStatus('sent');
    } else {
      setErrorMsg(res.error || '');
      setStatus('error');
    }
  };

  const phoneLink = (children: ReactNode, className: string) => (
    <a href={`tel:${LP_PHONE_TEL}`} onClick={() => onPhoneClick(placement)} className={className}>{children}</a>
  );

  if (status === 'sent') {
    const first = draft.name.trim().split(/\s+/)[0];
    return (
      <div className="py-6 text-center" role="status">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yacht-brand/10">
          <Check className="h-7 w-7 text-yacht-brand" aria-hidden="true" />
        </span>
        <h3 className="mt-6 text-2xl font-light tracking-wide text-yacht-900">Thank you{first ? `, ${first}` : ''}.</h3>
        <p className="mx-auto mt-3 max-w-md text-base font-light leading-7 text-yacht-900/80">
          A center console specialist will reach out within one business day.
        </p>
        <p className="mt-6 text-[15px] font-light text-yacht-900/80">
          Rather talk now?{' '}
          {phoneLink(LP_PHONE_DISPLAY, 'font-semibold text-yacht-900 underline underline-offset-4 hover:text-yacht-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yacht-brand')}
        </p>
      </div>
    );
  }

  const choice = CHOICES[step];
  const answered = CHOICES.map((c) => draft[c.key]).filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/75" aria-live="polite">
          Step {step + 1} of {TOTAL}
        </p>
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/80 hover:text-yacht-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yacht-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </button>
        )}
      </div>
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-yacht-900/10"
        role="progressbar"
        aria-label="Form progress"
        aria-valuemin={1}
        aria-valuemax={TOTAL}
        aria-valuenow={step + 1}
      >
        <div className="h-full bg-yacht-brand transition-[width] duration-300" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
      </div>

      {choice ? (
        <div role="group" aria-labelledby={`${uid}-q`} className="mt-8">
          <h3 id={`${uid}-q`} ref={headingRef} tabIndex={-1} className="text-2xl font-light tracking-wide text-yacht-900 focus:outline-none sm:text-[1.75rem]">
            {choice.question}
          </h3>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {choice.options.map((o) => {
              const on = draft[choice.key] === o;
              return (
                <button key={o} type="button" aria-pressed={on} onClick={() => choose(choice.key, o)} className={tile(on)}>
                  <span>{o}</span>
                  {on && <Check className="h-5 w-5 shrink-0 text-yacht-brand" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {choice.key === 'owns' && draft.owns && draft.owns !== OWNS_NO && (
            <div className="mt-6">
              <label htmlFor={`${uid}-boat`} className={label}>Make, model and year <span className="normal-case tracking-normal">(optional)</span></label>
              <input
                id={`${uid}-boat`}
                type="text"
                value={draft.currentBoat}
                onChange={(e) => set({ currentBoat: e.target.value })}
                placeholder="e.g. 2018 Contender 35 ST"
                className={input}
                maxLength={200}
              />
              <button type="button" onClick={() => go(step + 1)} className={`${submitBtn} mt-5`}>Continue</button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="relative mt-8">
          <h3 ref={headingRef} tabIndex={-1} className="text-2xl font-light tracking-wide text-yacht-900 focus:outline-none sm:text-[1.75rem]">
            Where should we send your matches?
          </h3>
          {(answered.length > 0 || listing) && (
            <p className="mt-3 text-[14px] font-light leading-6 text-yacht-900/75">
              {[listing?.title, ...answered.slice(0, 3)].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${uid}-name`} className={label}>Full name</label>
              <input
                id={`${uid}-name`} type="text" autoComplete="name" required
                value={draft.name} onChange={(e) => set({ name: e.target.value })}
                aria-invalid={!!errors.name} aria-describedby={errors.name ? `${uid}-name-err` : undefined}
                className={input} maxLength={120}
              />
              {errors.name && <p id={`${uid}-name-err`} className="mt-1.5 text-[13px] text-yacht-brand">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor={`${uid}-email`} className={label}>Email</label>
              <input
                id={`${uid}-email`} type="email" inputMode="email" autoComplete="email" required
                value={draft.email} onChange={(e) => set({ email: e.target.value })}
                aria-invalid={!!errors.email} aria-describedby={errors.email ? `${uid}-email-err` : undefined}
                className={input} maxLength={200}
              />
              {errors.email && <p id={`${uid}-email-err`} className="mt-1.5 text-[13px] text-yacht-brand">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor={`${uid}-phone`} className={label}>Phone</label>
              <input
                id={`${uid}-phone`} type="tel" inputMode="tel" autoComplete="tel" required
                value={draft.phone} onChange={(e) => set({ phone: e.target.value })}
                aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${uid}-phone-err` : undefined}
                className={input} maxLength={40}
              />
              {errors.phone && <p id={`${uid}-phone-err`} className="mt-1.5 text-[13px] text-yacht-brand">{errors.phone}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${uid}-msg`} className={label}>Anything else? <span className="normal-case tracking-normal">(optional)</span></label>
              <textarea
                id={`${uid}-msg`} rows={3}
                value={draft.message} onChange={(e) => set({ message: e.target.value })}
                placeholder="Must-haves, timing, a boat you’ve seen…"
                className={`${input} resize-none`} maxLength={2000}
              />
            </div>
          </div>
          <div className="mt-5">
            <label htmlFor={`${uid}-consent`} className="flex cursor-pointer items-start gap-3 text-[14px] font-light leading-6 text-yacht-900/85">
              <input
                id={`${uid}-consent`} type="checkbox" checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={!!errors.consent} aria-describedby={errors.consent ? `${uid}-consent-err` : undefined}
                className="mt-1 h-5 w-5 shrink-0 accent-yacht-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yacht-brand focus-visible:ring-offset-2"
              />
              <span>I agree that FYI Yachts may contact me by phone, text or email about my inquiry.</span>
            </label>
            {errors.consent && <p id={`${uid}-consent-err`} className="mt-1.5 text-[13px] text-yacht-brand">{errors.consent}</p>}
          </div>
          <HoneypotField guard={guard} />
          <button type="submit" disabled={status === 'sending'} className={`${submitBtn} mt-7`}>
            {status === 'sending' ? 'Sending…' : 'Get matched'}
          </button>
          {status === 'error' && (
            <div role="alert" className="mt-5 rounded-lg border border-yacht-brand/40 bg-yacht-brand/[0.05] px-4 py-3 text-[14px] font-light leading-6 text-yacht-900">
              {errorMsg ? `${errorMsg.replace(/[.!]?$/, '.')} ` : 'We couldn’t send that just now. '}
              Your answers are saved — please try again, or call us at{' '}
              {phoneLink(LP_PHONE_DISPLAY, 'whitespace-nowrap font-semibold underline underline-offset-4 hover:text-yacht-brand')}.
            </div>
          )}
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[13px] font-light text-yacht-900/75">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            Prefer to talk?{' '}
            {phoneLink(LP_PHONE_DISPLAY, 'font-semibold text-yacht-900 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yacht-brand')}
          </p>
        </form>
      )}
    </div>
  );
}
