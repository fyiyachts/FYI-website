// Ad-pixel consent: who may be measured, decided once per page load.
//
// The same rules the Meta pixel applies (utils/metaPixel.ts, decideConsent),
// for the ad pixels added after it — currently the OpenAI pixel
// (utils/openaiPixel.ts). metaPixel.ts keeps its own copy, untouched; if these
// rules change, change both.
//   1. A choice the visitor already made in HubSpot's cookie banner (its
//      __hs_opt_out / __hs_cookie_cat_pref cookies, "advertisement" = 2) wins.
//   2. Outside the EU/EEA, UK, Switzerland and Turkey (visitor's country from
//      Vercel's IP geolocation, /api/geo): granted by default. No banner is
//      shown there, so there is nothing to wait for.
//   3. Inside those regions: wait for HubSpot's addPrivacyConsentListener
//      ("advertisement"). If no HubSpot banner appears within a few seconds
//      and HubSpot hasn't answered, the banner is off: granted.
// HubSpot's listener is followed whenever it answers, but a "no" only counts
// in the regions above or as a stored choice: with no banner shown, nobody
// declined anything.

interface HubspotConsent {
  allowed?: boolean;
  categories?: { advertisement?: boolean };
}

/** Where a cookie banner is (or may be) shown: EU/EEA, UK, Switzerland, Turkey. */
const CONSENT_REGION = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // EU
  'IS', 'LI', 'NO', // EEA
  'GB', 'CH', 'TR',
]);
/** How long a consent-region visitor waits for HubSpot's banner before it counts as off. */
const BANNER_WAIT_MS = 4000;

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

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

let countryPromise: Promise<string | undefined> | null = null;
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
        return typeof d?.country === 'string' && /^[A-Za-z]{2}$/.test(d.country) ? d.country.toUpperCase() : undefined;
      } catch { return undefined; }
    })();
  }
  return countryPromise;
}

/**
 * Decide advertising consent and report it to `apply` — once with the first
 * decision, and again whenever HubSpot's banner changes it. `apply` must
 * ignore a repeat of the value it already has.
 */
export function decideAdConsent(apply: (granted: boolean) => void, log: (...a: unknown[]) => void = () => {}): void {
  let consentRegion: boolean | null = null; // null until the country is known
  let hubspotAnswered = false;

  const w = window as Window & { _hsp?: unknown[] };
  w._hsp = w._hsp || [];
  w._hsp.push(['addPrivacyConsentListener', (c: HubspotConsent) => {
    const granted = Boolean(c?.categories ? c.categories.advertisement : c?.allowed);
    hubspotAnswered = true;
    log('HubSpot consent', granted);
    if (granted || consentRegion === true || storedHubspotChoice() === false) apply(granted);
  }]);

  const stored = storedHubspotChoice();
  if (stored !== null) { apply(stored); return; }

  void visitorCountry().then((country) => {
    consentRegion = !!country && CONSENT_REGION.has(country);
    if (!consentRegion) { apply(true); return; } // no banner outside these regions
    window.setTimeout(() => {
      if (!hubspotAnswered && !hubspotBannerShown()) apply(true);
    }, BANNER_WAIT_MS);
  });
}
