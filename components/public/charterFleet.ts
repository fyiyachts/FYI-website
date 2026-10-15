// FYI's crewed charter programme, transcribed from the live fyiyachts.com
// charter pages (2026-07-27). Charter boats are NOT in the BoatsGroup sales
// feed, so this is hand-maintained — update rates here when FYI changes them.
//
// CURRENT FLEET: XTREME (80′ Azimut S8, added 2026-10-01) and the 105′ Azimut
// with published rates — nothing else (client, 2026-10-14). The five vessels
// that were on request (client, 2026-09-03) are held in WITHHELD_ON_REQUEST.
// Earlier state, still true of the
// arrays below: (client, 2026-08-26 — every
// other vessel came off the charter page). The vessels that were removed are
// kept below in WITHHELD_CHARTER_VESSELS rather than deleted: their rates and
// galleries were transcribed from two live pages and Miami Yacht Connect's
// media library, and re-sourcing that is a research job. Nothing on the site
// imports that array, so a withheld vessel has no page, no card, and no
// sitemap entry. To bring one back, move it into CHARTER_FLEET (or
// CHARTER_ON_REQUEST / TERM_CHARTER), re-check its rates, and drop its
// /charter/<slug> redirect from vercel.json — the redirect would otherwise
// 301 away the page you just restored.
//
// SOURCES (two live pages, and they disagree):
//   /charter/       — the CURRENT day-charter page (new nav/design). Five
//                     vessels, "up to 13 guests", the rate tables below.
//   /yacht-charter/ — the LEGACY page. Older fleet, "up to 12 guests", three
//                     vessels stamped *NOT AVAILABLE*, and different rates for
//                     the same 50' Azimut ($4,000/4h vs $2,280/4h). Where the
//                     two conflict, /charter/ wins. The only things kept from
//                     the legacy page are the 92' Riva term rates and the
//                     86' Azimut / 69' Sunseeker — all of which have live photo
//                     galleries and carry no "not available" stamp.
//   FYI should confirm the legacy page's remaining vessels before we surface
//   them (open question logged in the brain).
//
// Vessel↔photo mapping follows the live /charter/ page's own DOM order.
//
// JSX-free so both the React pages and the build-time prerender can import it.

export interface CharterRate {
  hours: string;   // '4 hours'
  price: string;   // '$7,000'
  note?: string;   // '+ $500 pick-up fee'
}

export interface CharterVessel {
  slug: string;
  name: string;            // '105′ Azimut'
  builder: string;
  lengthFt: number;
  guests: number;
  image: string;           // hero photo
  alt: string;
  blurb: string;
  rates: CharterRate[];
  extraHour?: string;      // '$1,000'
  included?: string[];     // vessel-specific toys
  gallery?: string[];      // full-size photos from FYI's real galleries
  availability?: string;   // shown when not part of the standard day fleet
  // Optional Mon–Thu rate card, for vessels the owner prices lower midweek.
  // `rates` / `extraHour` above are then the Fri–Sun (headline) prices.
  weekdayRates?: CharterRate[];
  weekdayExtraHour?: string;
  departsFrom?: string;     // overrides CHARTER_MARINA_NAME on the vessel page
  // All-inclusive vessels: crew and gratuity are in the price, so the
  // separate crew-rate table and the "gratuity paid to crew" copy are hidden.
  allInclusive?: boolean;
  rules?: [string, string][]; // vessel-specific house rules, as spec rows
}

const IMG = (p: string) => `https://storage.googleapis.com/fyiyachts/${p}`;
// FYI's own BoatsGroup listing photos (the 62' Prestige is also for sale with us).
const BG = (f: string) => `https://images.boatsgroup.com/resize/1/90/95/${f}?w=900&h=675`;
// The 105' Azimut Grande's sales-listing shoot (DocumentID 9872081) — the only
// place FYI has exterior running/profile shots of its biggest charter vessel.
const BG105 = (f: string) => `https://images.boatsgroup.com/resize/1/94/57/2012-azimut-grande-105-power-9679457-${f}?w=900&h=675`;
// Miami Yacht Connect partner-fleet marketing images — see note at the vessels below.
const MYC = (p: string) => `https://miamiyachtconnect.com/wp-content/uploads/${p}`;
// Miami Charters (miamicharters.com) — the partner fleet FYI's charter desk
// books through. Photos come from that site's own media library.
const MC = (p: string) => `https://miamicharters.com/wp-content/uploads/${p}`;
// FYI's own 2012 Azimut 71 Flybridge sales listing (fyiyachts.com/listing/9906288)
// — the boat is for sale AND available to charter, so the charter card reuses
// the listing shoot.
const BG71 = (f: string) => `https://images.boatsgroup.com/images/1/0/13/9060013_${f}_1_XLARGE.jpg`;

