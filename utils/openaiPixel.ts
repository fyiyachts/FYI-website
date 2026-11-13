// FYI Yachts' OpenAI (ChatGPT Ads) Measurement Pixel (see config/openaiPixel.ts).
//
// One module owns the pixel, the same way utils/metaPixel.ts owns the Meta
// pixel: the base code, consent, and the lead event. Nothing else on the site
// should call window.oaiq — use trackOpenAiLead() below.
//
// ─── Base code ─────────────────────────────────────────────────────────────
// OpenAI's installation snippet (developers.openai.com/ads/measurement-pixel),
// copied as published; TypeScript type annotations are the only addition. It
// runs from index.tsx, next to initMetaPixel(), in the page's entry script.
//
// ─── Consent ───────────────────────────────────────────────────────────────
// Same rules as the Meta pixel (utils/adConsent.ts). Nothing from OpenAI
// loads before consent: the snippet (and with it the SDK script) runs on the
// first grant, followed by oaiq("consent", true) and oaiq("init", …), the
// order OpenAI documents. A later "no" calls oaiq("consent", false), which
// stops events and removes the pixel's cookies.
//
// Not called as a "pending" state: oaiq("consent", false) deletes the
// pixel's __oppref (ChatGPT ad click) cookie, so revoking on every page load
// and granting a moment later would erase the attribution it exists for.
//
// ─── Events ────────────────────────────────────────────────────────────────
// lead_created only, after a lead form has been accepted by the server —
// fired next to the Meta Lead, with the same event ID.
//
// ─── Where it runs ─────────────────────────────────────────────────────────
// Production builds only, never `vite dev`, and not on localhost / LAN hosts.
// Vercel preview deployments DO run it. VITE_OPENAI_PIXEL_DISABLED=true is the
// off switch.
//
// Debug: add ?oai_debug=1 to any URL to log each event to the console (and
// turn on the SDK's own debug logging) for the rest of the tab session.

import { resolveOpenAiPixelId } from '../config/openaiPixel';
import { decideAdConsent } from './adConsent';

export const OPENAI_PIXEL_ID = resolveOpenAiPixelId(import.meta.env.VITE_OPENAI_PIXEL_ID as string | undefined);

declare global {
  interface Window {
    oaiq?: (...args: unknown[]) => void;
  }
}

let installed = false;
let enabled = false;
let consent: boolean | null = null;
let loaderRan = false;
let initialised = false;

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
    || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.test')
    || /^(10|127)\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host);
}

function shouldRun(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!import.meta.env.PROD) return false;
  if (import.meta.env.VITE_OPENAI_PIXEL_DISABLED === 'true') return false;
  if (isLocalHost(window.location.hostname) && import.meta.env.VITE_OPENAI_PIXEL_ALLOW_LOCAL !== 'true') return false;
  return true;
}

/* ---------------------------------------------------------------- debug */

let debug = false;
function initDebug(): void {
  try {
    if (new URLSearchParams(window.location.search).get('oai_debug') === '1') sessionStorage.setItem('fyi_oai_debug', '1');
    debug = sessionStorage.getItem('fyi_oai_debug') === '1';
  } catch { /* storage unavailable */ }
}
function log(...a: unknown[]): void {
  // eslint-disable-next-line no-console
  if (debug) console.info('[OpenAI Pixel]', ...a);
}

/** Guarded call: a blocked or failed SDK must never break the page or a form. */
function oaiq(...args: unknown[]): void {
  try {
    if (typeof window.oaiq === 'function') window.oaiq(...args);
  } catch { /* noop */ }
}

/* --------------------------------------------------------- base code */

/** OpenAI's installation snippet, as published (types added for TypeScript). */
function runOfficialLoader(): void {
  if (loaderRan) return;
  loaderRan = true;
  /* eslint-disable */
  (function (w: any, d: Document, s: string, u: string) {
    if (w.oaiq) return;
    var q: any = function () {
      q.q.push(arguments);
    };
    q.q = [];
    w.oaiq = q;
    var js = d.createElement(s) as HTMLScriptElement;
    js.async = true;
    js.src = u;
    var f = d.getElementsByTagName(s)[0];
    f.parentNode!.insertBefore(js, f);
  })(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");
  /* eslint-enable */
}

const hasPixelCookies = (): boolean => /(?:^|; )(__oppref|__obref)=/.test(document.cookie);

/** Grant or revoke measurement consent for the pixel. */
export function setOpenAiConsent(granted: boolean): void {
  if (!enabled || granted === consent) return;
  consent = granted;
  log('consent', granted ? 'granted' : 'denied');
  if (granted) {
    runOfficialLoader();
    oaiq('consent', true);
    init();
  } else if (loaderRan || hasPixelCookies()) {
    // Nothing loaded yet but cookies from an earlier visit: load the SDK just
    // to clear them, as OpenAI's consent call does.
    runOfficialLoader();
    oaiq('consent', false);
  }
}

function init(): void {
  if (initialised) return;
  initialised = true;
  oaiq('init', debug ? { pixelId: OPENAI_PIXEL_ID, debug: true } : { pixelId: OPENAI_PIXEL_ID });
  log('init', OPENAI_PIXEL_ID);
}

/** Install the pixel. Call once, from index.tsx, next to initMetaPixel(). */
export function initOpenAiPixel(): void {
  if (installed) return;
  installed = true;
  if (!shouldRun()) return;
  initDebug();
  enabled = true;
  decideAdConsent(setOpenAiConsent, log);
}

/* --------------------------------------------------------------- events */

function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * lead_created — call once, only after a lead form has been accepted by the
 * server, next to the Meta Lead. Pass the same event ID the Meta Lead uses
 * (metaLeadContext().eventId); a new one is made when there is none.
 */
export function trackOpenAiLead(eventId?: string): void {
  if (!enabled || consent !== true || !initialised) return;
  const event_id = eventId || newEventId();
  if (typeof window.oaiq === 'function') {
    try {
      window.oaiq('measure', 'lead_created', { type: 'customer_action' }, { event_id });
      log('lead_created', { event_id });
    } catch { /* the pixel must never break a form */ }
  }
}
