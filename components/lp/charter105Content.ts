// Copy, prices and rules for /lp/charterspecial — the booking page for the
// 105′ Azimut "Daily Charter Special" (Instagram/Meta ad). Shared by the page
// and its prerendered shell, so the two can't drift. No React or app imports.

export const C105_PATH = '/lp/charterspecial';
export const C105_TITLE = '105′ Azimut Daily Charter Special | FYI Yachts';
export const C105_DESCRIPTION =
  "Charter FYI's 105' Azimut in Miami: $4,800 for up to 13 guests, gratuity included. Pick your date and time and book in minutes.";
/** Analytics context for this page's events. */
export const C105_CONTEXT = 'Charter 105 promo';

/* ------------------------------------------------------------------ offer */

export const C105_PRICE = 4800;
export const C105_REGULAR_PRICE = 7400;
export const C105_HOURS = 5;
export const C105_MAX_GUESTS = 13;
export const C105_DEFAULT_GUESTS = 2;
/** Paying cash takes this share off the charter price. */
export const C105_CASH_DISCOUNT = 0.05;

export const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/** This promo departs from EPIC — the other charter pages keep Bayshore Landing. */
export const C105_DEPARTS_NAME = 'EPIC Marina & Hotel';
export const C105_DEPARTS_ADDRESS = '250 Biscayne Boulevard Way, Miami';

export const C105_EMAIL = 'charters@fyiyachts.com';

/** Hero video and poster, in public/lp/charter-105/. */
export const C105_MEDIA = {
  poster: '/lp/charter-105/charter-105-hero-poster.jpg',
  mobile: '/lp/charter-105/charter-105-hero-720.mp4',
  desktop: '/lp/charter-105/charter-105-hero.mp4',
};

export const C105_CHIPS = ['Up to 13 guests', '5 hours on the water', 'Local Miami cruising', 'Gratuity included'];

export const C105_STEPS = [
  { title: 'Pick your day', text: 'Choose a date, a time slot and your group size below.' },
  { title: 'We confirm', text: 'Our charter team checks availability and calls or emails you to confirm.' },
  { title: 'Pay & cruise', text: 'Pay by Zelle, ACH, card or cash (save 5%), then step aboard.' },
];

export const C105_TERMS = [
  `Departs from ${C105_DEPARTS_NAME}, ${C105_DEPARTS_ADDRESS}.`,
  'Local Miami cruising only. No international trips.',
  'Food and drinks are not included. Menu options are available.',
  'Holidays are blacked out and not part of this promo.',
  'Chef, bartender, catering, reservations and extra water toys on request, for a fee.',
];

/* -------------------------------------------------------------- booking */

export const C105_SLOTS = [
  { label: 'Day cruise', time: '11:00 AM – 3:00 PM', icon: 'sun' },
  { label: 'Sunset cruise', time: '5:00 PM – 10:00 PM', icon: 'sunset' },
] as const;

export const C105_EXTRAS = ['Private chef', 'Bartender', 'Food & catering', 'Restaurant reservation', 'Extra water toy'] as const;

export const C105_PAYMENTS = [
  { value: 'Zelle', kicker: 'Pay by', label: 'Zelle' },
  { value: 'ACH transfer', kicker: 'Bank', label: 'ACH transfer' },
  { value: 'Credit card', kicker: 'Card', label: 'Credit card' },
  { value: 'Cash', kicker: 'In person', label: 'Cash', badge: 'Save 5%' },
] as const;

/** Bookable window: from tomorrow to the end of the 12th month ahead. */
export const C105_LEAD_DAYS = 1;
export const C105_MONTHS_AHEAD = 12;

/**
 * Holiday blackouts — the only list to edit. Computed for each year, so it
 * never goes stale. month is 1–12; weekday is 0 (Sun) – 6 (Sat).
 *   fixed: that date every year
 *   nth:   the nth weekday of the month (Labor Day = 1st Monday of September)
 *   last:  the last weekday of the month (Memorial Day = last Monday of May)
 */
export type BlackoutRule =
  | { name: string; kind: 'fixed'; month: number; day: number }
  | { name: string; kind: 'nth'; month: number; weekday: number; n: number }
  | { name: string; kind: 'last'; month: number; weekday: number };

export const C105_BLACKOUTS: BlackoutRule[] = [
  { name: "New Year's Day", kind: 'fixed', month: 1, day: 1 },
  { name: 'Memorial Day', kind: 'last', month: 5, weekday: 1 },
  { name: 'Independence Day', kind: 'fixed', month: 7, day: 4 },
  { name: 'Labor Day', kind: 'nth', month: 9, weekday: 1, n: 1 },
  { name: 'Thanksgiving', kind: 'nth', month: 11, weekday: 4, n: 4 },
  { name: 'Christmas Eve', kind: 'fixed', month: 12, day: 24 },
  { name: 'Christmas Day', kind: 'fixed', month: 12, day: 25 },
  { name: "New Year's Eve", kind: 'fixed', month: 12, day: 31 },
];

/** Blackout date → holiday name for one year, keyed "YYYY-M-D" (local time). */
export function blackoutsFor(year: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of C105_BLACKOUTS) {
    let d: Date;
    if (r.kind === 'fixed') d = new Date(year, r.month - 1, r.day);
    else if (r.kind === 'nth') {
      const first = new Date(year, r.month - 1, 1);
      d = new Date(year, r.month - 1, 1 + ((r.weekday - first.getDay() + 7) % 7) + (r.n - 1) * 7);
    } else {
      const end = new Date(year, r.month, 0);
      d = new Date(year, r.month - 1, end.getDate() - ((end.getDay() - r.weekday + 7) % 7));
    }
    out.set(dayKey(d), r.name);
  }
  return out;
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
