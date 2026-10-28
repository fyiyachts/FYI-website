/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA4_ID?: string;
  /** OpenAI Ads pixel — not wired yet (see components/lp/submitLead.ts). */
  readonly VITE_OPENAI_PIXEL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
