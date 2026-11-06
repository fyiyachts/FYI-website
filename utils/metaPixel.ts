// FYI Yachts' Meta pixel (FYI Pixel, see config/metaPixel.ts).
//
// One module owns the pixel: the base code, consent, and every event. Nothing
// else on the site should call window.fbq for FYI's pixel — use the helpers
// below so each event goes out once, to the right pixel, with an eventID.
//
// ─── Why this is not the stock Meta snippet ────────────────────────────────
// The site already carries a second, unrelated pixel: the former partner's
// (Yachting Advisors, 1462531488524638), injected by HubSpot's ads tracking
// (js.hsadspixel.net/pixels.js, HubSpot portal 3826631). HubSpot reuses
// whatever window.fbq it finds and calls fbq('track', 'PageView') — and a
// plain 'track' goes to EVERY pixel initialised on the page. Tested on the
// live site (2026-11-06): with the stock snippet, FYI's pixel received a
// second PageView on every page load, and the reverse also holds — a plain
// fbq('track', 'Lead') from us would send FYI's leads (with the visitor's
// hashed email/phone) to the old partner's pixel. So:
//   • FYI's events always use trackSingle(FYI_PIXEL_ID, …).
//   • The fbq stub below rewrites anyone else's plain 'track'/'trackCustom'
//     into trackSingle for the OTHER pixels only, so HubSpot's calls never
//     reach FYI's pixel. HubSpot's pixel itself keeps working as before.
//   • fbevents' automatic PageView on history changes is turned off
//     (disablePushState) because we send our own, with an eventID, on every
//     route change. To leave the other pixel exactly as it was, those
//     route-change PageViews are mirrored to it (see trackMetaPageView).
//
// ─── Consent ───────────────────────────────────────────────────────────────
// The pixel starts with consent revoked; fbevents holds queued events and
// sends them once consent is granted. fbevents.js itself loads on the first
// grant. Who gets granted (decideConsent below):
//   1. A choice the visitor already made in HubSpot's cookie banner (its
//      __hs_opt_out / __hs_cookie_cat_pref cookies, "advertisement" = 2) wins.
//   2. Outside the EU/EEA, UK, Switzerland and Turkey (visitor's country from
//      Vercel's IP geolocation, /api/geo): granted by default. No banner is
//      shown there, so there is nothing to wait for.
//   3. Inside those regions: wait for HubSpot's addPrivacyConsentListener
//      ("advertisement"). If no HubSpot banner appears within a few seconds
//      and HubSpot hasn't answered, the banner is off: granted.
// HubSpot's listener is still followed whenever it answers, but a "no" only
// counts in the regions above or as a stored choice: with no banner shown,
// nobody declined anything. (The first version waited for that listener
// alone; with no banner configured it never fired, and the pixel sent
// nothing — found 2026-11-06.) setMetaConsent() is exported for a
// site-built banner, should one replace HubSpot's.
//
// ─── Where it runs ─────────────────────────────────────────────────────────
// Production builds only, never `vite dev`, and not on localhost / LAN
// hosts (a local `vite preview` included). Vercel preview deployments DO run
// it — that is how changes are checked in Events Manager → Test events before
// they go live. VITE_META_PIXEL_DISABLED=true is the off switch.
//
// Debug: add ?meta_debug=1 to any URL to log each event to the console for
// the rest of the tab session.

import { resolveMetaPixelId } from '../config/metaPixel';

export const META_PIXEL_ID = resolveMetaPixelId(import.meta.env.VITE_META_PIXEL_ID as string | undefined);

type FbqArgs = unknown[];
export interface Fbq {
  (...args: FbqArgs): void;
  callMethod?: (...args: FbqArgs) => void;
  queue: FbqArgs[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  getState?: () => { pixels: { id: string }[] };
}

interface HubspotConsent {
  allowed?: boolean;
  categories?: { advertisement?: boolean };
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    _hsp?: unknown[];
  }
}

const FBEVENTS_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

let installed = false;
let enabled = false;
let consentGranted = false;
let scriptRequested = false;
/** Every pixel ID anyone (us or HubSpot) has initialised on this page. */
const initialisedPixels = new Set<string>();

function fbq(...args: FbqArgs): void {
  try { window.fbq?.(...args); } catch { /* the pixel must never break the page */ }
}

const otherPixels = (): string[] => [...initialisedPixels].filter((id) => id !== META_PIXEL_ID);

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
    || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.test')
    || /^(10|127)\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host);
}

