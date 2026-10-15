// Web-attribution capture. Records how a visitor first arrived (ad click ids,
// UTM parameters, referrer, landing page) and keeps it in localStorage so any
// lead they submit later — contact form, chat, market alert — can carry it to
// HubSpot/CRM. Click ids refresh when a newer ad click arrives; the first-seen
// referrer/landing page never change, so "first touch" stays honest.
//
// This exists because leads on this site are created server-side (SMTP + CRM
// webhook + Contacts API), where HubSpot's own tracking cookie can't help:
// without these fields a Google Ads lead is indistinguishable from organic.

const KEY = 'fyi_attribution';

export interface Attribution {
  gclid?: string;      // Google Ads
  gbraid?: string;     // Google Ads (iOS app-to-web)
  wbraid?: string;     // Google Ads (iOS web-to-app)
  fbclid?: string;     // Meta ads
  msclkid?: string;    // Microsoft/Bing ads
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  first_seen?: string; // ISO timestamp of the first visit we saw
}

const CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'] as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

function read(): Attribution {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

function write(a: Attribution): void {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage unavailable */ }
}

/** Call once at app startup. Safe to call again on route changes. */
export function initAttribution(): void {
  if (typeof window === 'undefined') return;
  const stored = read();
  const params = new URLSearchParams(window.location.search);

  const incoming: Attribution = {};
  for (const k of [...CLICK_IDS, ...UTM_KEYS]) {
    const v = params.get(k);
    if (v) incoming[k] = v.slice(0, 200);
  }

  const isFirstVisit = !stored.first_seen;
  const next: Attribution = { ...stored };

  if (isFirstVisit) {
    next.first_seen = new Date().toISOString();
    next.landing_page = (window.location.pathname + window.location.search).slice(0, 300);
    const ref = document.referrer;
    if (ref && !ref.includes(window.location.hostname)) next.referrer = ref.slice(0, 300);
  }

  // A fresh ad click (new click id or UTM set) always updates those fields —
  // the latest paid touch is what the ad platforms will bill and report on.
  const hasNewClick = CLICK_IDS.some((k) => incoming[k]);
  const hasNewUtm = UTM_KEYS.some((k) => incoming[k]);
  if (hasNewClick || hasNewUtm || isFirstVisit) {
    for (const k of CLICK_IDS) if (incoming[k]) next[k] = incoming[k];
    if (hasNewUtm) for (const k of UTM_KEYS) next[k] = incoming[k]; // full set replaces, no stale mixes
  }

  write(next);
}

/** The stored attribution, for inclusion in lead payloads. Empty object if none. */
export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  return read();
}