/** Crew is quoted separately from the vessel and paid directly to the crew. */
export const CAPTAIN_RATES: CharterRate[] = [
  { hours: '4 hours', price: '$300' },
  { hours: '6 hours', price: '$350' },
  { hours: '8 hours', price: '$400' },
];

export const MATE_STEW_RATES: CharterRate[] = [
  { hours: '4 hours', price: '$200' },
  { hours: '6 hours', price: '$225' },
  { hours: '8 hours', price: '$250' },
];

/** Verbatim from the live page's "Charters Include" list. */
export const CHARTER_INCLUDES: string[] = [
  'Fuel',
  'Choice of captain and crew',
  'Water, ice, and coolers',
  'Towels',
  'Cruising Miami',
  'Stopping at the sandbar',
  'Up to 13 guests',
];

export const CHARTER_POLICIES: { label: string; detail: string }[] = [
  { label: 'Taxes & crew', detail: 'All rates include tax. Crew rate and gratuity are paid directly to the captain and crew.' },
  { label: 'Gratuity', detail: 'Not included — a minimum of 15% is expected, paid directly to the captain.' },
  { label: 'Credit card', detail: 'A 4% processing fee is added to the total when paying by card.' },
  { label: 'Dockage', detail: 'Stopping to eat is welcome — additional dockage charges apply at the restaurant’s marina.' },
  { label: 'Boundaries', detail: 'Charters run within the mapped Miami boundary. Additional fuel charges accrue beyond it.' },
  { label: 'Seasonality', detail: 'Pricing may vary with the time of year, location, and any special requirements.' },
];

export const BOUNDARY_MAP = IMG('2023/09/Map_Yacht_Charter_Boundaries-COLOR27.png');

// The charter desk runs its own line and inbox, separate from brokerage.
export const CHARTER_PHONE_DISPLAY = '305-306-8462';
export const CHARTER_PHONE_TEL = 'tel:+13053068462';
export const CHARTER_EMAIL = 'charters@fyiyachts.com';
// Renamed 2026-08-21: the 2550 S Bayshore Dr marina has not traded as Prime
// Marina for years (client). Bayshore Landing is the marina; Monty's is the
// restaurant on the same property, and was the other name FYI offered.
export const CHARTER_MARINA_NAME = 'Bayshore Landing';
export const CHARTER_MARINA_ADDRESS = '2550 S Bayshore Dr Suite 102, Coconut Grove, FL 33133';

/* ------------------------------------------------ the day-charter fleet */

// Local shoot supplied by FYI (Dropbox, 2026-09-30), resized into public/.
const XT = (n: number) => `/charter/xtreme/xtreme-${String(n).padStart(2, '0')}.webp`;

