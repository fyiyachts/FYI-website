import { useEffect, useRef } from 'react';
import { mountScrollWorld, type ScrollWorldConfig } from './scrub-engine';
import './scroll-world-fyi.css';

/**
 * SellScrollHero — the scroll-scrubbed cinematic atop /sell, ported from the
 * Alex G. Clarke homepage's scroll-world engine. Like the AGC hero, each scene
 * scrubs a video clip as you scroll (assets under public/sell-scroll/); a still
 * per scene remains the no-JS / reduced-motion / data-saver fallback.
 *
 * ALL FOUR SCENES ARE REAL FOOTAGE (2026-08-21). They used to be the 2026
 * Posillipo Technema 90 listing stills animated with Higgsfield — the client
 * wanted the yacht MOVING, and rejected the generated version as reading
 * obviously AI. The scenes are now straight cuts from a Majesty 112 Terrace
 * film by Gulf Craft, whose Majesty line FYI's superyacht division represents
 * (see BRAND_PAGES `majesty-yachts-for-sale`).
 *
 * SOURCING — READ BEFORE SHIPPING: that film is the BUILDER's marketing, not
 * FYI's own footage, and the sourcing rule in video/src/clips.ts bars builder
 * reels by default. Confirm written permission from Majesty Yachts USA / Gulf
 * Craft, or swap in footage FYI shot.
 *
 * The film is shot off Dubai, so the four cuts deliberately avoid every frame
 * where the Dubai skyline and Ain Dubai are identifiable — these backgrounds
 * are hazy horizon only, which reads as any warm-water port.
 *
 * Each scene's stills-mode artwork is local too (`<id>-still.webp`), extracted
 * from its own clip, so reduced-motion and data-saver visitors see the same
 * vessel instead of the old Capri listing photos.
 *
 * PIPELINE (regenerate the same way): the source cuts run ~1.3s each, so each is
 * trimmed inside its shot boundaries, downscaled from the 4K master, then
 * motion-interpolated up to ~5s at 24fps (`minterpolate=mi_mode=mci:
 * mc_mode=aobmc:vsbmc=1`). Left at native length a cut gives the scrubber only
 * ~30 frames to seek through, which steps visibly. Mobile is a native 9:16 crop
 * taken from the 4K master before the downscale, offset picked per shot.
 *
 * The container stays React-empty: the engine owns its DOM imperatively, and a
 * hidden `data-sw-seo` block carries the copy for crawlers/no-JS. It uses h2s
 * only — the page's h1 stays with PageHero below the hand-off.
 */

// The brand page the cinematic's vessel belongs to — the Majesty range FYI's
// superyacht division represents.
const MAJESTY = '/majesty-yachts-for-sale';

// Scroll-scrubbed clips, encoded per the engine's recipe: crf~20, +faststart, no
// audio, -g 8 desktop / -g 4 mobile. `<id>-poster*.webp` are the encoded clips'
// first frames; `<id>-still.webp` is the stills-mode artwork. See the header for
// the cut list and the retime recipe.
const VID = '/sell-scroll';
const clip = (n: string) => ({
  still: `${VID}/${n}-still.webp`,
  poster: `${VID}/${n}-poster.webp`,
  posterMobile: `${VID}/${n}-poster-m.webp`,
  clip: `${VID}/vid/${n}.mp4`,
  clipMobile: `${VID}/vid/${n}-m.mp4`,
});

