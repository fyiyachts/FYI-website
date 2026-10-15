// Client results / case studies.
//
// ⚠️ EVERY FACT ON THIS PAGE IS SOURCED. Each entry's `source` is the slug of
// FYI's own published closing announcement in the migrated news archive
// (public/news/<slug>.json — read the article before editing an entry). The
// vessel, the year, the dimensions, the named consultants, which side each
// consultant represented, and the asking price at the time of sale all come
// from those announcements.
//
// DO NOT ADD:
//   - a final sale price (we publish the last asking price, which is what the
//     announcements state — the two are not the same number and implying they
//     are is a misrepresentation),
//   - days on market, offer counts, or "sold above asking"-style claims,
//   - buyer or seller quotes,
//   - any entry without a published FYI source to point at.
// New entries come from a new announcement, or from the client in writing.
// See the brain: `60-playbooks/Website Setup Standard` §8 Content integrity.
//
// Plain data only (no JSX) so the prerender's esbuild bundle can import it.

export interface CaseStudy {
  slug: string;
  /** Vessel as FYI announced it. */
  vessel: string;
  year: number;
  builder: string;
  /** One-line framing of what the transaction actually required. */
  headline: string;
  /** Market segment, for the filter chips and the schema. */
  segment: 'Sportfish' | 'Motor Yacht' | 'High Performance';
  location: string;
  /** Last asking price at the time of sale, verbatim from the announcement. */
  askingAtSale?: string;
  /** Consultants, with the side each represented — exactly as announced. */
  represented: { name: string; slug: string; side: string }[];
  /** Vessel facts from the announcement. */
  specs: [string, string][];
  /** Narrative — every sentence traceable to the announcement or to how FYI works. */
  body: string[];
  /** Slug of the source announcement in the news archive. */
  source: string;
  sourceDate: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'bertram-63-sportfish-madame-boos',
    vessel: 'MADAME BOOS',
    year: 2012,
    builder: 'Bertram',
    headline: 'Both sides of a $1.449M sportfish, handled by one consultant',
    segment: 'Sportfish',
    location: 'Miami, Florida',
    askingAtSale: '$1,449,000',
    represented: [{ name: 'Ricardo Llorente', slug: 'ricardo-llorente', side: 'represented both the seller and the buyer' }],
    specs: [
      ['Length overall', '66′9″'],
      ['Beam', '18′1″'],
      ['Staterooms', '3 (sleeps 6)'],
      ['Heads', '3'],
      ['Asking at time of sale', '$1,449,000'],
    ],
    body: [
      'A 63′ Bertram sport fish is a serious boat with a narrow buyer pool — the people who want one know exactly what they want, and they are not shopping on price alone. MADAME BOOS came to market in Miami with three staterooms, three heads, and a cockpit set up for real offshore fishing: deep storage and current fish-finding electronics rather than a flybridge dressed up for the sandbar.',
      'Ricardo Llorente represented both the seller and the buyer on this transaction. Dual representation is the hardest version of this job — it only works when both sides trust that the consultant is reading the market honestly rather than steering, and it collapses the moment either side suspects otherwise. It is also the fastest path to a close when it does work, because there is no second brokerage adding a day to every question.',
      'The vessel sold at a last asking price of $1,449,000, with FYI’s in-house closing team handling escrow, documentation, titling, and registration.',
    ],
    source: '2012-63-bertram-sportfish-sold-by-ricardo-llorente',
    sourceDate: '2024-06-21',
  },
  {
    slug: 'cigarette-42-auroris',
    vessel: '42′ Cigarette Auroris',
    year: 2022,
    builder: 'Cigarette Racing',
    headline: 'Two FYI consultants, one on each side of a near-new Cigarette',
    segment: 'High Performance',
    location: 'Miami, Florida',
    represented: [
      { name: 'Arney Mendez', slug: 'arney-mendez', side: 'represented the buyer' },
      { name: 'Ricardo Llorente', slug: 'ricardo-llorente', side: 'represented the seller' },
    ],
    specs: [
      ['Power', 'Five 450hp Mercury engines'],
      ['Beam', '11′11″'],
      ['Electronics', 'Three Garmin 8617 chart plotters, CNC-cut aluminum helm panel'],
      ['Systems', 'Digital switching controlled from the Garmin displays'],
    ],
    body: [
      'A two-year-old Cigarette Auroris is not a boat you sell on specifications alone — the market for a five-engine, 42-foot high-performance hull is small, informed, and largely known to each other. Getting the right buyer in front of the right boat matters more than the listing itself.',
      'Both sides of this transaction were FYI consultants: Arney Mendez represented the buyer and Ricardo Llorente represented the seller. That is a good illustration of what a deep bench is actually for — the buyer got genuine independent representation, and the seller’s consultant still had a qualified, motivated party at the table rather than a cold market.',
      'The boat was fully current on the things that matter to this buyer: five 450hp Mercuries, three Garmin 8617 plotters set into a CNC-cut aluminum panel with a nano-coating that survives heat and fingerprints, and a digital switching system running the whole vessel from the Garmin displays.',
    ],
    source: '2022-42-cigarette-auroris-sold-by-arney-mendez-ricardo-llorente',
    sourceDate: '2024-07-11',
  },
  {
    slug: 'viking-56-knot-normal',
    vessel: 'KNOT NORMAL',
    year: 2007,
    builder: 'Viking',
    headline: 'Selling a 17-year-old Viking into a market that knows the model cold',
    segment: 'Sportfish',
    location: 'Miami, Florida',
    askingAtSale: '$899,000',
    represented: [{ name: 'Raul Faget', slug: 'raul-faget', side: 'represented the seller' }],
    specs: [
      ['Length overall', '57′6″'],
      ['Beam', '18′2″'],
      ['Staterooms', '3 (sleeps 6)'],
      ['Heads', '2'],
      ['Asking at time of sale', '$899,000'],
    ],
    body: [
      'Viking’s 56 Enclosed Bridge is one of the most thoroughly understood boats in the sportfish market. Buyers know the model’s history, its weak points, and roughly what a good one is worth — which means a seller cannot price on optimism, and a well-kept hull has to be presented well enough to prove it is one of the good ones.',
      'Raul Faget, a licensed FYI Yachts consultant, represented the seller. KNOT NORMAL was a three-stateroom, two-head layout sleeping six, with a cockpit built for serious fishing — real storage and current fish-finding electronics — and a galley and salon that made it liveable for more than a day trip.',
      'The vessel was located in Miami and carried a last asking price of $899,000 at the time of sale.',
    ],
    source: '2007-56-viking-enclosed-bridge-sold-by-raul-faget-at-fyi-yachts',
    sourceDate: '2024-08-19',
  },
  {
    slug: 'riviera-51-enclosed-bridge',
    vessel: '2008 Riviera 51 Enclosed Bridge',
    year: 2008,
    builder: 'Riviera',
    headline: 'A mid-size sportfish that drew multiple qualified buyers',
    segment: 'Sportfish',
    location: 'Miami, Florida',
    represented: [{ name: 'Arney Mendez', slug: 'arney-mendez', side: 'represented the vessel' }],
    specs: [
      ['Beam', '16′2″'],
      ['Staterooms', '3'],
      ['Heads', '2'],
      ['Power', 'Twin Caterpillar C18 1015HP'],
      ['Flybridge', 'Enclosed and air-conditioned'],
    ],
    body: [
      'The Riviera 51 Enclosed Bridge sits in the part of the market where cruising families and serious offshore anglers overlap — which widens the buyer pool but also means the boat has to answer two different sets of questions on the same viewing.',
      'FYI announced this sale as one that drew significant interest from qualified buyers, with Arney Mendez representing the vessel. The specification is a large part of why: an enclosed, air-conditioned flybridge makes the boat usable in South Florida weather year-round, and twin Caterpillar C18 1015HP engines give it cruising speeds up to 30 knots.',
      'Built by Riviera in Australia, the 51 is a standout in the mid-size sportfish category precisely because it refuses to specialise — performance, fishability, and genuine liveaboard comfort in one 51-foot convertible.',
    ],
    source: 'sold-2008-riviera-51-enclosed-bridge-in-miami-fyi-yachts',
    sourceDate: '2025-07-29',
  },
  {
    slug: 'palmer-johnson-80-zooom',
    vessel: 'ZOOOM',
    year: 1993,
    builder: 'Palmer Johnson',
    headline: 'Two consultants placing an 80′ classic with the right owner',
    segment: 'Motor Yacht',
    location: 'United States',
    askingAtSale: '$452,000',
    represented: [
      { name: 'Giovanni Tummolillo', slug: 'giovanni-tummolillo', side: 'co-brokered the sale' },
      { name: 'Ralph Navarro', slug: 'ralph-navarro', side: 'co-brokered the sale' },
    ],
    specs: [
      ['Length overall', '80′'],
      ['Builder', 'Palmer Johnson'],
      ['Year', '1993'],
      ['Asking at time of sale', '$452,000'],
    ],
    body: [
      'An 80-foot Palmer Johnson from 1993 is a different proposition to a late-model production yacht. The build quality is not in question — Palmer Johnson’s reputation is why the boat is still desirable three decades on — but the buyer has to be someone who understands what owning a yacht of that vintage involves, and who values the hull and the craftsmanship over a warranty.',
      'Giovanni Tummolillo and Ralph Navarro of FYI Yachts co-brokered the sale of ZOOOM, an 80′ yacht with a classic exterior, spacious deck layout, and an interior laid out around multiple cabins and a well-appointed salon. The vessel was located in the United States at the time of sale, which materially widened its appeal to buyers in the region.',
      'ZOOOM sold at a last asking price of $452,000, closing out its listing period.',
    ],
    source: 'fyi-yachts-sells-80-palmer-johnson-zooom-for-452000',
    sourceDate: '2025-05-29',
  },
];

export const CASE_STUDY_SEGMENTS = ['Sportfish', 'Motor Yacht', 'High Performance'] as const;

export const getCaseStudy = (slug: string): CaseStudy | undefined =>
  CASE_STUDIES.find((c) => c.slug === slug);
