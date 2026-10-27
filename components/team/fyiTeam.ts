// FYI Yachts broker roster for the portal team pages. Curated from the
// fyiyachts.com "Our Team" page (2026-07-15) plus active listing brokers the
// site page misses (Arney Mendez, Joel Gomes). Listing counts come live from
// /api/team/data, matched on a loose name key — `feedName` overrides the
// match when the feed spells a name differently than the website.
//
// Photos: standardized marine headshots (2026-07-22, from FYI via Drive)
// served from /public/team/*.webp — 800px, ~50KB each. Note: the Drive
// file arney-mendez-marine.png was actually Ricardo Llorente — reassigned
// 2026-07-22; Arney's card uses his 2024 bucket portrait (already square).
// Ralph Navarro and Gala Tressler await standardized shots and keep
// their original bucket photos.
//
// `languages` is hand-maintained: the website has no per-broker language data,
// so entries default to English until FYI supplies each broker's list — edit
// here and redeploy. FYI supplied the bilingual roster on 2026-08-21 (Ariel
// Alvarez: "some of the yacht consultants are bilingual, but their profiles
// only list English"), which is where every Spanish entry below comes from,
// plus Joel Gomes's Portuguese and German. The five still listed as English
// only were not on that list — confirm before adding to them, since this drives
// what a buyer is told about a named colleague.

export interface TeamMember {
  slug: string;
  name: string;
  feedName?: string;      // SalesRep.Name in the BoatsGroup feed, if different
  title: string;
  region?: string;        // as shown on the website team page
  languages: string[];
  photo?: string;
  bioUrl?: string;
  /**
   * Closed sales this consultant has that are NOT in the sold gallery — private
   * transactions with no public listing behind them. Supplied by FYI.
   *
   * The gallery is built from sold listings in the BoatsGroup feed, so it can
   * only show deals that had a public listing under this rep's name. Sabrina
   * Cuesta had 1 there against the 10 FYI counts (2026-08-21).
   *
   * Renders as a final tile in the sold grid — "plus N additional recent
   * private sales" — rather than as a headline number, so the count sits with
   * the boats it belongs to and reads as what it is (client, 2026-08-21).
   *
   * Set it only from a figure FYI has given you.
   */
  additionalPrivateSales?: number;
  /** Direct inbox; profile pages show it instead of sales@fyiyachts.com when set. */
  email?: string;
  /** Direct line, display form; profile pages show it instead of the office number when set. */
  phone?: string;
}

/**
 * Declaration order IS the display order on /our-team — leadership first, then
 * the rest of the roster. Client-specified (2026-07-27): Ralph, Raul, Ricardo
 * lead. Do not re-sort this by listing counts; those move with the feed and the
 * roster would reshuffle itself between visits.
 */
