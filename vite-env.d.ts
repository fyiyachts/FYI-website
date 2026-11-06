/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA4_ID?: string;
  /** OpenAI Ads pixel — not wired yet (see components/lp/submitLead.ts). */
  readonly VITE_OPENAI_PIXEL_ID?: string;
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
