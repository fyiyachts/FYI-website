// Lightweight GA4 plumbing. The gtag loader is injected once and events
// flow; track() also pushes to window.dataLayer so a GTM container added
// later picks the same events up. No PII in params.

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
}

/**
 * FYI's own GA4 measurement ID — the same property the live fyiyachts.com
 * WordPress site reports into, so history is continuous through the domain
 * cutover. Read off the live site's Site Kit tag, which configures it
 * alongside Google Ads AW-957166058.
 *
 * Why it's a committed default and not env-only: this used to be
 * `VITE_GA4_ID || ''`, which meant analytics was fully inert unless someone
 * remembered to set the var on the Vercel project. Nobody had, so every
 * event the site fired — generate_lead, page_not_found, phone_click,
 * directions_click — went nowhere while the code looked shipped. A GA4
 * measurement ID is public by design (it ships in the client bundle of every
 * page on fyiyachts.com right now), so there is nothing to protect by hiding
 * it. Setting VITE_GA4_ID on the Vercel project still overrides this, which
 * is how you'd point a fork or a staging deploy at a different property.
 */
const GA_ID_FALLBACK = 'G-EF1VDXWBEB';

/**
 * FYI's Google Ads account tag + the lead conversion action, read verbatim
 * off the live WordPress thank-you page (a hardcoded gtag snippet, not GTM).
 * Ads conversions have counted a /thank-you pageview for years; configuring
 * the same AW tag here and firing the same send_to keeps that measurement
 * alive through the domain cutover — otherwise Ads records zero conversions
 * while spend continues (the exact failure diagnosed on Five Star).
 */
const ADS_ID = 'AW-957166058';
const ADS_LEAD_CONVERSION = 'AW-957166058/Pz2CCMy3yYUBEOrjtMgD';

const GA_ID = (import.meta.env.VITE_GA4_ID as string | undefined) || GA_ID_FALLBACK;
let loaded = false;

export function initAnalytics(): void {
  if (loaded || !GA_ID || typeof document === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); } as (...args: unknown[]) => void;
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
  // Sitewide Ads tag — also feeds remarketing audiences, same as on WP.
  window.gtag('config', ADS_ID);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function track(event: string, params: Record<string, string | number | undefined> = {}): void {
  initAnalytics();
  if (typeof window === 'undefined') return;
  if (window.gtag) window.gtag('event', event, params);
  else (window.dataLayer = window.dataLayer || []).push({ event, ...params });
}

/**
 * Fire the Google Ads lead conversion — the same send_to the WP thank-you
 * page fired. Call once per successful lead: the thank-you page fires it on
 * mount; forms that confirm inline (listing inquiry, quiz) fire it directly.
 */
export function trackAdsConversion(context?: string): void {
  initAnalytics();
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'conversion', {
    send_to: ADS_LEAD_CONVERSION,
    ...(context ? { event_label: context } : {}),
  });
}
