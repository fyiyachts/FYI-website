// Vercel Image Optimization helpers.
//
// The optimizer (/_vercel/image) used to return 502
// OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED for every host: the
// remotePatterns list in vercel.json contained "**.boatsgroup.com", which the
// image service rejects as a hostname pattern and then refuses the whole
// allowlist. With that entry removed (and imt.boatwizard.com — the second
// host the boats feed actually serves photos from — added), optimization is
// on by default; VITE_IMG_OPT=0 is the kill switch back to raw origin URLs.
// The optimizer serves ONLY the widths listed in vercel.json's images.sizes.
// Ask for any other width and it answers 400 INVALID_IMAGE_OPTIMIZE_REQUEST —
// which reaches the browser as a broken <img>, not as a fallback to the
// original, so the picture simply does not appear. That is what took out the
// charter cards, the vessel-page gallery (hero at 2000w, thumbnails at 400w)
// and the homepage charter rail: each asked for a width nobody had added to
// the list, and every one of them 400'd.
//
// Reading the list from vercel.json rather than repeating it here keeps the
// two in step by construction — the same reason prerender.mjs reads the
// redirect list instead of hard-coding /es.
import { images } from '../vercel.json';

const ALLOWED_WIDTHS: number[] = [...images.sizes].sort((a, b) => a - b);

/**
 * The hosts the optimizer will actually fetch. Ask it for anything else and it
 * answers 400 INVALID_IMAGE_OPTIMIZE_REQUEST, which reaches the browser as a
 * broken <img> — the same failure mode as an unlisted width. Read from
 * vercel.json for the same reason the widths are: one list, no drift.
 */
const ALLOWED_HOSTS: string[] = images.remotePatterns.map((p) => p.hostname);

function isOptimizable(host: string): boolean {
  return ALLOWED_HOSTS.some((pattern) =>
    pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern,
  );
}

/**
 * The smallest allowed width that still covers `w`, so an image is never
 * scaled up and never 400s — the largest allowed width if `w` exceeds them
 * all. Rounding up rather than down keeps the request sharp on the layout it
 * was sized for: a card that wanted 800px gets 828, not 640.
 */
function snapWidth(w: number): number {
  return ALLOWED_WIDTHS.find((allowed) => allowed >= w) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
}

const PROD = import.meta.env.PROD;
const IMG_OPT = PROD && import.meta.env.VITE_IMG_OPT !== '0';

// The boats-feed photo hosts refuse the optimizer's fetches (see api/img.ts),
// so their URLs route through our own /api/img proxy — on the canonical host,
// because the optimizer's allowlist carries fyiyachts.com, not preview
// domains. Until the proxy is live in production, preview deploys fall back
// to raw URLs for these two hosts only.
const PROXIED_HOSTS = new Set(['images.boatsgroup.com', 'imt.boatwizard.com']);
const SITE = 'https://fyiyachts.com';

/**
 * The URL to hand the optimizer, or null when there isn't one it can fetch.
 * Callers fall back to the raw origin URL in that case: an unoptimized photo
 * is a photo; an optimizer 400 is a blank card. That is what took out every
 * YATCO and Yachtr card on the worldwide grid (found live 2026-09-04) — the
 * feed serves those from s3.amazonaws.com and cdn.yachtbroker.org, neither of
 * which was on the allowlist, so a fifth of the results rendered as alt text.
 */
function fetchableSrc(src: string): string | null {
  try {
    const h = new URL(src).hostname;
    if (PROXIED_HOSTS.has(h)) return `${SITE}/api/img?u=${encodeURIComponent(src)}`;
    return isOptimizable(h) ? src : null;
  } catch {
    return null; // not a URL the optimizer can be asked about
  }
}

export function optImg(src: string | undefined, width: number, quality = 72): string {
  if (!src || !src.startsWith('http')) return src ?? '';
  if (!IMG_OPT) return src;
  const fetchable = fetchableSrc(src);
  if (!fetchable) return src;
  return `/_vercel/image?url=${encodeURIComponent(fetchable)}&w=${snapWidth(width)}&q=${quality}`;
}

export function srcSet(src: string | undefined, widths: number[], quality = 72): string | undefined {
  if (!src || !src.startsWith('http') || !IMG_OPT) return undefined;
  // No optimizer URL means optImg is returning the raw src at every width — a
  // srcSet of identical URLs under different descriptors just misleads the
  // browser's picking, so let the plain src stand alone.
  if (!fetchableSrc(src)) return undefined;
  // Snap before de-duplicating: two requested widths can land on the same
  // allowed one (900 and 1000 both become 1080), and a srcSet carrying the
  // same URL under two descriptors just misleads the browser's picking.
  const snapped = [...new Set(widths.map(snapWidth))].sort((a, b) => a - b);
  return snapped.map((w) => `${optImg(src, w, quality)} ${w}w`).join(', ');
}
