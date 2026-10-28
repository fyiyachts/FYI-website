// The landing page's main form: name, email, phone, send. It sits in the hero
// (and in the "Request info" pop-up, with the boat attached); the step form at
// the bottom of the page is the optional follow-up.
//
// Part of the prerendered, hydrated shell, so its first render must not depend
// on the browser: fixed ids from idPrefix (not useId — the build renders it
// outside the app tree, so generated ids would differ), the saved draft read
// in an effect, and no analytics imports (the page passes onSubmit in).

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { HoneypotField } from '../../utils/formGuard';
import { LP_PHONE_DISPLAY, LP_PHONE_TEL } from './ccContent';
import {
  DRAFT_EVENT, INPUT_CLS, LABEL_CLS, SUBMIT_CLS, loadDraft, saveDraft, validateContact, type ContactErrors,
} from './leadForm';

export interface Contact { name: string; email: string; phone: string }

export default function QuickForm({
  idPrefix, placement, title, intro, onSubmit, onPhoneClick, onMore,
}: {
  idPrefix: string;
  /** Where the form sits, for the phone-click event ("hero", "modal"). */
  placement: string;
  title: string;
  intro?: string;
  onSubmit?: (c: Contact, guard: { company: string; formOpenedAt: number }) => Promise<{ ok: boolean; error?: string }>;
  onPhoneClick?: (placement: string) => void;
  /** The optional step form, offered once this one is sent. */
  onMore?: () => void;
}) {
  const [c, setC] = useState<Contact>({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [company, setCompany] = useState('');
  const openedAt = useRef(Date.now());
  const id = (k: string) => `${idPrefix}-${k}`;

  // Details already typed this visit (either form) come back after hydration.
  useEffect(() => {
    const fill = () => {
      const d = loadDraft();
      setC((cur) => ({ name: cur.name || d.name, email: cur.email || d.email, phone: cur.phone || d.phone }));
    };
    fill();
    window.addEventListener(DRAFT_EVENT, fill);
    return () => window.removeEventListener(DRAFT_EVENT, fill);
  }, []);

  const set = (k: keyof Contact, v: string) => {
    setC((cur) => ({ ...cur, [k]: v }));
    saveDraft({ [k]: v });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateContact(c);
    setErrors(found);
    const firstBad = (['name', 'email', 'phone'] as const).find((k) => found[k]);
    if (firstBad) { document.getElementById(id(firstBad))?.focus(); return; }
    if (!onSubmit) return;
    setStatus('sending');
    const contact = { name: c.name.trim(), email: c.email.trim(), phone: c.phone.trim() };
    saveDraft(contact, true);
    const res = await onSubmit(contact, { company, formOpenedAt: openedAt.current });
    if (res.ok) { setStatus('sent'); return; }
    setErrorMsg(res.error || '');
    setStatus('error');
  };

  const phoneLink = (className: string) => (
    <a href={`tel:${LP_PHONE_TEL}`} onClick={() => onPhoneClick?.(placement)} className={className}>{LP_PHONE_DISPLAY}</a>
  );

  if (status === 'sent') {
    const first = c.name.trim().split(/\s+/)[0];
    return (
      <div role="status" className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yacht-brand/10">
          <Check className="h-6 w-6 text-yacht-brand" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-2xl font-light tracking-wide text-yacht-900">Thank you{first ? `, ${first}` : ''}.</h2>
        <p className="mt-3 text-base font-light leading-7 text-yacht-900/80">
          A center console specialist will reach out within one business day.
        </p>
        {onMore && (
          <button
            type="button"
            onClick={onMore}
            className="mt-6 min-h-[48px] w-full border border-yacht-900 px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900 transition-colors hover:bg-yacht-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yacht-900"
          >
            Optional: 4 quick questions for sharper matches
          </button>
        )}
        <p className="mt-5 text-[14px] font-light text-yacht-900/80">
          Rather talk now?{' '}
          {phoneLink('font-semibold text-yacht-900 underline underline-offset-4 hover:text-yacht-brand focus-visible:outline-2 focus-visible:outline-yacht-900')}
        </p>
      </div>
    );
  }

  const field = (k: keyof Contact, label: string, type: string, autoComplete: string, inputMode?: 'email' | 'tel') => (
    <div>
      <label htmlFor={id(k)} className={LABEL_CLS}>{label}</label>
      <input
        id={id(k)}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required
        value={c[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? id(`${k}-err`) : undefined}
        className={INPUT_CLS}
        maxLength={k === 'phone' ? 40 : 200}
      />
      {errors[k] && <p id={id(`${k}-err`)} className="mt-1.5 text-[13px] text-yacht-brand">{errors[k]}</p>}
    </div>
  );

  return (
    // method=post: should the script not have run, a submit never puts the
    // visitor's details in the URL.
    <form method="post" onSubmit={submit} noValidate className="relative" aria-labelledby={id('title')}>
      <h2 id={id('title')} className="text-xl font-light tracking-wide text-yacht-900 sm:text-2xl">{title}</h2>
      {intro && <p className="mt-2 text-[14px] font-light leading-6 text-yacht-900/80">{intro}</p>}
      <div className="mt-5 space-y-4 sm:mt-6">
        {field('name', 'Full name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email', 'email')}
        {field('phone', 'Phone', 'tel', 'tel', 'tel')}
      </div>
      <HoneypotField guard={{ company, setCompany, formOpenedAt: openedAt.current, fieldId: id('hp') }} />
      <button type="submit" disabled={status === 'sending'} className={`${SUBMIT_CLS} mt-5 sm:mt-6`}>
        {status === 'sending' ? 'Sending…' : 'Get matched'}
      </button>
      {status === 'error' && (
        <div role="alert" className="mt-4 rounded-lg border border-yacht-brand/40 bg-yacht-brand/[0.05] px-4 py-3 text-[14px] font-light leading-6 text-yacht-900">
          {errorMsg ? `${errorMsg.replace(/[.!]?$/, '.')} ` : 'We couldn’t send that just now. '}
          Your details are saved — please try again, or call us at{' '}
          {phoneLink('whitespace-nowrap font-semibold underline underline-offset-4 hover:text-yacht-brand')}.
        </div>
      )}
      <p className="mt-4 text-[12px] font-light leading-5 text-yacht-900/75">
        By submitting, you agree that FYI Yachts may contact you by phone, text or email about your inquiry.
      </p>
    </form>
  );
}