export const FYI_TEAM: TeamMember[] = [
  {
    slug: 'ralph-navarro',
    name: 'Ralph Navarro',
    title: 'Founder',
    region: 'Miami, FL',
    languages: ['English', 'Spanish'],
    photo: 'https://storage.googleapis.com/fyiyachts/2025/07/Ralph-Navarro-FYI-Yachts-2-2.jpg',
    bioUrl: 'https://fyiyachts.com/ralph-navarro/',
  },
  {
    slug: 'raul-faget',
    name: 'Raul Faget',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],
    photo: '/team/raul-faget.webp',
    bioUrl: 'https://fyiyachts.com/consultants/raul-faget/',
  },
  {
    slug: 'ricardo-llorente',
    name: 'Ricardo Llorente',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],
    photo: '/team/ricardo-llorente.webp',
    bioUrl: 'https://fyiyachts.com/consultants/ricardo-llorente/',
  },
  {
    slug: 'arney-mendez',
    name: 'Arney Mendez',
    title: 'Yacht Consultant',
    region: 'Miami, FL',
    photo: '/team/arney-mendez.webp',
    languages: ['English', 'Spanish'],
  },
  {
    slug: 'joel-gomes',
    name: 'Joel Gomes',
    title: 'Yacht Consultant',
    region: 'Miami, FL',
    languages: ['English', 'Portuguese', 'German', 'Spanish'],
    photo: '/team/joel-gomes.webp',
  },
  {
    slug: 'jose-noy',
    name: 'Jose Noy',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English'],
    photo: '/team/jose-noy.webp',
    bioUrl: 'https://fyiyachts.com/consultants/jose-noy/',
  },
  {
    slug: 'hiram-concepcion',
    name: 'Hiram Concepcion',
    feedName: 'Hiram Concepcion',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],
    photo: '/team/hiram-concepcion.webp',
    bioUrl: 'https://fyiyachts.com/consultants/hiram-conception',
  },
  {
    slug: 'alexandra-tovar',
    name: 'Alexandra Tovar',
    title: 'Yacht Consultant',
    region: 'Florida',
    photo: '/team/alexandra-tovar.webp',
    languages: ['English', 'Spanish'],
  },
  {
    slug: 'gala-tressler',
    name: 'Gala Tressler',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English'],
    photo: 'https://storage.googleapis.com/fyiyachts/2022/06/gala-tressler.jpg',
    bioUrl: 'https://fyiyachts.com/consultants/gala-tressler/',
  },
  {
    slug: 'kevin-merida',
    name: 'Kevin Merida',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English'],
    photo: '/team/kevin-merida.webp',
    bioUrl: 'https://fyiyachts.com/consultants/kevin-merida/',
  },
  {
    slug: 'sabrina-cuesta',
    name: 'Sabrina Cuesta',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],   // confirmed by FYI, 2026-08-21
    additionalPrivateSales: 10,          // FYI, 2026-08-21; the feed carries 1
    photo: '/team/sabrina-cuesta.webp',
    bioUrl: 'https://fyiyachts.com/consultants/sabrina-cuesta/',
  },
  {
    slug: 'andrea-mont',
    name: 'Andrea Mont',
    title: 'Yacht Consultant',
    region: 'Cancun, MX · Miami, FL',
    languages: ['English', 'Spanish'],
    photo: '/team/andrea-mont.webp',
    bioUrl: 'https://fyiyachts.com/andrea-mont-2/',
  },
  {
    slug: 'amner-pereira',
    name: 'Amner Pereira',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],
    photo: '/team/amner-pereira.webp',
    bioUrl: 'https://fyiyachts.com/consultants/amner-pereira/',
  },
  {
    slug: 'ariel-alvarez',
    name: 'Ariel Alvarez',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],
    photo: '/team/ariel-alvarez.webp',
  },
  {
    slug: 'selcuk-miller',
    name: 'Selcuk Miller',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English'],
    photo: '/team/selcuk-miller.webp',
    bioUrl: 'https://fyiyachts.com/consultants/selcuk-miller/',
  },
  {
    slug: 'giovanni-tummolillo',
    name: 'Giovanni Tummolillo',
    title: 'Yacht Consultant',
    region: 'Florida',
    // "Gio speaks spanish english & italian" (FYI, 2026-08-21). English stays
    // first for consistency with the rest of the roster on an English-language
    // site; Spanish ahead of Italian is the order FYI emphasised.
    languages: ['English', 'Spanish', 'Italian'],
    photo: '/team/giovanni-tummolillo.webp',
    bioUrl: 'https://fyiyachts.com/fyi-giovanni-tummolillo/',
  },
  {
    slug: 'maria-palacios',
    name: 'Maria Palacios',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],
    photo: '/team/maria-palacios.webp',
    bioUrl: 'https://fyiyachts.com/maria-palacios/',
  },
  {
    // Added 2026-08-12; headshot supplied 2026-08-20 (standardized 800×800
    // like the rest of the roster).
    slug: 'roman-joa',
    name: 'Roman Joa',
    title: 'Yacht Consultant',
    region: 'Florida',
    languages: ['English', 'Spanish'],
    photo: '/team/roman-joa.webp',
  },
  {
    slug: 'dante-de-rosa',
    name: 'Dante De Rosa',
    title: 'Yacht Consultant Assistant',
    region: 'Florida',
    languages: ['English'],
    photo: '/team/dante-de-rosa.webp',
    email: 'dante@fyiyachts.com',
    phone: '+1 (305) 799-7008',
  },
];

/** tel: href for a display-form phone number ("+1 (305) 799-7008" → "tel:+13057997008"). */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

// Same loose key the API uses, so roster names match feed SalesRep names
// despite spelling drift ("Concepcion" vs "Conception").
export const repKey = (name: string): string =>
  name.toLowerCase().replace(/[^a-z]/g, '').replace(/tion$/, 'cion');

export const memberByRepKey = new Map<string, TeamMember>(
  FYI_TEAM.map((m) => [repKey(m.feedName || m.name), m]),
);

export const memberBySlug = new Map<string, TeamMember>(FYI_TEAM.map((m) => [m.slug, m]));
