// Site-wide Charter Special pop-up, pointing at /lp/charterspecial. Mounted
// once in App.tsx. Settings (on/off, end date, link, snooze) live in
// charterPromo.ts.
//
// Desktop / tablet (≥768px): a centred modal over a blurred navy backdrop,
// video left, offer right; focus moves in and stays in, page scroll locks.
// Phone: a small card fixed to the bottom — no backdrop, no scroll lock, no
// focus trap, the page stays usable behind it. Google penalises full-screen
// interstitials on mobile; a banner-sized card isn't one.
//
// Client-only: renders nothing until an effect after mount decides to show
// it, so the prerendered HTML and hydration are untouched. Opens ~600ms after
// the page's load event, at most once per snoozeHours per browser (the time
// it was shown is kept in localStorage), and never twice in one visit.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { track } from '../../utils/analytics';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';
import FYILogo from '../layout/FYILogo';
import { LP_PHONE_DISPLAY, LP_PHONE_TEL } from '../lp/ccContent';
import { CHARTER_PROMO, PROMO_COPY, PROMO_ID, PROMO_MEDIA } from './charterPromo';

const OPEN_DELAY_MS = 600;
const CLOSE_MS = 350;
const DESKTOP = '(min-width: 768px)';

/** Shown once already in this page load (also the fallback when storage is blocked). */
let shownThisLoad = false;

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** A date-only endsAt means "through the end of that day", local time. */
function ended(endsAt: string | null): boolean {
  if (!endsAt) return false;
  const t = /^\d{4}-\d{2}-\d{2}$/.test(endsAt) ? new Date(`${endsAt}T23:59:59`).getTime() : Date.parse(endsAt);
  return Number.isFinite(t) && Date.now() > t;
}

function eligible(pathname: string, search: string): boolean {
  if (!CHARTER_PROMO.enabled || ended(CHARTER_PROMO.endsAt)) return false;
  if (new URLSearchParams(search).get('nopopup') === '1') return false;
  return !CHARTER_PROMO.excludedPaths.some((p) => under(pathname, p));
}

function markShown(): void {
  try { localStorage.setItem(CHARTER_PROMO.storageKey, String(Date.now())); } catch { /* storage blocked */ }
}

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(CHARTER_PROMO.storageKey));
    return at > 0 && Date.now() - at < CHARTER_PROMO.snoozeHours * 3_600_000;
  } catch {
    return false; // storage blocked: shownThisLoad still limits it to once per page load
  }
}

const FADE_DESKTOP = 'linear-gradient(90deg, rgba(15,39,64,0) 55%, rgba(15,39,64,.9) 100%), linear-gradient(to top, rgba(15,39,64,.55), transparent 40%)';
const FADE_PHONE = 'linear-gradient(to top, #0f2740 0%, rgba(15,39,64,.15) 60%, rgba(15,39,64,.35) 100%)';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white';

