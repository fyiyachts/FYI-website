// Shared by the landing page's two forms: the quick contact form in the hero
// (name, email, phone) and the optional step form at the bottom. One draft in
// sessionStorage backs both, so details typed in one are already filled in the
// other, and nothing typed is lost to a failed submit or a reload.
//
// No React or app imports: the quick form is part of the prerendered shell
// (scripts/seoData.ts bundles it for Node).

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

export const EMPTY_DRAFT: Draft = {
  size: '', budget: '', use: '', owns: '', currentBoat: '', name: '', email: '', phone: '', message: '',
};

const DRAFT_KEY = 'fyi_lp_cc_draft';
/** Fired on window when one form saves contact details the other should pick up. */
export const DRAFT_EVENT = 'fyi-lp-draft';

export function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY_DRAFT;
  } catch { return EMPTY_DRAFT; }
}

export function saveDraft(patch: Partial<Draft>, announce = false): void {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...loadDraft(), ...patch })); } catch { /* storage unavailable */ }
  if (announce) window.dispatchEvent(new Event(DRAFT_EVENT));
}

export function clearDraft(): void {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }
}

export type ContactErrors = Partial<Record<'name' | 'email' | 'phone' | 'consent', string>>;

export function validateContact(c: { name: string; email: string; phone: string }): ContactErrors {
  const e: ContactErrors = {};
  if (c.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim())) e.email = 'Please enter a valid email address.';
  if (c.phone.replace(/\D/g, '').length < 10) e.phone = 'Please enter a phone number with area code.';
  return e;
}

// 16px text so iOS doesn't zoom on focus; 8px radius.
export const INPUT_CLS =
  'w-full rounded-lg border border-yacht-900/25 bg-white px-4 py-3.5 text-base font-light text-yacht-900 placeholder:text-yacht-900/50 focus:border-yacht-brand focus:outline-none focus:ring-2 focus:ring-yacht-brand/30 aria-[invalid=true]:border-yacht-brand';
export const LABEL_CLS = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-900/80';
export const SUBMIT_CLS =
  'inline-flex min-h-[56px] w-full items-center justify-center bg-yacht-brand px-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-yacht-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yacht-brand focus-visible:ring-offset-2 disabled:opacity-60';