const CONFIG: ScrollWorldConfig = {
  hint: 'scroll to see how we sell',
  nav: false,          // the FYI HomeNav overlays the hero (no engine chrome)
  embed: true,         // hand off to the normal sell page below at the end
  showNum: false,      // no "01 / 04" slide counter on the scenes (client, 2026-08-13)
  parkFade: false,     // HOLD the cinematic at full opacity and let the page content
                       // that follows cover it — a clean cut instead of a dissolve,
                       // so the body section is never seen at partial opacity
                       // (client, 2026-08-13: "full opacity before it appears")
  diveScroll: 1.15,    // less scroll distance per scene than the original 1.35 (client:
                       // "little less scroll to do")
  crossfade: 0.16,     // reverted to the original width (client, 2026-08-13: the
                       // widened 0.22 + a softer scrub lerp made the scroll feel
                       // laggier, not smoother — the scrub lerp is back to its
                       // original 0.18 too, see scrub-engine.js)
  sections: [
    {
      id: 'stage', label: 'Sell With FYI',
      ...clip('stage'),   // low aerial down the port side to the bow, underway
      accent: '#4CBBC2', scroll: 1.3, linger: 0.42,
      eyebrow: 'Sell With FYI',
      title: 'Your yacht deserves this stage.',
      body: 'Every vessel FYI represents gets the flagship treatment — cinematic photography, editorial copy, and a listing built to stop a qualified buyer mid-scroll.',
    },
    {
      id: 'presentation', label: 'The Proof',
      ...clip('presentation'),   // close aft-quarter pass, full wake
      accent: '#4CBBC2', scroll: 1.25, linger: 0.4,
      eyebrow: 'How We Do It',
      title: 'This is how we present a yacht.',
      // This used to read "everything on your screen is a live FYI listing" —
      // true of the Posillipo stills, false of the Majesty 112 footage that
      // replaced them. Reworded so the page never claims the vessel on screen is
      // a vessel FYI has listed.
      body: 'On screen: a Majesty 112, from the superyacht range our team represents. Whatever you own gets presented at this level — shot, written, and staged so the first impression does the selling.',
      // Single secondary-style (outlined) button per the client — opens in a new
      // tab so the cinematic isn't lost mid-scroll.
      cta: {
        secondary: { label: 'See The Majesty Range', href: MAJESTY, blank: true },
      },
    },
    {
      id: 'reach', label: 'Worldwide Reach',
      ...clip('reach'),   // high aerial over the sun deck, running
      accent: '#4CBBC2', scroll: 1.25, linger: 0.4,
      eyebrow: 'Seen Everywhere',
      title: 'Marketing that moves vessels.',
      body: 'Syndication across the major brokerage networks, our own channels reaching 50,000+ people a day, and direct outreach to a worldwide buyer list — screened so sea trials happen only with serious parties.',
      cta: { primary: { label: 'Meet Your Consultant', href: '/our-team' } },
    },
    {
      id: 'start', label: 'Start Today',
      ...clip('start'),   // bow quarter against the horizon
      accent: '#4CBBC2', scroll: 1.45, linger: 0.5,
      eyebrow: 'Your Next Chapter',
      title: 'List with FYI. Sell faster, closer to asking.',
      body: 'A free valuation from three decades of Miami closings — then photography, marketing, negotiation, escrow, and documentation handled end to end.',
      cta: {
        primary: { label: 'Get A Free Valuation', href: '#valuation' },
      },
    },
  ],
  connectors: [null, null, null],   // crossfade dissolves between the four scenes
};

function buildSeoHtml(cfg: ScrollWorldConfig): string {
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const beats = cfg.sections
    .map((sec) => `<h2>${esc(sec.eyebrow ?? '')} — ${esc(sec.title ?? '')}</h2>${sec.body ? `<p>${esc(sec.body)}</p>` : ''}`)
    .join('');
  const links = cfg.sections
    .flatMap((sec) => (sec.cta ? [sec.cta.primary, sec.cta.secondary] : []))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => `<a href="${b.href}">${esc(b.label)}</a>`)
    .join(' · ');
  return `<section data-sw-seo>${beats}${links ? `<p>${links}</p>` : ''}</section>`;
}

export function SellScrollHero() {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const container = ref.current;
    if (!container || mounted.current) return;
    mounted.current = true;
    container.insertAdjacentHTML('afterbegin', buildSeoHtml(CONFIG));
    mountScrollWorld(container, CONFIG);
    return () => {
      try { container.innerHTML = ''; } catch { /* noop */ }
      mounted.current = false;
    };
  }, []);

  // React-empty on purpose — the engine populates it. Min-height reserves layout
  // before the engine's scroll track is measured (avoids a first-paint jump).
  return <div ref={ref} className="sw-mount" style={{ minHeight: '100vh' }} />;
}
