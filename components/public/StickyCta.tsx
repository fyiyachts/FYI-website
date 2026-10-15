import { Phone } from 'lucide-react';
import { track } from '../../utils/analytics';
import { RESPONSE_PROMISE_SHORT } from './responsePromise';
import { useStickyCtaFlag } from './useStickyCtaFlag';

/**
 * Site-wide sticky mobile CTA.
 *
 * `StickyMobileCta` in components/listing/ListingExtras.tsx already does this
 * for listing and charter-vessel pages, but it leads with an asking price —
 * which only exists on a single-vessel page. Every other public template (the
 * inventory categories, the 37 brand pages, sell, financing, about, charter,
 * case studies) had no persistent mobile call-to-action at all, so a phone
 * visitor scrolling a long brand page had nothing to tap.
 *
 * Mobile only (`lg:hidden`) — the desktop layouts carry their own inline and
 * sidebar CTAs. `pb-[env(safe-area-inset-bottom)]` keeps the bar clear of the
 * iOS home indicator.
 */

const PHONE = '+13058546020';
const PHONE_DISPLAY = '305-854-6020';

export function StickyCta({
  context,
  /** In-page anchor for the inquiry form, when the page has one. */
  inquireHref = '#inquire',
  label = 'Inquire',
}: {
  context: string;
  inquireHref?: string;
  label?: string;
}) {
  // Lifts the Brianna launcher clear of this bar (see useStickyCtaFlag).
  useStickyCtaFlag();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-white/10 bg-yacht-900/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-light tracking-wide text-white">Talk to a Miami broker</p>
        <p className="truncate text-[10px] font-light text-white/50">{RESPONSE_PROMISE_SHORT}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <a
          href={`tel:${PHONE}`}
          onClick={() => track('phone_click', { context, placement: 'sticky' })}
          aria-label={`Call ${PHONE_DISPLAY}`}
          className="flex h-11 w-11 items-center justify-center border border-white/20 text-white transition-colors hover:border-yacht-brand hover:text-yacht-brand"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
        </a>
        <a
          href={inquireHref}
          onClick={() => track('inquire_scroll', { context, placement: 'sticky' })}
          className="bg-yacht-brand px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-yacht-brand-light"
        >
          {label}
        </a>
      </div>
    </div>
  );
}
