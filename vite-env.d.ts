/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA4_ID?: string;
  /** OpenAI (ChatGPT Ads) pixel ID override; defaults to config/openaiPixel.ts. */
  readonly VITE_OPENAI_PIXEL_ID?: string;
  /** 'true' switches the OpenAI pixel off everywhere. */
  readonly VITE_OPENAI_PIXEL_DISABLED?: string;
  /** 'true' lets a local production build (vite preview) run the OpenAI pixel — testing only. */
  readonly VITE_OPENAI_PIXEL_ALLOW_LOCAL?: string;
  /** Meta pixel ID override; defaults to FYI Pixel (config/metaPixel.ts). */
  readonly VITE_META_PIXEL_ID?: string;
  /** 'true' switches the Meta pixel off everywhere. */
  readonly VITE_META_PIXEL_DISABLED?: string;
  /** 'true' lets a local production build (vite preview) run the pixel — testing only. */
  readonly VITE_META_PIXEL_ALLOW_LOCAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