export const CHARTER_FLEET: CharterVessel[] = [
  // Added 2026-10-01 at the client's request (WhatsApp, 2026-09-30) —
  // rates, toys, and rules verbatim from that message.
  {
    slug: 'azimut-s8-xtreme',
    name: 'XTREME — 80′ Azimut S8',
    builder: 'Azimut S8 (2025)',
    lengthFt: 80,
    guests: 13,
    image: XT(1),
    alt: 'XTREME, a 2025 Azimut S8, at rest on Biscayne Bay with the Miami skyline behind',
    blurb: 'A brand-new 2025 Azimut S8 with a Sea Bob and jet ski aboard, all-inclusive pricing with gratuity included, departing from the Miami River.',
    rates: [
      { hours: '4 hours', price: '$6,000' },
      { hours: '6 hours', price: '$8,000' },
      { hours: '8 hours', price: '$9,500' },
    ],
    extraHour: '$1,500',
    weekdayRates: [
      { hours: '4 hours', price: '$5,500' },
      { hours: '6 hours', price: '$7,500' },
      { hours: '8 hours', price: '$9,000' },
    ],
    weekdayExtraHour: '$1,000',
    departsFrom: 'Miami River Landing',
    allInclusive: true,
    included: [
      '1 Sea Bob',
      '1 jet ski (1-hour use)',
      'All-inclusive pricing, gratuity included',
    ],
    rules: [['Guests', 'Max 13'], ['Smoking', 'Not allowed'], ['Red wine', 'Not allowed'], ['Pets', 'Not allowed']],
    gallery: Array.from({ length: 27 }, (_, i) => XT(i + 1)),
  },
  {
    slug: 'azimut-105',
    name: '105′ Azimut',
    builder: 'Azimut 105',
    lengthFt: 105,
    guests: 13,
    image: BG105('20250505140942493-1_XLARGE.jpg'),
    alt: 'The shaded aft deck of FYI’s 105-foot Azimut charter yacht, looking out over open water',
    blurb: 'The flagship of the fleet — three decks, a full crew, and enough shaded and open deck space to spread thirteen guests out properly.',
    rates: [
      { hours: '4 hours', price: '$7,000' },
      { hours: '5 hours', price: '$8,000' },
      { hours: '6 hours', price: '$8,500' },
      { hours: '8 hours', price: '$9,500' },
    ],
    extraHour: '$1,000',
    gallery: [
      BG105('20250505140942493-1_XLARGE.jpg'),
      BG105('20250505141033979-1_XLARGE.jpg'),
      BG105('20250505141023962-1_XLARGE.jpg'),
      BG105('20250505141434118-1_XLARGE.jpg'),
      BG105('20250505141138470-1_XLARGE.jpg'),
      BG105('20250505141149279-1_XLARGE.jpg'),
      IMG('2025/09/105-Azimut-95-1.jpg'),
      IMG('2025/09/105-Azimut-2-1.jpg'),
      IMG('2025/09/105-Azimut-11-1.jpg'),
      IMG('2025/09/105-Azimut-12-1.jpg'),
      IMG('2025/09/105-Azimut-50-1.jpg'),
    ],
  },
];

/* --------------------------------------------------- withheld (not published)

   Off the charter page since 2026-08-26 at the client's request. Kept for the
   rates and galleries; see the note at the top of this file before restoring
   one. No page imports this array. */

