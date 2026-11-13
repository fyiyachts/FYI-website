// FYI Yachts' OpenAI (ChatGPT Ads) Measurement Pixel.
//
// The one place the ID lives; utils/openaiPixel.ts reads it from here.
// Setting VITE_OPENAI_PIXEL_ID on the Vercel project overrides it, the same
// way VITE_META_PIXEL_ID overrides the Meta pixel: a pixel ID is public by
// design (it ships to every browser), and a committed default means the pixel
// can't go silently dark because nobody set an env var.
//
// Browser pixel only. No OpenAI API key or Conversions API key belongs in
// front-end code — those stay server-side.
export const OPENAI_PIXEL_ID_DEFAULT = '9e1MMBk2xyXezuPZazp8ck';

/** Resolve the pixel ID from an env value, falling back to the default. */
export function resolveOpenAiPixelId(envValue: string | undefined): string {
  const v = (envValue || '').trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : OPENAI_PIXEL_ID_DEFAULT;
}
