/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA4_ID?: string;
  /** HubSpot form "ChatGPT Ads – Center Console" (portal 3826631). */
  readonly VITE_HUBSPOT_CC_FORM_GUID?: string;
  /** OpenAI Ads pixel — not wired yet (see components/lp/submitLead.ts). */
  readonly VITE_OPENAI_PIXEL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