export const WITHHELD_CHARTER_VESSELS: (CharterVessel | TermCharterVessel)[] = [
  {
    slug: 'majesty-100',
    name: '100′ Majesty',
    builder: 'Majesty 100',
    lengthFt: 100,
    guests: 13,
    image: IMG('2024/10/100ft-majesty.jpg'),
    alt: 'FYI’s 100-foot Majesty charter yacht underway with the Miami skyline behind',
    blurb: 'Enormous volume for the length, a sun-drenched flybridge, and an aft deck built for long lunches on the water.',
    rates: [
      { hours: '4 hours', price: '$9,600', note: '+ $500 pick-up fee' },
      { hours: '5 hours', price: '$11,000' },
      { hours: '6 hours', price: '$13,000' },
      { hours: '8 hours', price: '$15,000' },
    ],
    gallery: [
      IMG('2024/10/100ft-majesty.jpg'),
      IMG('2025/09/10020Majesty-1-1.jpg'),
      IMG('2025/09/10020Majesty-13-1.jpg'),
      IMG('2025/09/10020Majesty-15-1.jpg'),
      IMG('2025/09/10020Majesty-17-1.jpg'),
      IMG('2025/09/10020Majesty-42-1.jpg'),
      IMG('2025/09/10020Majesty-49-1.jpg'),
      IMG('2025/09/10020Majesty-52-1.jpg'),
    ],
  },
  {
    slug: 'azimut-68',
    name: '68′ Azimut',
    builder: 'Azimut 68',
    lengthFt: 68,
    guests: 13,
    image: IMG('2024/10/85ft-azimut.jpg'),
    alt: 'FYI’s 68-foot Azimut charter yacht running on Biscayne Bay',
    blurb: 'The everyday favourite — quick to the sandbar, roomy enough for thirteen, and priced for a spontaneous afternoon.',
    rates: [
      { hours: '4 hours', price: '$3,000' },
      { hours: '5 hours', price: '$3,400' },
      { hours: '6 hours', price: '$4,000' },
      { hours: '8 hours', price: '$4,800' },
    ],
    gallery: [
      IMG('2024/10/85ft-azimut.jpg'),
      IMG('2025/09/731A0010-HDR-1.jpg'),
      IMG('2025/09/731A0034-HDR-1.jpg'),
      IMG('2025/09/731A9838-HDR-1.jpg'),
      IMG('2025/09/731A9876-HDR-1.jpg'),
      IMG('2025/09/731A9916-1.jpg'),
      IMG('2025/09/731A9927-1.jpg'),
    ],
  },
  {
    slug: 'pershing-54',
    name: '54′ Pershing',
    builder: 'Pershing 54',
    lengthFt: 54,
    guests: 13,
    image: IMG('2025/09/HighRes-31.jpg'),
    alt: 'FYI’s 54-foot Pershing charter yacht running past the Miami skyline',
    blurb: 'Italian performance in a day-boat package — the quickest way to the sandbar, and the most fun getting there.',
    rates: [
      { hours: '5 hours', price: '$2,500' },
      { hours: '8 hours', price: '$3,000' },
    ],
    included: ['SeaBob available on request'],
    gallery: [
      IMG('2025/09/HighRes-31.jpg'),
      IMG('2025/09/HighRes-40.jpg'),
      IMG('2025/09/HighRes-9.jpg'),
      IMG('2025/09/HighRes-16.jpg'),
      IMG('2025/09/HighRes-34.jpg'),
    ],
  },
  {
    slug: 'azimut-50',
    name: '50′ Azimut',
    builder: 'Azimut 50',
    lengthFt: 50,
    guests: 13,
    image: IMG('2025/07/jpeg-optimizer_Yacht-DTox_Drone_LO-RES_5.jpg'),
    alt: 'An aerial view of FYI’s 50-foot Azimut charter yacht underway off Miami',
    blurb: 'The most accessible way onto the water with a captain and crew — and the boat that comes loaded with toys.',
    rates: [
      { hours: '4 hours', price: '$2,280' },
      { hours: '5 hours', price: '$2,580' },
      { hours: '6 hours', price: '$3,250' },
      { hours: '8 hours', price: '$3,750' },
    ],
    included: ['Turbojet dinghy', 'Lily pad + floating dock', 'SeaBob available on request'],
    gallery: [IMG('2025/07/jpeg-optimizer_Yacht-DTox_Drone_LO-RES_5.jpg')],
  },

  /* ---------------------------------- larger yachts, on request (legacy) */

  // Kept from the legacy /yacht-charter/ page: both have live photo galleries
  // and no "not available" stamp. Availability is worded softly because those
  // rates are older than the day fleet's.
  {
    slug: 'azimut-86',
    name: '86′ Azimut',
    builder: 'Azimut 86S',
    lengthFt: 86,
    guests: 13,
    image: IMG('2023/10/86-ft-Azimut5-1.jpg'),
    alt: 'The 86-foot Azimut charter yacht, red hull, running hard off Miami',
    blurb: 'An unmistakable red-hulled 86 — the most photogenic boat in the fleet, and quick with it.',
    rates: [
      { hours: '4 hours', price: '$4,800' },
      { hours: '6 hours', price: '$5,800' },
      { hours: '8 hours', price: '$6,800' },
    ],
    availability: 'Ask us to confirm availability and current rates',
    gallery: [
      IMG('2023/10/86-ft-Azimut5-1.jpg'),
      IMG('2023/10/86-ft-Azimut10-1.jpg'),
      IMG('2023/10/86-ft-Azimut41-1.jpg'),
      IMG('2023/10/86-ft-Azimut49-1.jpg'),
      IMG('2023/10/86-ft-Azimut55-1.jpg'),
      IMG('2023/10/86-ft-Azimut57-1.jpg'),
      IMG('2023/10/86-ft-Azimut61-1.jpg'),
      IMG('2023/10/86-ft-Azimut62-1.jpg'),
    ],
  },
  {
    slug: 'sunseeker-69',
    name: '69′ Sunseeker',
    builder: 'Sunseeker 69',
    lengthFt: 69,
    guests: 13,
    image: IMG('2023/10/69-ft-Sunseeker-1.jpg'),
    alt: 'An aerial view of the 69-foot Sunseeker charter yacht at anchor off Miami',
    blurb: 'British build quality with a proper flybridge — a comfortable, sea-kindly platform for a longer day.',
    rates: [
      { hours: '4 hours', price: '$3,500' },
      { hours: '6 hours', price: '$4,100' },
      { hours: '8 hours', price: '$4,800' },
    ],
    availability: 'Ask us to confirm availability and current rates',
    gallery: [
      IMG('2023/10/69-ft-Sunseeker-1.jpg'),
      IMG('2023/10/69-ft-Sunseeker-2.jpg'),
      IMG('2023/10/69-ft-Sunseeker-3.jpg'),
      IMG('2023/10/69-ft-Sunseeker-9.jpg'),
      IMG('2023/10/69-ft-Sunseeker-11.jpg'),
      IMG('2023/10/69-ft-Sunseeker-13.jpg'),
      IMG('2023/10/69-ft-Sunseeker-18.jpg'),
      IMG('2023/10/69-ft-Sunseeker-22.jpg'),
    ],
  },
  {
    slug: 'prestige-620',
    name: '62′ Prestige',
    builder: 'Prestige 620',
    lengthFt: 62,
    guests: 12,
    image: BG('2013-prestige-620-power-10049095-20260714142031596-1.jpg'),
    alt: 'The 62-foot Prestige 620 charter yacht underway off Miami',
    blurb: 'A three-stateroom French flybridge with a wide-open saloon — an easy, social boat for a Miami day.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      BG('2013-prestige-620-power-10049095-20260714142031596-1.jpg'),
      BG('2013-prestige-620-power-10049095-20260714142032136-2.jpg'),
      BG('2013-prestige-620-power-10049095-20260714142032592-3.jpg'),
      BG('2013-prestige-620-power-10049095-20260714142036798-4.jpg'),
      BG('2013-prestige-620-power-10049095-20260714142040374-1.jpg'),
      BG('2013-prestige-620-power-10049095-20260714142040928-2.jpg'),
    ],
  },
  // Partner-fleet vessels marketed on Miami Yacht Connect (client-requested,
  // 2026-07-28). Facts and photos from MYC's public site. Their yacht PAGES
  // publish only 2-3 frames per boat, but the WordPress media library
  // (/wp-json/wp/v2/media?search=<boat name>, Cloudflare-blocked to direct
  // fetch — use WebFetch) holds the full shoots; that is where the deeper
  // galleries came from (2026-07-29). Boat names for future searches:
  // 88' Princess "Praying For Overtime", 88' Azimut "CLOUD 9",
  // 80' S8 "HIDEOUT", 75' "Oceana". Rates deliberately on request: MYC's advertised
  // from-prices are the operator's, not FYI's charter-desk quotes.
  {
    slug: 'azimut-88',
    name: '88′ Azimut',
    builder: 'Azimut 88 (2023)',
    lengthFt: 88,
    guests: 13,
    image: MYC('2024/08/DJI_0896-min-min-scaled.jpg'),
    alt: 'The 88-foot Azimut charter yacht from above, underway off Miami',
    blurb: 'A 2023-generation 88 with the newest interior in the big-boat fleet — Miami days or Bahamas runs.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      MYC('2024/08/DJI_0896-min-min-scaled.jpg'),
      MYC('2024/08/DSC00643-min-min.jpg'),
      MYC('2024/08/DJI_0938-min-min-scaled.jpg'),
      MYC('2026/05/115-print-88-Azimut-Grande-CLOUD-9-119-scaled.jpg'),
    ],
  },
  {
    slug: 'princess-88-overtime',
    name: '88′ Princess',
    builder: 'Princess 88 “Overtime”',
    lengthFt: 88,
    guests: 13,
    image: MYC('2024/09/DJI_0861-scaled.jpg'),
    alt: 'The 88-foot Princess Overtime charter yacht off Miami Beach Marina',
    blurb: 'A stately British 88 out of Miami Beach Marina — volume, shade, and a crew that has hosted everything.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      MYC('2024/09/DJI_0861-scaled.jpg'),
      MYC('2026/02/DJI_0826-scaled.jpg'),
      MYC('2025/06/88-Princess-Praying-For-Overtime-_-4-scaled.jpg'),
      MYC('2025/05/88-Princess-Praying-For-Overtime-_-18-min-scaled.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-26-min-min-scaled.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-16-1-min-min-min-scaled.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-13-min-min-min.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-9-min-min-scaled.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-6-min-min-min.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-5-min-min-scaled.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-3-min-min-min.jpg'),
      MYC('2024/09/88-Princess-Praying-For-Overtime-_-2-min-min-scaled.jpg'),
    ],
  },
  {
    slug: 'azimut-s8-80',
    name: '80′ Azimut S8',
    builder: 'Azimut S8',
    lengthFt: 80,
    guests: 13,
    image: MYC('2024/09/HIDEOUT-Aerial-Photos-10-min-scaled.jpg'),
    alt: 'The 80-foot Azimut S8 sport yacht seen from the air off Miami',
    blurb: 'The sport coupé of the fleet — triple-engined, fast, and dramatic to look at from every angle.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      MYC('2024/09/HIDEOUT-Aerial-Photos-10-min-scaled.jpg'),
      MYC('2024/02/HIDEOUT-Aerial-Photos-3-scaled.jpg'),
      MYC('2024/09/HIDEOUT-Interior-Photos-29-copy-min-scaled.jpg'),
      MYC('2024/09/HIDEOUT-Interior-Photos-31-copy-min-scaled.jpg'),
      MYC('2024/09/HIDEOUT-Interior-Photos-34-copy-min-scaled.jpg'),
      MYC('2024/09/HIDEOUT-Interior-Photos-41-copy-min-scaled.jpg'),
      MYC('2024/09/HIDEOUT-Interior-Photos-42-copy-min-scaled.jpg'),
      MYC('2024/09/HIDEOUT-Interior-Photos-44-copy-min-scaled.jpg'),
    ],
  },
  {
    slug: 'prestige-oceana-75',
    name: '75′ Prestige Oceana',
    builder: 'Prestige Oceana 75',
    lengthFt: 75,
    guests: 13,
    image: MYC('2025/11/large-01994686-3b41-7036-aef6-2895fc2f2f8f.jpg'),
    alt: 'The 75-foot Prestige Oceana charter yacht at Miami Beach Marina',
    blurb: 'Three staterooms and a toy garage that empties out at the sandbar — jet ski, paddle boards, the lot.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      MYC('2025/11/large-01994686-3b41-7036-aef6-2895fc2f2f8f.jpg'),
      MYC('2024/08/75-Prestige-Oceana-Drone-_-min-scaled.jpg'),
      MYC('2024/08/75-Prestige-Oceana-Drone-_-44-min-scaled.jpg'),
      MYC('2024/08/75-Prestige-Oceana-Drone-_-41-min-scaled.jpg'),
      MYC('2024/08/75-Prestige-Oceana-Drone-_-28-min-scaled.jpg'),
      MYC('2024/08/75-Prestige-Oceana-Drone-_-6-min-scaled.jpg'),
      MYC('2025/11/EXTERIOR_25.jpg'),
      MYC('2025/11/EXTERIOR_20.jpg'),
      MYC('2025/11/EXTERIOR_6.jpg'),
      MYC('2025/11/large-01995528-22e5-73d4-860e-747f10012826.jpg'),
      MYC('2025/11/large-01994686-3c8e-70af-88c1-86e2372d00d5.jpg'),
      MYC('2025/11/SALON_GALLEY_HELM_16.jpg'),
      MYC('2025/11/SALON_GALLEY_HELM_15.jpg'),
      MYC('2025/11/SALON_GALLEY_HELM_2.jpg'),
      MYC('2025/11/SALON_GALLEY_HELM_8.jpg'),
      MYC('2025/11/SALON_GALLEY_HELM_7.jpg'),
      MYC('2025/11/75-Prestige-Oceana-_-3.jpg'),
    ],
  },
];

