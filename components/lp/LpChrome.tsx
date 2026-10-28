// Header, hero and footer for the paid-traffic landing pages (/lp/*).
//
// Pure markup with no hooks: the same components render the build-time shell
// (scripts/seoData.ts → renderToStaticMarkup) and the live page, so the first
// paint a visitor gets from the CDN is the page itself — logo, H1, CTA — not a
// generic shell that the app swaps out on mount. That swap would move the
// largest paint, and the page's whole budget is LCP < 2.5s on a phone.
//
// No nav, no chat widget, no sticky bar: the page has one job.

import { Phone } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import FYILogo from '../layout/FYILogo';
import { LP_PHONE_DISPLAY, LP_PHONE_TEL } from './ccContent';

type PhoneClick = (placement: string) => void;

export const LP_WRAP = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8';
export const LP_EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.35em]';
const CTA_BASE =
  'inline-flex min-h-[52px] items-center justify-center bg-yacht-brand px-7 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-yacht-brand-light focus-visible:outline-2 focus-visible:outline-offset-4';
/** Primary CTA on the navy sections. */
export const LP_CTA = `${CTA_BASE} focus-visible:outline-white`;
/** Primary CTA on white and off-white sections. */
export const LP_CTA_LIGHT = `${CTA_BASE} focus-visible:outline-yacht-900`;

export function LpHeader({ onPhoneClick }: { onPhoneClick?: PhoneClick }) {
  return (
    <header className="bg-yacht-900">
      <div className={`${LP_WRAP} flex h-[72px] items-center justify-between gap-4 sm:h-20`}>
        <a href="/" aria-label="FYI Yachts home" className="shrink-0">
          <FYILogo className="h-10 w-auto sm:h-12" />
        </a>
        {/* A clear call button, number included: some visitors would rather talk. */}
        <a
          href={`tel:${LP_PHONE_TEL}`}
          onClick={onPhoneClick ? () => onPhoneClick('header') : undefined}
          aria-label={`Call us at ${LP_PHONE_DISPLAY}`}
          className="inline-flex min-h-[48px] items-center gap-3 border border-white/60 px-4 py-1.5 text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5"
        >
          <Phone className="h-4 w-4 shrink-0 text-yacht-teal" aria-hidden="true" />
          <span className="flex flex-col leading-tight sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Call us</span>
            <span className="text-[13px] font-semibold tracking-[0.06em]">{LP_PHONE_DISPLAY}</span>
          </span>
        </a>
      </div>
    </header>
  );
}

/** id of the count in the trust strip. */
export const LP_COUNT_ID = 'lp-count';

/**
 * The count the prerendered hero carries (the build's live count). Read
 * before React replaces that markup, so the strip keeps its number while the
 * page loads its own inventory.
 */
export function readLpCount(): number | null {
  if (typeof document === 'undefined') return null;
  return Number(document.getElementById(LP_COUNT_ID)?.textContent?.replace(/[^0-9]/g, '')) || null;
}

export function LpHero({
  eyebrow, h1, subhead, count, countLabel, form, onBrowse,
}: {
  eyebrow: string;
  h1: string;
  subhead: string;
  /** Live inventory count; the strip leaves it out until it is known. */
  count?: number | null;
  countLabel: string;
  /** The quick contact form, in a card beside the copy (below it on a phone). */
  form?: ReactNode;
  onBrowse?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  // Grid placement, not duplicated markup, moves the trust strip: under the
  // form on a phone, under the copy beside the form on desktop.
  return (
    <section className="bg-yacht-900 pb-14 pt-7 sm:pb-20 sm:pt-14">
      <div className={`${LP_WRAP} grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-0`}>
        <div className="lg:col-start-1 lg:row-start-1">
          <p className={`${LP_EYEBROW} text-yacht-teal`}>{eyebrow}</p>
          <h1 className="mt-4 text-[2.125rem] font-light leading-[1.15] tracking-wide text-white sm:mt-5 sm:text-5xl lg:text-6xl">
            {h1}
          </h1>
          <p className="mt-4 max-w-2xl text-base font-light leading-7 text-white/80 sm:mt-5 sm:text-lg">{subhead}</p>
        </div>
        <div id="contact" className="scroll-mt-4 bg-white p-5 shadow-xl sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          {form}
        </div>
        <div className="lg:col-start-1 lg:row-start-2 lg:mt-10 lg:self-start">
          <a
            href="#inventory"
            onClick={onBrowse}
            className="inline-flex min-h-[44px] items-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white underline decoration-white/40 underline-offset-8 transition-colors hover:decoration-yacht-teal focus-visible:outline-2 focus-visible:outline-white"
          >
            Browse inventory
          </a>
          <p className="mt-6 border-t border-white/15 pt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/75">
            Since 1994 ·{' '}
            {count ? <><span id={LP_COUNT_ID}>{count.toLocaleString('en-US')}</span> {countLabel} · </> : null}
            Miami-based
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * The page frame: header, hero, then whatever the page adds below. Rendered
 * with no children it is also the build-time first paint (scripts/seoData.ts),
 * which the app hydrates rather than replaces (index.tsx, on data-lp-shell) —
 * so the hero's H1, the page's largest paint, is painted once, from HTML.
 * Its first client render must therefore stay identical to that build output.
 */
export function LpShell({ hero, onPhoneClick, children, footer }: {
  hero: Parameters<typeof LpHero>[0];
  onPhoneClick?: PhoneClick;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div data-lp-shell="" className="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
      <LpHeader onPhoneClick={onPhoneClick} />
      <main>
        <LpHero {...hero} />
        {children}
      </main>
      {footer}
    </div>
  );
}

/** Smooth-scroll to a section (instant under reduced motion), then move focus. */
export function scrollToId(id: string, focusId?: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  return true;
}

export function LpFooter({ onPhoneClick }: { onPhoneClick?: PhoneClick }) {
  return (
    <footer className="bg-yacht-900 py-8">
      <p className={`${LP_WRAP} text-center text-[12px] font-light leading-6 text-white/70`}>
        © {new Date().getFullYear()} Florida Yachts International · 2424 Coral Way, Miami, FL 33145 ·{' '}
        <a
          href={`tel:${LP_PHONE_TEL}`}
          onClick={onPhoneClick ? () => onPhoneClick('footer') : undefined}
          className="text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
        >
          {LP_PHONE_DISPLAY}
        </a>
      </p>
    </footer>
  );
}