function shouldRun(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!import.meta.env.PROD) return false;
  if (import.meta.env.VITE_META_PIXEL_DISABLED === 'true') return false;
  if (isLocalHost(window.location.hostname) && import.meta.env.VITE_META_PIXEL_ALLOW_LOCAL !== 'true') return false;
  return true;
}

/* ---------------------------------------------------------------- debug */

let debug = false;
function initDebug(): void {
  try {
    if (new URLSearchParams(window.location.search).get('meta_debug') === '1') sessionStorage.setItem('fyi_meta_debug', '1');
    debug = sessionStorage.getItem('fyi_meta_debug') === '1';
  } catch { /* storage unavailable */ }
}
function log(...a: unknown[]): void {
  // eslint-disable-next-line no-console
  if (debug) console.info('[FYI Pixel]', ...a);
}

/* --------------------------------------------------------- base code */

/**
 * Meta's base-code stub, with one change: plain 'track'/'trackCustom' calls
 * (HubSpot's) are rewritten to trackSingle for every pixel except FYI's.
 * Calls are queued until fbevents.js loads, exactly like the stock stub.
 */
function installStub(): void {
  const route = (args: FbqArgs): FbqArgs[] => {
    const [cmd, id] = args;
    if (cmd === 'init' && typeof id === 'string') initialisedPixels.add(id);
    if (cmd === 'track' || cmd === 'trackCustom') {
      const single = cmd === 'track' ? 'trackSingle' : 'trackSingleCustom';
      return otherPixels().map((pid) => [single, pid, ...args.slice(1)]);
    }
    return [args];
  };
  const n = function (...args: FbqArgs) {
    for (const call of route(args)) {
      if (n.callMethod) n.callMethod.apply(n, call);
      else n.queue.push(call);
    }
  } as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  // We send our own PageView on each route change (with an eventID); stop
  // fbevents from adding a second one on every history.pushState.
  n.disablePushState = true;
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
}

function loadScript(): void {
  if (scriptRequested) return;
  scriptRequested = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = FBEVENTS_SRC;
  document.head.appendChild(s);
}

/** Grant or revoke marketing consent for the pixel. */
export function setMetaConsent(granted: boolean): void {
  if (!enabled || granted === consentGranted) return;
  consentGranted = granted;
  fbq('consent', granted ? 'grant' : 'revoke');
  log('consent', granted ? 'granted' : 'revoked');
  if (granted) loadScript();
}

/**
 * Install the pixel. Call once, before HubSpot's tracking code is injected
 * (index.tsx), so HubSpot finds this stub instead of creating its own.
 */
export function initMetaPixel(): void {
  if (installed) return;
  installed = true;
  if (!shouldRun()) return;
  initDebug();
  if (window.fbq) {
    // Something loaded a pixel first. FYI's events are still isolated (they
    // all use trackSingle), but another script's plain 'track' calls would
    // reach FYI's pixel too — worth knowing when reading Events Manager.
    console.warn('[FYI Pixel] window.fbq already existed; FYI events are trackSingle-scoped.');
  } else {
    installStub();
  }
  enabled = true;
  fbq('consent', 'revoke');
  fbq('init', META_PIXEL_ID);
  if (window.fbq && !initialisedPixels.size) initialisedPixels.add(META_PIXEL_ID);

  decideConsent();

  document.addEventListener('click', onContactClick, true);
}

/* -------------------------------------------------------------- consent */

/** Where a cookie banner is (or may be) shown: EU/EEA, UK, Switzerland, Turkey. */
const CONSENT_REGION = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // EU
  'IS', 'LI', 'NO', // EEA
  'GB', 'CH', 'TR',
]);
/** How long a consent-region visitor waits for HubSpot's banner before it counts as off. */
const BANNER_WAIT_MS = 4000;

/** The visitor's stored HubSpot cookie choice for advertising; null when they never made one. */
function storedHubspotChoice(): boolean | null {
  if (readCookie('__hs_opt_out') === 'yes') return false;
  const pref = readCookie('__hs_cookie_cat_pref'); // e.g. "1:true,2:false,3:true"
  const ad = pref ? /(?:^|[,_])2:(true|false)/.exec(pref) : null;
  if (ad) return ad[1] === 'true';
  if (readCookie('__hs_opt_out') === 'no') return true;
  return null;
}

const hubspotBannerShown = (): boolean => !!document.getElementById('hs-eu-cookie-confirmation');