/* Published on request (client, 2026-09-03). Every vessel here was verified
   live on the source site the same day before being restored to the page.
   Four come from the Miami Charters partner fleet — miamicharters.com lists
   4/6/8-hour and multi-day charters but publishes no prices ("call for
   pricing"), so rates stay on request rather than being invented; the fifth
   is FYI's own 71' Azimut, for sale with us and available to charter.
   The 105' Azimut already sits in CHARTER_FLEET above with FYI's own rates,
   so it is not duplicated here.

   Withheld again (client, 2026-10-14): the charter page shows only XTREME and
   the 105' Azimut. These five are kept, not deleted, for the same reason as
   WITHHELD_CHARTER_VESSELS — move them back into CHARTER_ON_REQUEST and drop
   their /charter/<slug> redirects in vercel.json to restore them. */
export const CHARTER_ON_REQUEST: CharterVessel[] = [];

export const WITHHELD_ON_REQUEST: CharterVessel[] = [
  {
    slug: 'azimut-116-2005',
    name: '116′ Azimut',
    builder: 'Azimut 116 (2005)',
    lengthFt: 116,
    guests: 12,
    image: MC('2019/11/IMG_0013-11-1-1.jpg'),
    alt: 'The 116-foot Azimut charter yacht at anchor off Miami',
    blurb: 'The largest boat on the programme — five staterooms including a master and two VIPs, room for twelve on the water and ten overnight, with a jet ski and inflatable island aboard.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      MC('2019/11/IMG_0013-11-1-1.jpg'),
      MC('2019/11/IMG_0028-7-1-1.jpg'),
      MC('2019/11/IMG_0001-11.jpg'),
      MC('2019/11/IMG_0003-12.jpg'),
      MC('2019/11/IMG_0053-1-1.jpg'),
      MC('2019/11/IMG_0010-12.jpg'),
      MC('2019/11/IMG_0016-10.jpg'),
      MC('2019/11/IMG_0020-7.jpg'),
    ],
  },
  {
    slug: 'horizon-110',
    name: '110′ Horizon',
    builder: 'Horizon 110',
    lengthFt: 110,
    guests: 12,
    image: MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.10.39-p.m..png'),
    alt: 'The 110-foot Horizon charter yacht underway near Miami Beach',
    blurb: 'A wide, easy-riding tri-deck with four staterooms and deck space on three levels — built for a long day with a big group rather than a fast one.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.10.39-p.m..png'),
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.11.45-p.m..png'),
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.12.50-p.m..png'),
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.11.11-p.m..png'),
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.12.13-p.m..png'),
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.10.55-p.m..png'),
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.11.31-p.m..png'),
      MC('2019/11/Captura-de-pantalla-2019-04-24-a-las-10.12.26-p.m..png'),
    ],
  },
  {
    slug: 'mangusta-92',
    name: '92′ Mangusta',
    builder: 'Overmarine Mangusta 92',
    lengthFt: 92,
    guests: 12,
    image: MC('2019/11/92_MANGUSTA_Yacht_0001.jpg'),
    alt: 'The 92-foot Overmarine Mangusta open yacht running fast off Miami',
    blurb: 'The fast one: twin Kamewa waterjets and 37 knots in a low, open Italian hull, with four cabins below and a tender, jet ski and inflatable island aboard.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    included: ['Dinghy', 'Jet ski', 'Inflatable island', 'Snorkelling gear', 'Pool noodles'],
    gallery: [
      MC('2019/11/92_MANGUSTA_Yacht_0001.jpg'),
      MC('2019/11/92_MANGUSTA_Yacht_0002.jpg'),
      MC('2019/11/92_MANGUSTA_Yacht_00019.jpg'),
      MC('2019/11/92_MANGUSTA_Yacht_00021.jpg'),
      MC('2019/11/92_MANGUSTA_Yacht_00038.jpg'),
      MC('2019/11/92_MANGUSTA_Yacht_00042.jpg'),
      MC('2019/11/92_MANGUSTA_Yacht_00047.jpg'),
      MC('2019/11/92_MANGUSTA_Yacht_00055.jpg'),
    ],
  },
  {
    slug: 'azimut-71-flybridge',
    name: '71′ Azimut',
    builder: 'Azimut 71 Flybridge (2012)',
    lengthFt: 71,
    guests: 12,
    image: BG71('20231122073654656'),
    alt: 'FYI’s 2012 Azimut 71 Flybridge, available for charter and for sale in Miami',
    blurb: 'Four cabins, a full flybridge and an 18-foot beam — FYI’s own boat, listed for sale with us and out on charter between showings.',
    rates: [],
    availability: 'Rates on request through the charter desk — also for sale',
    gallery: [
      BG71('20231122073654656'),
      BG71('20231122073636617'),
      BG71('20231122073637612'),
      BG71('20231122073646682'),
      BG71('20231122073656617'),
    ],
  },
  {
    slug: 'azimut-62',
    name: '62′ Azimut',
    builder: 'Azimut 62 (2010)',
    lengthFt: 62,
    guests: 6,
    image: MC('2019/11/3746brochure1.png'),
    alt: 'The 62-foot Azimut charter yacht on Biscayne Bay',
    blurb: 'The quick, private option — three cabins, 26 knots of cruise, and the right size for six who would rather not share the boat.',
    rates: [],
    availability: 'Rates on request through the charter desk',
    gallery: [
      MC('2019/11/3746brochure1.png'),
      MC('2019/11/3746brochure2.jpg'),
      MC('2019/11/3746brochure3.jpg'),
      MC('2019/11/3746brochure4.jpg'),
      MC('2019/11/3746brochure5.jpg'),
      MC('2019/11/3746brochure6.jpg'),
      MC('2019/11/3746brochure9.jpg'),
      MC('2019/11/3746brochure10.jpg'),
    ],
  },
];


