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
        <a
          href={`tel:${LP_PHONE_TEL}`}
          onClick={onPhoneClick ? () => onPhoneClick('header') : undefined}
          className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold tracking-[0.08em] text-white transition-colors hover:text-yacht-teal focus-visible:outline-2 focus-visible:outline-white"
        >
          <Phone className="h-4 w-4 text-yacht-teal" aria-hidden="true" />
          {LP_PHONE_DISPLAY}
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
  return Number(document.getElementById(LP_COUNT_ID)?.textContent) || null;
}

export function LpHero({
  eyebrow, h1, subhead, ctaLabel, count, countLabel, onCta, onBrowse,
}: {
  eyebrow: string;
  h1: string;
  subhead: string;
  ctaLabel: string;
  /** Live inventory count; the strip leaves it out until it is known. */
  count?: number | null;
  countLabel: string;
  onCta?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onBrowse?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <section className="bg-yacht-900 pb-16 pt-10 sm:pb-24 sm:pt-16">
      <div className={LP_WRAP}>
        <p className={`${LP_EYEBROW} text-yacht-teal`}>{eyebrow}</p>
        <h1 className="mt-5 max-w-5xl text-[2.25rem] font-light leading-[1.15] tracking-wide text-white sm:text-5xl lg:text-6xl">
          {h1}
        </h1>
        <p className="mt-5 max-w-3xl text-base font-light leading-7 text-white/80 sm:text-lg">{subhead}</p>
        <div className="mt-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <a href="#get-matched" onClick={onCta} className={LP_CTA}>{ctaLabel}</a>
          <a
            href="#inventory"
            onClick={onBrowse}
            className="inline-flex min-h-[44px] items-center justify-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white underline decoration-white/40 underline-offset-8 transition-colors hover:decoration-yacht-teal focus-visible:outline-2 focus-visible:outline-white sm:justify-start"
          >
            Browse inventory
          </a>
        </div>
        <p className="mt-10 border-t border-white/15 pt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/75">
          Since 1994 ·{' '}
          {count ? <><span id={LP_COUNT_ID}>{count}</span> {countLabel} · </> : null}
          Miami-based
        </p>
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
