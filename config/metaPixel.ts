// FYI Yachts' own Meta pixel — "FYI Pixel", owned by the FYI Yachts Business
// Manager (255548808242738) and connected to FYI's ad account.
//
// The one place the ID lives. utils/metaPixel.ts (the browser pixel) and
// vite.config.ts (the <noscript> fallback in index.html) both read it from
// here. Setting VITE_META_PIXEL_ID on the Vercel project overrides it, the
// same way VITE_GA4_ID overrides the GA4 ID: a pixel ID is public by design
// (it ships in every page's HTML), and a committed default means the pixel
// can't go silently dark because nobody set an env var.
//
// Not this ID: 1462531488524638 is the former partner's (Yachting Advisors)
// pixel. It reaches the site through HubSpot's ads tracking, not this code.
export const META_PIXEL_ID_DEFAULT = '406079389829524';

/** Resolve the pixel ID from an env value, falling back to the default. */
export function resolveMetaPixelId(envValue: string | undefined): string {
  const v = (envValue || '').trim();
  return /^\d{10,20}$/.test(v) ? v : META_PIXEL_ID_DEFAULT;
}