/* --------------------------------------------- term charter (multi-day) */

export interface TermCharterRate {
  region: string;
  weekly: string;
  daily: string;
}

export interface TermCharterVessel extends Omit<CharterVessel, 'rates'> {
  terms: TermCharterRate[];
}

/** No term charter is published today — see WITHHELD_TERM_CHARTER. */
export const TERM_CHARTER: TermCharterVessel[] = [];

export const WITHHELD_TERM_CHARTER: TermCharterVessel[] = [
  {
    slug: 'riva-92-privilegio',
    name: '92′ Riva Privilegio',
    builder: 'Riva 92 Privilegio',
    lengthFt: 92,
    guests: 13,
    image: IMG('2023/11/92-ft-riva-privilegio-4.jpg'),
    alt: 'The 92-foot Riva Privilegio underway, the flagship of FYI’s term-charter programme',
    blurb: 'The most recognisable name on the water, and the one that goes furthest — a full week through the Bahamas, or a day out of Nassau or Miami.',
    terms: [
      { region: 'Bahamas', weekly: '$35,000 plus VAT and 40% APA', daily: '$6,500 / 8 hours plus VAT and gratuity' },
      { region: 'Miami', weekly: '$25,000 plus taxes and 40% APA', daily: '$4,900 / 8 hours plus taxes and gratuity' },
    ],
    gallery: [
      IMG('2023/11/92-ft-riva-privilegio-4.jpg'),
      IMG('2023/11/92-ft-riva-privilegio-6.jpg'),
      IMG('2023/11/92-ft-riva-privilegio-10.jpg'),
      IMG('2023/11/92-ft-riva-privilegio-11.jpg'),
      IMG('2023/11/92-ft-riva-privilegio-15.jpg'),
      IMG('2023/11/92-ft-riva-privilegio-17.jpg'),
      IMG('2023/11/92-ft-riva-privilegio-21.jpg'),
      IMG('2023/11/92-ft-riva-privilegio-23.jpg'),
    ],
  },
];

