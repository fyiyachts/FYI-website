// Types for the portable scroll-scrubbed camera-flight engine (scrub-engine.js),
// ported from the Alex G. Clarke site (alexgclarke web/src/lib/scrollWorld).
export interface ScrollWorldCta {
  label: string;
  href: string;
  /** Open the link in a new tab (target="_blank" rel="noopener noreferrer"). */
  blank?: boolean;
}

export interface ScrollWorldSection {
  id: string;
  label: string;
  still: string;          // stills-mode / no-clip artwork (required)
  poster?: string;        // first frame of the encoded clip, when a clip exists
  posterMobile?: string;
  clip?: string;          // optional — without it the scene is a still that cross-dissolves
  clipMobile?: string;
  accent?: string;
  scroll?: number;        // per-section scroll-length override (viewport-heights)
  linger?: number;        // 0..1 — settle the camera mid-scene
  eyebrow?: string;
  title?: string;
  body?: string;
  tags?: string[];
  cta?: { primary?: ScrollWorldCta; secondary?: ScrollWorldCta };
}

export interface ScrollWorldConfig {
  brand?: { name: string; href: string };
  hint?: string;
  nav?: boolean;
  embed?: boolean;        // hand off to the normal page below at the end
  parkFade?: boolean;
  showNum?: boolean;      // show the "01 / 04" slide counter on each scene (default true)
  atmosphere?: boolean;
  diveScroll?: number;
  connScroll?: number;
  crossfade?: number;
  scrollMobileFactor?: number;
  sections: ScrollWorldSection[];
  connectors?: (string | null)[];
  connectorsMobile?: (string | null)[];
}

export function mountScrollWorld(container: HTMLElement, config: ScrollWorldConfig): void;