function decideConsent(): void {
  let consentRegion: boolean | null = null; // null until the country is known
  let hubspotAnswered = false;

  // HubSpot's cookie-consent API, whenever it answers.
  window._hsp = window._hsp || [];
  window._hsp.push(['addPrivacyConsentListener', (c: HubspotConsent) => {
    const granted = Boolean(c?.categories ? c.categories.advertisement : c?.allowed);
    hubspotAnswered = true;
    log('HubSpot consent', granted);
    // A "no" without a banner isn't anyone's choice: only follow it in the
    // consent regions or when the visitor stored one.
    if (granted || consentRegion === true || storedHubspotChoice() === false) setMetaConsent(granted);
  }]);

  const stored = storedHubspotChoice();
  if (stored !== null) { setMetaConsent(stored); return; }

  void visitorCountry().then((country) => {
    consentRegion = !!country && CONSENT_REGION.has(country.toUpperCase());
    if (!consentRegion) { setMetaConsent(true); return; } // no banner outside these regions
    window.setTimeout(() => {
      // Banner off (nothing shown, HubSpot silent): nothing to wait for.
      if (!hubspotAnswered && !hubspotBannerShown()) setMetaConsent(true);
    }, BANNER_WAIT_MS);
  });
}

/* --------------------------------------------------------------- events */

export function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

type StandardEvent = 'PageView' | 'ViewContent' | 'Lead' | 'Contact' | 'Search';

function send(event: StandardEvent, params: Record<string, unknown>, eventID: string): string {
  if (!enabled) return eventID;
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
  fbq('trackSingle', META_PIXEL_ID, event, clean, { eventID });
  log(event, clean, { eventID });
  return eventID;
}

