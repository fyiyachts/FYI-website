// Copy and option lists for the ChatGPT Ads center console landing page
// (/lp/center-consoles). Shared by the React page and the build-time
// prerender (FAQPage schema), so the two can't drift.

import type { QA } from '../public/faqData';

export const LP_PATH = '/lp/center-consoles';
export const LP_PHONE_TEL = '+13058546020';
export const LP_PHONE_DISPLAY = '305-854-6020';
export const LP_CONTEXT = 'ChatGPT Ads – Center Console';

export const LP_TITLE = 'Center Console Boats for Sale | FYI Yachts';
export const LP_DESCRIPTION =
  'Center console boats for sale from FYI Yachts in Miami — exclusive inventory and brokers who know these boats. Get matched in about 45 seconds.';

/** Hero copy — shared by the page and its prerendered shell, which must match. */
export const CC_HERO = {
  eyebrow: 'FYI Yachts · Center Console Specialists',
  h1: 'Center Console Boats for Sale',
  subhead: 'Exclusive Miami inventory, shown by brokers who know these boats inside out.',
  ctaLabel: 'Get matched with a center console',
  countLabel: 'center consoles',
};

/** A center console in FYI's book, by the feed's BoatClassCode. */
export const isCenterConsole = (classCode: string): boolean => /center console/i.test(classCode);

/** Length chips on the inventory and the size step of the form share these bands. */
export const SIZE_BANDS = [
  { key: '25-30', label: '25–30 ft', min: 25, max: 30 },
  { key: '30-35', label: '30–35 ft', min: 30, max: 35 },
  { key: '35-40', label: '35–40 ft', min: 35, max: 40 },
  { key: '40+', label: '40+ ft', min: 40, max: Infinity },
] as const;

export const BUDGET_BANDS = [
  { key: 'under-150k', label: 'Under $150K', min: 0, max: 150_000 },
  { key: '150-300k', label: '$150–300K', min: 150_000, max: 300_000 },
  { key: '300-600k', label: '$300–600K', min: 300_000, max: 600_000 },
  { key: '600k-1m', label: '$600K–1M', min: 600_000, max: 1_000_000 },
  { key: '1m+', label: '$1M+', min: 1_000_000, max: Infinity },
] as const;

export const USES = ['Offshore fishing', 'Family & sandbar', 'Diving', 'Tournament', 'Other'] as const;

export const OWNS = [
  { key: 'no', label: 'No' },
  { key: 'yes-keeping', label: 'Yes, keeping it' },
  { key: 'yes-selling', label: 'Yes, looking to sell or trade' },
] as const;

export const sizeBandFor = (lengthFt?: number) =>
  lengthFt ? SIZE_BANDS.find((b) => lengthFt >= b.min && lengthFt < b.max) : undefined;
export const budgetBandFor = (priceUsd?: number) =>
  priceUsd ? BUDGET_BANDS.find((b) => priceUsd >= b.min && priceUsd < b.max) : undefined;

export const WHY_FYI = [
  {
    title: 'Exclusive inventory',
    text: 'Center consoles listed with FYI and shown by the brokers who list them — plus access to the wider market when the right boat isn’t on our dock.',
  },
  {
    title: 'Center console expertise',
    text: 'Contender, Intrepid, SeaVee, Yellowfin, Boston Whaler and more: we know how each model runs, how it’s rigged, and what it should cost.',
  },
  {
    title: 'Since 1994, in Miami',
    text: 'Three decades on Coral Way, with surveys, sea trials, financing and closing handled under one roof.',
  },
];

export const CC_FAQS: QA[] = [
  {
    q: 'What size center console is right for me?',
    a: 'Think about where you will run and how many people you carry. 25–30 ft suits bays, sandbars and nearshore days; 30–35 ft is the sweet spot for offshore day trips with a few friends; 35–40 ft adds range, deck space and a cabin console for serious offshore fishing; 40 ft and up carries a crowd and long runs in more comfort. A broker can narrow it in one call.',
  },
  {
    q: 'Single, twin, triple or quad outboards — what’s the difference?',
    a: 'A single outboard is lighter and cheaper to run, and common under about 28 ft. Twins add redundancy for offshore running and are standard from about 30 ft. Triples and quads power the largest, heaviest center consoles to high speeds. More engines mean more speed and peace of mind, and more fuel and maintenance.',
  },
  {
    q: 'Should I buy new or pre-owned?',
    a: 'New brings a full warranty, the latest engines and your choice of options, but can mean waiting for a build slot. Pre-owned is ready now and better value; engine hours, maintenance records and a survey matter most. FYI handles both, so you can compare side by side.',
  },
  {
    q: 'Can I finance a center console?',
    a: 'Yes. Marine lenders finance new and pre-owned center consoles; terms depend on the boat’s age, the amount and your credit. FYI coordinates financing with marine-finance specialists alongside the purchase.',
  },
  {
    q: 'Can I sea trial the boat before I buy?',
    a: 'Yes. A sea trial and an independent survey are standard: your offer is accepted subject to both, so you can run the boat and have it inspected before you commit. FYI arranges them for you.',
  },
];
