// FYI HubSpot tracking-code wiring (portal 3826631). The script sets the hubspotutk cookie and reports
// pageviews, which is what powers HubSpot's auto-tracked "Original Traffic
// Source" on contacts. The old WordPress fyiyachts.com carried this script;
// without it here, every contact created after the domain flip would show
// "Offline Sources" and paid-ads attribution would go dark.
//
// SPA caveat: the script only tracks the initial load by itself. Route changes
// must be reported via trackRouteChange(), and identify() ties the visitor's
// cookie history to their email once a lead form is submitted.

declare global {
  interface Window { _hsq?: unknown[][] }
}

const FYI_HUBSPOT_PORTAL = '3826631';
let injected = false;

export function initHubspotTracking(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  window._hsq = window._hsq || [];
  const s = document.createElement('script');
  s.id = 'hs-script-loader';
  s.async = true;
  s.defer = true;
  s.src = `https://js.hs-scripts.com/${FYI_HUBSPOT_PORTAL}.js`;
  document.body.appendChild(s);
  suppressHubspotPopups();
}

/**
 * The tracking loader also ships the portal's pop-up CTAs (legacy "lead
 * flows" / new "web interactives"), which render marketing modals over this
 * site (seen on cutover day: "Free Yacht Survey & Market Valuation" covering
 * /sell). This site has its own conversion paths — forms, Brianna, the quiz —
 * so HubSpot-rendered popups are suppressed wholesale: a CSS kill for
 * anything they inject plus an observer that removes the nodes. Tracking,
 * identify, and attribution are untouched. The popups should ALSO be
 * unpublished/retargeted in HubSpot (Marketing → CTAs) — this is the
 * belt-and-suspenders so nothing new pops up unreviewed.
 */
const POPUP_MARKER = /^(leadin|hs-web-interactives|hs-interactives)/i;

declare global {
  interface Window { HubSpotCallsToActions?: { closeAll?: () => void } }
}

/**
 * The vendor-supported half of the suppression: HubSpot's CTA SDK exposes
 * closeAll() (nothing exists to disable CTAs at source — no REST API, and the
 * SDK has no "don't render" switch), so call it once the SDK lands and again
 * on every SPA route change.
 */
export function closeHubspotCtas(): void {
  try { window.HubSpotCallsToActions?.closeAll?.(); } catch { /* noop */ }
}

function suppressHubspotPopups(): void {
  // Keep nudging closeAll() while the SDK loads; stop once the page settles.
  let tries = 0;
  const t = setInterval(() => {
    closeHubspotCtas();
    if (++tries >= 20) clearInterval(t);
  }, 1500);

  const style = document.createElement('style');
  style.textContent =
    '#leadinModal, .leadinModal, [id^="leadin"], [class^="leadinModal"], ' +
    '[id^="hs-web-interactives"], [class*="hs-web-interactives"], [id^="hs-interactives"] ' +
    '{ display: none !important; visibility: hidden !important; }';
  document.head.appendChild(style);

  const purge = (root: ParentNode) => {
    root.querySelectorAll('[id], [class]').forEach((el) => {
      const id = el.id || '';
      const cls = typeof el.className === 'string' ? el.className : '';
      if (POPUP_MARKER.test(id) || /leadinModal|hs-web-interactives/i.test(cls)) el.remove();
    });
  };
  purge(document);
  new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        const id = n.id || '';
        const cls = typeof n.className === 'string' ? n.className : '';
        if (POPUP_MARKER.test(id) || /leadinModal|hs-web-interactives/i.test(cls)) n.remove();
        else purge(n);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}

/** Report an SPA navigation to HubSpot analytics. */
export function trackRouteChange(path: string): void {
  if (typeof window === 'undefined') return;
  const hsq = (window._hsq = window._hsq || []);
  hsq.push(['setPath', path]);
  hsq.push(['trackPageView']);
  // A route change is when HubSpot re-evaluates CTA targeting — shut any down.
  closeHubspotCtas();
}

/**
 * Associate the anonymous tracking cookie with an email after a lead submits.
 * HubSpot then attaches the visitor's whole web history — including the
 * paid-search original source — to the contact record.
 */
export function identifyVisitor(email: string): void {
  if (typeof window === 'undefined' || !email) return;
  const hsq = (window._hsq = window._hsq || []);
  hsq.push(['identify', { email }]);
  hsq.push(['trackPageView']);
}
