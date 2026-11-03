// Header + video hero for /lp/charterspecial. Pure markup with no hooks:
// scripts/seoData.ts renders C105Shell to the build-time HTML and the app
// hydrates it (index.tsx, on data-lp-shell), so the H1 — the page's largest
// paint — is painted once, from HTML. The first client render must stay
// identical to the build output.
//
// The hero is a full-bleed horizontal video behind the copy. Phone: the boat
// fills the top ~72svh and fades to navy, the copy sits below/over the fade.
// Desktop: the copy sits on a left-hand navy fade, the boat shows on the right.

import { ArrowRight, Check } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { LP_PHONE_DISPLAY, LP_PHONE_TEL } from './ccContent';
import { LpHeader, LP_WRAP } from './LpChrome';
import {
  C105_CHIPS, C105_DEPARTS_NAME, C105_HOURS, C105_MEDIA, C105_PRICE, C105_REGULAR_PRICE, usd,
} from './charter105Content';

type PhoneClick = (placement: string) => void;

/** The mock-up's brighter teal, for type over the video. */
const TEAL_B = 'text-[#6fe0e4]';
export const C105_PILL =
  'inline-flex min-h-14 items-center justify-center gap-2.5 rounded-full px-7 text-[13px] font-extrabold uppercase tracking-[0.16em] no-underline transition focus-visible:outline-2 focus-visible:outline-offset-[3px]';
export const C105_PILL_RED = `${C105_PILL} bg-yacht-brand text-white shadow-[0_10px_30px_rgba(207,69,55,0.4)] hover:-translate-y-px hover:bg-yacht-brand-light focus-visible:outline-white`;
/** id of the hero CTA row; the mobile sticky bar shows once it has scrolled away. */
export const C105_CTAS_ID = 'c105-ctas';

// Navy fades over the video: bottom-up on a phone, left-to-right on desktop.
const FADE_PHONE =
  'linear-gradient(to top, #0f2740 0%, rgba(15,39,64,.9) 30%, rgba(15,39,64,.55) 52%, rgba(15,39,64,.1) 76%, rgba(15,39,64,.5) 100%)';
const FADE_DESKTOP =
  'linear-gradient(90deg, rgba(15,39,64,.94) 0%, rgba(15,39,64,.78) 34%, rgba(15,39,64,.25) 62%, rgba(15,39,64,0) 80%), linear-gradient(to top, rgba(15,39,64,.55), transparent 28%), linear-gradient(to bottom, rgba(15,39,64,.4), transparent 18%)';

export function Charter105Hero({ onBook, onPhoneClick }: {
  onBook?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onPhoneClick?: PhoneClick;
}) {
  return (
    <section
      aria-labelledby="c105-h1"
      className="relative flex min-h-[max(680px,100svh)] items-end overflow-hidden bg-yacht-900 text-white min-[960px]:min-h-[clamp(640px,92vh,900px)] min-[960px]:items-center"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[min(72svh,600px)] overflow-hidden min-[960px]:inset-0 min-[960px]:h-auto">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={C105_MEDIA.poster}
          className="h-full w-full object-cover"
        >
          <source src={C105_MEDIA.mobile} type="video/mp4" media="(max-width: 959px)" />
          <source src={C105_MEDIA.desktop} type="video/mp4" />
        </video>
        <div className="absolute inset-0 min-[960px]:hidden" style={{ background: FADE_PHONE }} />
        <div className="absolute inset-0 hidden min-[960px]:block" style={{ background: FADE_DESKTOP }} />
      </div>

      <div className={`${LP_WRAP} relative z-[1] pb-12 pt-[34svh] min-[960px]:pb-[88px] min-[960px]:pt-[120px]`}>
        <div className="max-w-[640px] [text-shadow:0_2px_18px_rgba(7,25,45,0.35)]">
          <p className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.32em] ${TEAL_B}`}>
            <span aria-hidden="true" className="h-0.5 w-7 bg-[#6fe0e4]" />
            105′ Azimut · Miami
          </p>
          <h1 id="c105-h1" className="mt-[18px] text-[clamp(44px,8.5vw,84px)] font-extrabold uppercase leading-[0.95] tracking-[-0.01em]">
            Daily Charter{' '}
            {/* Skewed, not italic: the site's italic Montserrat file is a static Thin. */}
            <em className={`inline-block origin-bottom-left -skew-x-[11deg] text-[1.12em] not-italic tracking-[-0.02em] ${TEAL_B}`}>Special</em>
          </h1>

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <span className="text-[clamp(52px,9vw,76px)] font-extrabold leading-none tracking-[-0.02em]">{usd(C105_PRICE)}</span>
            <span className="inline-block -rotate-[4deg] rounded-full bg-yacht-brand px-3.5 py-2 text-sm font-extrabold uppercase tracking-[0.08em] shadow-[0_8px_24px_rgba(207,69,55,0.45)]">
              For {C105_HOURS} hours
            </span>
            <span className="w-full text-sm text-white/70">
              Regular <s className="font-semibold text-white/85">{usd(C105_REGULAR_PRICE)}</s> · gratuity included
            </span>
          </div>

          <ul aria-label="What's included" className="mt-7 grid max-w-[560px] grid-cols-2 gap-2.5">
            {C105_CHIPS.map((c) => (
              <li key={c} className="flex items-center gap-2.5 rounded-xl border border-white/[0.14] bg-yacht-900/35 px-3.5 py-3 text-xs font-bold uppercase tracking-[0.06em] backdrop-blur-[6px]">
                <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-yacht-teal">
                  <Check className="h-3 w-3 text-white" strokeWidth={3.5} aria-hidden="true" />
                </span>
                {c}
              </li>
            ))}
          </ul>

          <div id={C105_CTAS_ID} className="mt-8 flex flex-wrap gap-3">
            <a href="#book" onClick={onBook} className={C105_PILL_RED}>
              Book your date <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden="true" />
            </a>
            <a
              href={`tel:${LP_PHONE_TEL}`}
              onClick={onPhoneClick ? () => onPhoneClick('hero') : undefined}
              className={`${C105_PILL} border border-white/50 text-white hover:bg-white/10 focus-visible:outline-white`}
            >
              Call {LP_PHONE_DISPLAY}
            </a>
          </div>
          <p className="mt-[18px] text-xs text-white/65">
            Departs {C105_DEPARTS_NAME}, Downtown Miami · Captain &amp; crew included
          </p>
        </div>
      </div>

      <div className="absolute bottom-8 right-6 z-[1] hidden rounded-[14px] border border-white/25 bg-white/[0.12] px-4 py-3 text-xs font-bold leading-[1.35] backdrop-blur-[10px] min-[960px]:block">
        <b className={`block text-[11px] uppercase tracking-[0.2em] ${TEAL_B}`}>Limited promo</b>
        Book before dates fill up
      </div>
    </section>
  );
}

/** The page frame. Rendered with no children it is also the build-time first paint. */
export function C105Shell({ onBook, onPhoneClick, children, footer }: {
  onBook?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onPhoneClick?: PhoneClick;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div data-lp-shell="" className="min-h-screen bg-white font-sans text-yacht-800 antialiased">
      <LpHeader overlay onPhoneClick={onPhoneClick} />
      <main>
        <Charter105Hero onBook={onBook} onPhoneClick={onPhoneClick} />
        {children}
      </main>
      {footer}
    </div>
  );
}
