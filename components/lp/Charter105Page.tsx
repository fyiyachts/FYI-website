// /lp/charterspecial — booking page for the 105′ Azimut "Daily Charter
// Special" (Instagram/Meta ad). noindex and kept out of the nav and the
// sitemap (scripts/seoData.ts marks the route noindex; vercel.json adds
// X-Robots-Tag for /lp/*).
//
// This route component is the header + video hero, which the app hydrates
// from the prerendered HTML (index.tsx), so the first paint is never
// replaced. Everything below the hero is its own chunk (Charter105Booking),
// fetched on mount.

import { track } from '../../utils/analytics';
import { usePageMeta } from '../../utils/usePageMeta';
import { C105Shell } from './Charter105Hero';
import { C105_CONTEXT, C105_DESCRIPTION, C105_PATH, C105_TITLE } from './charter105Content';
import { useLazyModule, useNoindex, useScrollWhenReady } from './landingHooks';

const loadBody = () => import('./Charter105Booking');

/** Phone-link clicks, with where on the page they happened. */
const trackPhone = (placement: string) => track('phone_click', { context: C105_CONTEXT, placement, page_path: C105_PATH });

export default function Charter105Page() {
  usePageMeta(C105_TITLE, C105_DESCRIPTION, C105_PATH);
  useNoindex();
  const body = useLazyModule(loadBody);
  const go = useScrollWhenReady(!!body);
  const toBook = () => {
    track('lp_cta_click', { context: C105_CONTEXT });
    go('book');
  };

  return (
    <C105Shell
      onBook={(e) => { e.preventDefault(); toBook(); }}
      onPhoneClick={trackPhone}
      footer={body ? (
        <>
          <body.C105Footer onPhoneClick={trackPhone} />
          <body.C105StickyBar onBook={toBook} />
        </>
      ) : null}
    >
      {body ? <body.default onPhoneClick={trackPhone} /> : null}
    </C105Shell>
  );
}
