// The site-wide Charter Special pop-up — the one place to change or stop it.
//
//   enabled:   false switches it off everywhere.
//   endsAt:    ISO date ('2027-01-31'); once it has passed the pop-up never shows.
//   snoozeHours: after it has been shown once, it stays away this long in that
//              browser, whatever the visitor did (closed, ignored, clicked).
//   storageKey: bump the version to show it again to everyone (e.g. a new offer).
//
// Prices and copy come from the landing page's constants
// (components/lp/charter105Content.ts), so the two never disagree.

import {
  C105_DEPARTS_NAME, C105_HOURS, C105_MAX_GUESTS, C105_MEDIA, C105_PATH, C105_PRICE, C105_REGULAR_PRICE, usd,
} from '../lp/charter105Content';

export const CHARTER_PROMO = {
  enabled: true,
  endsAt: null as string | null,
  href: `${C105_PATH}?utm_source=website&utm_medium=popup&utm_campaign=charter-special`,
  snoozeHours: 24,
  storageKey: 'fyi_charter_popup_v1',
  /** Never shown on these paths or anything under them. */
  excludedPaths: ['/lp', '/app', '/login', '/brianna', '/quiz', '/thank-you', '/404'],
  /** Visiting the landing page itself counts as having seen the offer. */
  landingPath: C105_PATH,
};

/** Analytics name for this promo's events. */
export const PROMO_ID = 'charter-special';

export const PROMO_COPY = {
  price: usd(C105_PRICE),
  regular: usd(C105_REGULAR_PRICE),
  hours: C105_HOURS,
  guests: C105_MAX_GUESTS,
  // "EPIC Marina & Hotel" → "EPIC Marina", as in the approved design.
  departs: `Departs ${C105_DEPARTS_NAME.replace(/ & Hotel$/, '')}, Downtown Miami`,
};

export const PROMO_MEDIA = {
  still: '/charter/hero-105-1100.webp',
  poster: C105_MEDIA.poster,
  video: C105_MEDIA.mobile, // 720p is plenty for a 460px-wide panel
};