export default function CharterPromoPopup() {
  const { pathname, search } = useLocation();
  const [mounted, setMounted] = useState(false);
  const [on, setOn] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [withVideo, setWithVideo] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const closing = useRef(false);
  const path = useRef(pathname);
  path.current = pathname;

  // Someone who reached the landing page (e.g. from the ad) has seen the offer.
  useEffect(() => {
    if (under(pathname, CHARTER_PROMO.landingPath)) markShown();
  }, [pathname]);

  // Decide after mount, on each page until it has shown once.
  useEffect(() => {
    if (shownThisLoad || !eligible(pathname, search) || snoozed()) return;
    let timer = 0;
    const start = () => {
      timer = window.setTimeout(() => {
        shownThisLoad = true;
        markShown();
        const wide = window.matchMedia(DESKTOP).matches;
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
        lastFocus.current = document.activeElement as HTMLElement | null;
        closing.current = false;
        setDesktop(wide);
        setWithVideo(wide && !calm); // phones get the still: no video download on cellular
        setMounted(true);
        track('promo_popup_view', { promo: PROMO_ID, page_path: pathname });
      }, OPEN_DELAY_MS);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', start);
    };
  }, [pathname, search]);

  const close = useCallback((how: 'x' | 'later' | 'esc' | 'backdrop' | 'click' | 'navigate') => {
    if (closing.current) return;
    closing.current = true;
    if (how !== 'click' && how !== 'navigate') track('promo_popup_close', { promo: PROMO_ID, page_path: path.current, method: how });
    setOn(false);
    window.setTimeout(() => setMounted(false), CLOSE_MS);
    if (desktop) lastFocus.current?.focus?.({ preventScroll: true });
  }, [desktop]);

  // Slide / fade in after the first frame; on desktop move focus into the dialog.
  useEffect(() => {
    if (!mounted) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)); });
    const f = desktop ? window.setTimeout(() => dialogRef.current?.focus({ preventScroll: true }), 50) : 0;
    videoRef.current?.play().catch(() => {});
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(f); };
  }, [mounted, desktop]);

  // Esc closes; on desktop Tab stays inside the dialog.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close('esc'); return; }
      if (e.key !== 'Tab' || !desktop || !dialogRef.current) return;
      const f = dialogRef.current.querySelectorAll<HTMLElement>('a, button');
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, desktop, close]);

  // Navigating (phone card stays usable) onto a page it doesn't belong on hides it.
  useEffect(() => {
    if (mounted && !eligible(pathname, search)) close('navigate');
  }, [pathname, search, mounted, close]);

  useLockBodyScroll(mounted && desktop);

  if (!mounted) return null;

  return (
    <>
      {desktop && (
        <div
          aria-hidden="true"
          onClick={() => close('backdrop')}
          className={`fixed inset-0 z-[60] bg-[rgba(7,25,45,0.62)] backdrop-blur-[3px] transition-opacity duration-300 motion-reduce:transition-none ${on ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={desktop}
        aria-labelledby="cp-title"
        aria-describedby="cp-desc"
        tabIndex={-1}
        className={`fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-2.5 right-2.5 z-[61] font-sans text-white transition-transform duration-[400ms] ease-[cubic-bezier(.2,.8,.2,1)] focus:outline-none motion-reduce:transition-none md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:w-[min(900px,calc(100vw-48px))] md:-translate-x-1/2 md:transition-[opacity,translate,scale] md:duration-[350ms] ${
          on ? 'translate-y-0 md:-translate-y-1/2 md:scale-100 md:opacity-100' : 'translate-y-[110%] md:-translate-y-[46%] md:scale-[.97] md:opacity-0'
        }`}
      >
        <div className="relative overflow-hidden rounded-[22px] bg-yacht-900 shadow-[0_40px_100px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] md:grid md:min-h-[520px] md:grid-cols-[1.02fr_1fr] md:rounded-3xl">
          <button
            type="button"
            aria-label="Close"
            onClick={() => close('x')}
            className={`absolute right-2.5 top-2.5 z-[2] grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-yacht-900/55 text-white backdrop-blur-[6px] transition-colors hover:bg-white/15 md:right-3.5 md:top-3.5 md:h-10 md:w-10 ${FOCUS}`}
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
          </button>

          <div aria-hidden="true" className="relative h-[104px] overflow-hidden bg-[#0b2236] md:h-auto max-md:[@media(max-height:640px)]:h-0">
            <img src={PROMO_MEDIA.still} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {withVideo && (
              <video
                ref={videoRef}
                src={PROMO_MEDIA.video}
                poster={PROMO_MEDIA.poster}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 md:hidden" style={{ background: FADE_PHONE }} />
            <div className="absolute inset-0 hidden md:block" style={{ background: FADE_DESKTOP }} />
            <span className="absolute left-3.5 top-3.5 z-[1] inline-flex items-center gap-2 rounded-full bg-yacht-brand px-[11px] py-[7px] text-[10px] font-extrabold uppercase tracking-[0.16em] shadow-[0_8px_22px_rgba(207,69,55,0.45)] md:left-5 md:top-5 md:px-[13px] md:py-2 md:text-[11px] max-md:[@media(max-height:640px)]:hidden">
              <i className="animate-cp-pulse h-[7px] w-[7px] rounded-full bg-white" />
              Limited promo
            </span>
          </div>

          <div className="relative -mt-[22px] flex flex-col justify-center px-[18px] pb-3.5 md:mt-0 md:px-10 md:pb-8 md:pt-10 max-md:[@media(max-height:640px)]:mt-0 max-md:[@media(max-height:640px)]:pt-4">
            <FYILogo className="mb-[22px] hidden h-[30px] w-auto self-start opacity-95 md:block" />
            <p className="hidden items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.3em] text-[#6fe0e4] md:flex">
              <span aria-hidden="true" className="h-0.5 w-6 bg-[#6fe0e4]" />
              105′ Azimut · Miami
            </p>
            <h2 id="cp-title" className="text-[27px] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] md:mt-3 md:text-[44px] max-md:[@media(max-height:640px)]:pr-10">
              Daily Charter{' '}
              {/* Skewed, not italic: the site's italic Montserrat file is a static Thin. */}
              <em className="inline-block origin-bottom-left -skew-x-[11deg] text-[1.12em] not-italic tracking-[-0.02em] text-[#6fe0e4]">Special</em>
            </h2>
            <div id="cp-desc" className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 md:mt-5 md:gap-x-3.5 md:gap-y-2">
              <span className="text-4xl font-extrabold leading-none tracking-[-0.02em] md:text-[56px]">{PROMO_COPY.price}</span>
              <span className="inline-block -rotate-[4deg] rounded-full bg-yacht-brand px-[11px] py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] shadow-[0_8px_22px_rgba(207,69,55,0.45)] md:px-[13px] md:py-[7px] md:text-[13px]">
                For {PROMO_COPY.hours} hours
              </span>
              <span className="w-full text-xs text-white/70 md:text-[13px]">
                Regular <s className="font-semibold text-white/85">{PROMO_COPY.regular}</s> · up to {PROMO_COPY.guests} guests
                <span className="hidden md:inline"> · gratuity included</span>
              </span>
            </div>
            <ul className="mt-[18px] hidden gap-[9px] md:grid">
              {['Captain & crew included', 'Day or sunset cruise', PROMO_COPY.departs].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[13px] font-semibold text-white/[0.92]">
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-yacht-teal">
                    <Check className="h-[11px] w-[11px] text-white" strokeWidth={3.5} aria-hidden="true" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <a
              href={CHARTER_PROMO.href}
              onClick={() => { track('promo_popup_click', { promo: PROMO_ID, page_path: path.current }); close('click'); }}
              className={`mt-3.5 inline-flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-full bg-yacht-brand px-[26px] text-[13px] font-extrabold uppercase tracking-[0.16em] text-white no-underline shadow-[0_10px_30px_rgba(207,69,55,0.4)] transition hover:-translate-y-px hover:bg-yacht-brand-light md:mt-6 md:min-h-14 ${FOCUS}`}
            >
              Book your date <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden="true" />
            </a>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-white/70 md:mt-3.5">
              <span>
                Or call{' '}
                <a href={`tel:${LP_PHONE_TEL}`} className={`font-bold text-white no-underline hover:underline ${FOCUS}`}>{LP_PHONE_DISPLAY}</a>
              </span>
              <button
                type="button"
                onClick={() => close('later')}
                className={`cursor-pointer py-1.5 text-xs font-semibold text-white/70 underline underline-offset-[3px] hover:text-white ${FOCUS}`}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