/** APA is jargon; explain it wherever the term rates appear. */
export const APA_NOTE =
  'APA (Advance Provisioning Allowance) is a deposit — typically 40% of the charter fee — covering fuel, provisioning, dockage, and similar running costs. Whatever is unspent is returned to you at the end of the charter.';

/** Lowest published rate across the fleet — powers the "from $X" copy.
 *  XTREME's Mon–Thu 4-hour rate (2026-10-01); before that the 105′ Azimut's $7,000,
 *  it was the 50′ Azimut's $2,280 while the smaller boats were listed. */
export const CHARTER_FROM_PRICE = '$5,500';

export const fromRate = (v: CharterVessel): string =>
  v.rates.length ? `from ${v.rates[0].price} / ${v.rates[0].hours}` : 'Rates on request';

/** Every vessel on the page, for per-vessel routes and the prerender. */
export const ALL_CHARTER_VESSELS: (CharterVessel | TermCharterVessel)[] = [
  ...CHARTER_FLEET,
  ...TERM_CHARTER,
  ...CHARTER_ON_REQUEST,
];

export const isTermVessel = (v: CharterVessel | TermCharterVessel): v is TermCharterVessel =>
  Array.isArray((v as TermCharterVessel).terms);

export function findCharterVessel(slug: string): CharterVessel | TermCharterVessel | undefined {
  return ALL_CHARTER_VESSELS.find(v => v.slug === slug);
}