/** The DocumentID when the current page is a /listing/<id> page. */
export function listingIdFromPath(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): string | undefined {
  const m = /^\/listing\/([^/?#]+)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/* PageView — first load and every client-side route change. */

let lastPageViewPath = '';
let pageViewSeq = 0;

export function trackMetaPageView(pathname: string): void {
  if (!enabled || pathname === lastPageViewPath) return;
  const firstPage = lastPageViewPath === '';
  lastPageViewPath = pathname;
  pageViewSeq++;
  lastSearch = '';
  send('PageView', {}, newEventId());
  // The other pixel (HubSpot's) sends its own PageView on the first load. On
  // in-app navigations it used to get one from fbevents' history tracking,
  // which disablePushState turns off — so hand it the same PageView, to leave
  // that pixel's data exactly as it was.
  if (!firstPage) for (const id of otherPixels()) fbq('trackSingle', id, 'PageView');
}

/* ViewContent — listing detail pages. Never the price. */

let lastViewContent = '';

export function trackMetaViewContent(listing: { id: string; year?: number | string; make?: string; model?: string; title?: string }): void {
  if (!enabled || !listing.id) return;
  const key = `${pageViewSeq}:${listing.id}`;
  if (key === lastViewContent) return;
  lastViewContent = key;
  const name = [listing.year, listing.make, listing.model].filter(Boolean).join(' ').trim() || listing.title || undefined;
  send('ViewContent', { content_ids: [String(listing.id)], content_type: 'product', content_name: name }, newEventId());
}

/* Search — inventory search / filters, once the visitor stops typing. */

let lastSearch = '';
let searchTimer: number | undefined;

export function trackMetaSearch(searchString: string, delayMs = 1500): void {
  if (!enabled) return;
  window.clearTimeout(searchTimer);
  const s = searchString.trim();
  if (!s) return;
  searchTimer = window.setTimeout(() => {
    if (s === lastSearch) return;
    lastSearch = s;
    send('Search', { search_string: s.slice(0, 200) }, newEventId());
  }, delayMs);
}

/* Contact — WhatsApp, tel: and mailto: link clicks, anywhere on the site. */

let lastContact = { href: '', at: 0 };

function contactMethod(href: string): 'WhatsApp' | 'Phone' | 'Email' | null {
  const h = href.trim().toLowerCase();
  if (h.startsWith('tel:')) return 'Phone';
  if (h.startsWith('mailto:')) return 'Email';
  if (h.startsWith('whatsapp:') || /^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|(www\.)?whatsapp\.com\/send)/.test(h)) return 'WhatsApp';
  return null;
}

function onContactClick(e: MouseEvent): void {
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href') || '';
  const method = contactMethod(href);
  if (!method) return;
  const now = Date.now();
  if (href === lastContact.href && now - lastContact.at < 1000) return; // double tap
  lastContact = { href, at: now };
  const id = listingIdFromPath();
  send('Contact', { content_name: method, content_category: window.location.pathname, ...(id ? { content_ids: [id], content_type: 'product' } : {}) }, newEventId());
}

/* Lead — only after a lead form has been accepted by the server. */

/**
 * The browser IDs a future Conversions API call needs to match and
 * de-duplicate this lead. Sent along with the lead (the `meta` field of the
 * form POST); the server ignores it until CAPI is wired up.
 */
export interface MetaLeadContext { eventId: string; fbp?: string; fbc?: string }

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Call when a lead form is submitted (before the POST). */
export function metaLeadContext(): MetaLeadContext {
  // Look the country up while the form posts, so the Lead can go out the
  // moment the server accepts it — before any redirect to /thank-you.
  if (enabled) void visitorCountry();
  return { eventId: newEventId(), fbp: readCookie('_fbp'), fbc: readCookie('_fbc') };
}

export interface MetaLeadUser {
  email?: string;
  phone?: string;
  /** A single "Name" field: split into first / last here. */
  fullName?: string;
  firstName?: string;
  lastName?: string;
  /** ISO 3166-1 alpha-2. When absent, the visitor's IP country (Vercel). */
  country?: string;
}

let countryPromise: Promise<string | undefined> | null = null;
let countryDone = false;
let countryValue: string | undefined;
/** Visitor's country from Vercel's IP geolocation (/api/geo); undefined on any failure. */
function visitorCountry(): Promise<string | undefined> {
  if (!countryPromise) {
    countryPromise = (async () => {
      try {
        const ctl = new AbortController();
        const t = window.setTimeout(() => ctl.abort(), 1200);
        const r = await fetch('/api/geo', { signal: ctl.signal, credentials: 'omit' });
        window.clearTimeout(t);
        const d = await r.json();
        countryValue = typeof d?.country === 'string' && /^[A-Za-z]{2}$/.test(d.country) ? d.country.toLowerCase() : undefined;
      } catch { countryValue = undefined; }
      countryDone = true;
      return countryValue;
    })();
  }
  return countryPromise;
}

/** Digits with country code, as Meta expects. A bare 10-digit number is North American (+1). */
function normalizePhone(raw: string | undefined, country: string | undefined): string | undefined {
  if (!raw) return undefined;
  let d = raw.replace(/\D/g, '').replace(/^00/, '');
  if (!d) return undefined;
  if (d.length === 10 && !raw.trim().startsWith('+') && (!country || country === 'us' || country === 'ca' || country === 'pr')) d = `1${d}`;
  return d.length >= 7 ? d : undefined;
}

/**
 * Fire Lead after a lead form succeeded, with manual advanced matching.
 * The visitor's details go to the pixel only — Meta's pixel normalises and
 * SHA-256 hashes them in the browser before sending. Nothing is logged or
 * stored by this code.
 */
export interface MetaLeadOptions {
  contentName: string;
  /** Defaults to [DocumentID] on /listing/<id> pages. */
  contentIds?: string[];
  user?: MetaLeadUser;
  /** From metaLeadContext() when the same ID was sent with the lead. */
  eventId?: string;
}

export async function trackMetaLead(opts: MetaLeadOptions): Promise<void> {
  if (!enabled) return;
  // Resolve the listing now: a form that redirects to /thank-you has already
  // left the listing page by the time an awaited country lookup returns.
  const listingId = listingIdFromPath();
  if (!opts.contentIds && listingId) opts = { ...opts, contentIds: [listingId] };
  const given = opts.user?.country && /^[A-Za-z]{2}$/.test(opts.user.country) ? opts.user.country.toLowerCase() : undefined;
  // Synchronous when the country is already known (metaLeadContext() looked
  // it up during the POST), so the Lead is sent on the page it happened on.
  if (given || countryDone) return sendLead(opts, given ?? countryValue);
  return sendLead(opts, await visitorCountry());
}

function sendLead(opts: MetaLeadOptions, country: string | undefined): void {
  const eventID = opts.eventId || newEventId();
  const u = opts.user || {};
  let fn = u.firstName?.trim();
  let ln = u.lastName?.trim();
  if (!fn && !ln && u.fullName) {
    const parts = u.fullName.trim().split(/\s+/);
    fn = parts[0];
    ln = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  }
  const am = Object.fromEntries(Object.entries({
    em: u.email?.trim().toLowerCase() || undefined,
    ph: normalizePhone(u.phone, country),
    fn: fn?.toLowerCase() || undefined,
    ln: ln?.toLowerCase() || undefined,
    country,
  }).filter(([, v]) => v));
  // Re-initialising with user data is Meta's documented way to add manual
  // advanced matching after page load; it only touches FYI's pixel.
  if (Object.keys(am).length) fbq('init', META_PIXEL_ID, am);
  log('advanced matching fields', Object.keys(am));
  const ids = opts.contentIds?.filter(Boolean);
  send('Lead', { content_name: opts.contentName, ...(ids?.length ? { content_ids: ids, content_type: 'product' } : {}) }, eventID);
}
