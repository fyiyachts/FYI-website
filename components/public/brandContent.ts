// Rich, per-brand editorial content for the /<brand>-yachts-for-sale pages.
//
// The live fyiyachts.com brand pages carry a deep SEO layout — brand intro,
// "what sets it apart", a model lineup, browse-by-size/year, an FAQ block, and
// a closing CTA. This module reproduces that depth (and then some) for every
// builder in BRAND_PAGES, without thin/duplicate copy: each brand supplies a
// compact set of FACTS (country, founding year, size range, signature
// strengths, model lines) and a generator weaves those facts into distinct
// prose + a 5-question FAQ. Flagship brands add hand-written overrides and an
// official brand film.
//
// JSX-free on purpose: both the React pages (PublicPages.tsx) and the
// build-time prerender (scripts/seoData.ts, esbuild-bundled with no JSX
// loader) import getBrandDetail from here so the rendered page and the
// crawler-facing static HTML/JSON-LD stay in lockstep.
import type { QA } from './faqData';

export interface BrandModel { name: string; note?: string }

// Compact authored facts per brand. Everything except country/known/strengths
// is optional; the generator fills the rest.
export interface BrandFacts {
  country: string;
  founded?: number;         // boatbuilding heritage year, when well-established
  sizeRange?: string;       // e.g. "34–120 ft"
  hull?: string;            // hull/engineering one-liner
  known: string;            // lowercase noun phrase: "hand-built British performance motor yachts"
  strengths: string[];      // 3–5 short differentiators
  models?: BrandModel[];    // model lines / ranges
  video?: string;           // YouTube id of an official brand film
  // deep overrides (flagship brands)
  tagline?: string;
  intro?: string[];
  apart?: string;
  faqs?: QA[];
  closing?: string;
}

// The fully-resolved shape the page renders.
export interface BrandDetail {
  tagline: string;
  intro: string[];
  apart: string;
  apartPoints: string[];
  models: BrandModel[];
  uses: { title: string; body: string }[];
  build: string;
  faqs: QA[];
  video?: string;
  closing: string;
  country: string;
  founded?: number;
  sizeRange?: string;
}

const PHONE = '305-854-6020';
const YEAR = 2026;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const listPhrase = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

function genIntro(name: string, f: BrandFacts): string[] {
  if (f.intro) return f.intro;
  const origin = f.founded
    ? `Building in ${f.country} since ${f.founded} — ${YEAR - f.founded}+ years of heritage — `
    : `Building in ${f.country}, `;
  const range = f.sizeRange ? ` The current range spans ${f.sizeRange}.` : '';
  return [
    `${origin}${name} has built its name on ${f.known}. The yard pairs ${listPhrase(f.strengths.slice(0, 2))} into boats that perform as well as they present.${range}`,
    `FYI Yachts represents ${name} buyers and sellers from Miami, with direct access to on-market and quietly-available vessels worldwide. Whether you're stepping into your first ${name} or moving up the range, our specialists know these boats hull-by-hull — the layouts that hold value, the model years worth chasing, and the survey points that matter. Browse the live ${name} inventory below, or tell us what you're after and we'll source it.`,
  ];
}

function genApart(name: string, f: BrandFacts): string {
  if (f.apart) return f.apart;
  return `${name} yachts are known not just for how they look but for how they're engineered. ${cap(listPhrase(f.strengths))} — every hull carries the hallmarks that make the marque worth owning and easy to resell.`;
}

function genFaqs(name: string, f: BrandFacts): QA[] {
  if (f.faqs) return f.faqs;
  const built = f.founded
    ? `${name} yachts are built in ${f.country}, where the marque has been in business since ${f.founded}.`
    : `${name} yachts are built in ${f.country}.`;
  const modelLine = f.models && f.models.length
    ? ` The lineup includes the ${listPhrase(f.models.slice(0, 6).map(m => m.name))} ${f.models.length > 1 ? 'ranges' : 'range'}.`
    : '';
  const sizes = f.sizeRange ? `The ${name} range spans ${f.sizeRange}.` : `${name} builds across a broad range of sizes.`;
  return [
    { q: `What sets ${name} apart from other luxury yacht brands?`, a: genApart(name, f) },
    { q: `Where are ${name} yachts built, and who builds them?`, a: `${built}${modelLine}` },
    { q: `What sizes do ${name} yachts come in?`, a: `${sizes} A specialist can help you match the right size and layout to how — and where — you plan to run the boat.` },
    { q: `How do I find the right ${name} for sale?`, a: `Start with how you'll use it — day cruising, overnighting, entertaining, or fishing — then weigh size, layout, model year, and equipment. FYI's ${name} specialists compare live listings against recent comparable sales so you buy the right hull at the right number. Call ${PHONE} to get started.` },
    { q: `Does FYI Yachts sell new and used ${name} yachts?`, a: `Yes. As a Miami brokerage with worldwide reach, FYI represents both new and pre-owned ${name} yachts for sale, and can source vessels that aren't yet publicly listed. Browse the live inventory above or call ${PHONE}.` },
  ];
}

function genUses(name: string): { title: string; body: string }[] {
  return [
    { title: 'Overnight cruising', body: `Well-appointed cabins, full galleys, and practical layouts make longer passages aboard a ${name} a pleasure rather than a compromise.` },
    { title: 'Day cruising & entertaining', body: `Expansive lounges, sun pads, and open aft decks make ${name} yachts a natural fit for sandbar days, sunset runs, and hosting on the water.` },
    { title: 'Owning with confidence', body: `Strong brand demand and FYI's local market data mean a well-kept ${name} holds its value — and our team handles survey, closing, and documentation end to end.` },
  ];
}

function genBuild(name: string, f: BrandFacts): string {
  const hull = f.hull
    ? `${cap(f.hull)}`
    : `Carefully engineered hulls — deep-V, modified-V, or planing depending on the model`;
  return `${hull} give ${name} yachts their blend of stability, efficiency, and ride quality. Most models are built with advanced fibreglass and composite laminates for strength without excess weight, and offer a range of engine and drive configurations to suit how you cruise. FYI's specialists know which options matter for resale and which are worth paying for.`;
}

const FACTS: Record<string, BrandFacts> = {
  azimut: {
    country: 'Italy', founded: 1969, sizeRange: "34 to 120 feet",
    known: 'avant-garde Italian flybridge and megayacht design',
    hull: 'Carbon-fibre superstructures and finely-tuned planing hulls',
    strengths: ['carbon-fibre construction that cuts weight and raises stability', 'class-leading interior volume for the length', 'signature wide-body main decks', 'floor-to-ceiling glazing few builders match'],
    models: [
      { name: 'Seadeck', note: 'hybrid-ready, beach-club living' },
      { name: 'Verve', note: 'sporty walkaround dayboats' },
      { name: 'Atlantis', note: 'sport coupé cruisers' },
      { name: 'Fly', note: 'the flagship flybridge range, 50–78ft' },
      { name: 'S Collection', note: 'sport-coupé performance' },
      { name: 'Magellano', note: 'long-range semi-displacement' },
      { name: 'Grande', note: 'the 25–38m megayacht line' },
    ],
    video: 'nD31Nv69he0',
    tagline: 'Discover the latest Azimut models on the market — Italian design, innovation, and style, represented worldwide by FYI Yachts.',
    intro: [
      'Azimut represents the pinnacle of Italian yacht design: state-of-the-art styling wrapped around genuine engineering, delivering comfort, safety, and volume without compromising power or performance. Since 1969 the yard — part of the Azimut-Benetti Group, the world’s largest private yacht builder — has offered something for every owner, from sporty dayboats to 38-metre megayachts.',
      'What makes an Azimut an Azimut is the combination few builders pull off: carbon-fibre superstructures that keep weight low and stability high, class-leading interior volume, and the floor-to-ceiling glazing that floods the saloon with light. FYI Yachts represents Azimut buyers and sellers from Miami — browse the live inventory below, or ask us to source the exact model, year, and layout you’re after.',
    ],
  },
  sunseeker: {
    country: 'Poole, England', founded: 1969, sizeRange: "38 to 161 feet",
    known: 'hand-built British performance motor yachts',
    hull: 'Deep-V hulls tuned for a fast, dry, sea-kindly ride',
    strengths: ['deep-V hulls tuned for a fast, dry ride', 'hand-finished British joinery', 'muscular, unmistakable exterior styling', 'engineering built for real open-water passages'],
    models: [
      { name: 'Predator', note: 'sport yachts with retractable hardtops' },
      { name: 'Manhattan', note: 'family flybridge cruisers' },
      { name: 'Ocean', note: 'long-range flybridge yachts' },
      { name: 'Sport Yacht', note: '65–90ft performance range' },
      { name: 'Superyacht', note: '100ft and above' },
    ],
    video: '6Bzf3qzXSy0',
  },
  benetti: {
    country: 'Viareggio & Livorno, Italy', founded: 1873, sizeRange: "95 to 330+ feet",
    known: 'custom and semi-custom displacement superyachts',
    hull: 'Steel and aluminium displacement hulls for ocean-crossing range',
    strengths: ['a 150-year custom-build pedigree', 'in-house naval architecture and styling', 'ocean-crossing range and stability', 'fully bespoke interiors'],
    models: [
      { name: 'Motopanfilo', note: 'the reborn classic 37–40m line' },
      { name: 'Oasis', note: 'beach-life-focused 34–40m yachts' },
      { name: 'B.Yond', note: 'explorer-style displacement yachts' },
      { name: 'Diamond', note: 'semi-custom composite flagships' },
      { name: 'Custom', note: 'fully bespoke steel & alloy giga-yachts' },
    ],
  },
  'ferretti yachts': {
    country: 'Forlì, Italy', founded: 1968, sizeRange: "50 to 110 feet",
    known: 'flybridge motor yachts engineered in Italy',
    hull: 'Deep-V planing hulls with proprietary anti-roll technology',
    strengths: ['proprietary anti-roll gyro stabilisation', 'balanced flybridge layouts', 'Italian interior design by ateliers like Ideaeurope', 'strong resale demand worldwide'],
    models: [
      { name: 'Ferretti 500', note: 'the compact flybridge' },
      { name: 'Ferretti 720 / 860', note: 'mid-range flagships' },
      { name: 'Ferretti 1000', note: 'the 30m flagship' },
      { name: 'INFYNITO', note: 'the eco-minded long-range line' },
    ],
  },
  pershing: {
    country: 'Mondolfo, Italy', founded: 1985, sizeRange: "50 to 140 feet",
    known: 'open coupé performance yachts',
    hull: 'Slippery planing hulls with surface drives and waterjets for 40+ knots',
    strengths: ['40+ knot performance', 'low, aggressive coupé profiles', 'surface-drive and waterjet propulsion', 'carbon-fibre construction on the flagships'],
    models: [
      { name: 'Pershing 5X / 6X', note: 'the compact performance coupés' },
      { name: 'Pershing 7X / 8X', note: 'the mid-range flagships' },
      { name: 'GTX', note: 'the sport-utility crossover range' },
    ],
    video: 'up0iMlY6rYg',
  },
  riva: {
    country: 'Sarnico, Italy', founded: 1842, sizeRange: "27 to 164 feet",
    known: 'the most iconic runabouts and flybridge yachts on the water',
    hull: 'From mahogany runabout heritage to modern composite planing hulls',
    strengths: ['the most iconic name in yachting', 'jewel-like fit and finish', 'timeless, instantly-recognisable lines', 'a range from 27ft runabouts to 50m flagships'],
    models: [
      { name: 'Iseo / Aquariva', note: 'the legendary runabouts' },
      { name: 'Rivamare', note: 'the 38ft open dayboat' },
      { name: 'Dolceriva / Elégante', note: 'open and coupé sport yachts' },
      { name: '68′ Diable / 76′ Bahamas', note: 'sport flybridge yachts' },
      { name: '130′ Bellissima', note: 'the tri-deck flagship' },
    ],
    video: 'OxTQrL_BDg8',
  },
  princess: {
    country: 'Plymouth, England', founded: 1965, sizeRange: "35 to 130 feet",
    known: 'British flybridge, V-Class, and X-Class yachts',
    hull: 'Deep-V hulls developed with Bernard Olesinski for a superb ride',
    strengths: ['Olesinski deep-V hull design', 'in-house composite and joinery craftsmanship', 'the innovative X-Class “super flybridge” layout', 'exceptional build quality and finish'],
    models: [
      { name: 'V-Class', note: 'sport yachts' },
      { name: 'F-Class', note: 'flybridge yachts' },
      { name: 'S-Class', note: 'sportbridge crossovers' },
      { name: 'X-Class', note: 'the volume-maximising super-flybridge line' },
      { name: 'M-Class', note: 'the 30m+ superyachts' },
    ],
    video: 'oRVlNv-kxyY',
  },
  'sea ray': {
    country: 'United States', founded: 1959, sizeRange: "19 to 40 feet",
    known: 'America’s best-known sport boats and cruisers',
    strengths: ['unmatched dealer and parts support', 'proven, easy-to-own designs', 'strong resale liquidity', 'a model for nearly every use'],
    models: [
      { name: 'SPX', note: 'sport boats' },
      { name: 'SLX', note: 'luxury bowriders' },
      { name: 'Sundancer', note: 'the classic express cruisers' },
      { name: 'SLX-R', note: 'the performance flagships' },
    ],
  },
  hatteras: {
    country: 'New Bern, North Carolina', founded: 1959, sizeRange: "45 to 105 feet",
    known: 'legendary convertibles and motor yachts built for blue water',
    hull: 'Heavily-built deep-V hulls engineered for offshore fishing',
    strengths: ['blue-water build strength', 'sportfishing pedigree', 'long-range motor-yacht comfort', 'a devoted owner community'],
    models: [
      { name: 'GT Series', note: 'the convertible sportfishers' },
      { name: 'M Series', note: 'the modern motor yachts' },
    ],
  },
  sanlorenzo: {
    country: 'La Spezia, Italy', founded: 1958, sizeRange: "78 to 200+ feet",
    known: 'made-to-measure Italian yachts',
    strengths: ['one-owner, one-yacht bespoke philosophy', 'asymmetric-deck innovation', 'restrained, architectural styling', 'displacement and planing lines'],
    models: [
      { name: 'SL', note: 'planing flybridge yachts' },
      { name: 'SD', note: 'semi-displacement crossovers' },
      { name: 'SX', note: 'the crossover SUV-of-the-sea line' },
      { name: 'SP', note: 'the high-performance sportfly range' },
      { name: 'Alloy', note: 'the 40m+ aluminium superyachts' },
    ],
  },
  okean: {
    country: 'Itajaí, Brazil', founded: 2015, sizeRange: "50 to 80 feet",
    known: 'fast-displacement yachts with vast single-level living',
    hull: 'Efficient fast-displacement hulls with wide, stable beams',
    strengths: ['single-level main-deck living', 'huge opening glass and fold-out balconies', 'fuel-efficient fast-displacement hulls', 'exceptional volume for the length'],
    models: [
      { name: 'OKEAN 50', note: 'the compact flagship-feel yacht' },
      { name: 'OKEAN 55', note: 'the best-selling mid-size' },
      { name: 'OKEAN 80', note: 'the tri-level flagship' },
    ],
  },
  rizzardi: {
    country: 'Naples, Italy', sizeRange: "50 to 75 feet",
    known: 'Italian sport yachts built for Mediterranean pace',
    strengths: ['sporty, performance-first hulls', 'clean Italian styling', 'hand-built limited production', 'strong open-water manners'],
    models: [
      { name: 'IN Series', note: 'the sport-cruiser range' },
      { name: 'GR Series', note: 'the flybridge yachts' },
      { name: 'Zero', note: 'the flagship open' },
    ],
  },
  cigarette: {
    country: 'Opa-locka, Florida', founded: 1969, sizeRange: "32 to 59 feet",
    known: 'the original Miami high-performance powerboats',
    hull: 'Race-bred deep-V hulls built for offshore speed',
    strengths: ['offshore racing heritage since 1969', 'AMG-collaboration styling and engineering', 'hand-laid, no-compromise construction', 'the definitive Miami performance icon'],
    models: [
      { name: 'Tirranna', note: 'the luxury sport crossover' },
      { name: 'Top Gun', note: 'the flagship center console' },
      { name: 'Nighthawk', note: 'the modern race-boat lineage' },
      { name: 'Huntress', note: 'the fishing-focused range' },
    ],
  },
  lazzara: {
    country: 'Tampa, Florida', founded: 1990, sizeRange: "68 to 116 feet",
    known: 'Florida-built luxury motor yachts with open, single-level layouts',
    strengths: ['wide-open single-level main decks', 'American-built quality', 'innovative UHV (Ultra High Volume) layouts', 'owner-friendly engineering access'],
    models: [
      { name: 'LSX', note: 'the sport-yacht line' },
      { name: 'UHV', note: 'the Ultra High Volume motor yachts' },
    ],
  },
  majesty: {
    country: 'United Arab Emirates', sizeRange: "62 to 175 feet",
    known: 'Gulf Craft’s flagship superyacht line with remarkable volume per foot',
    strengths: ['exceptional interior volume for the length', 'built for hot-climate cruising', 'fast semi-displacement and planing hulls', 'strong value against European rivals'],
    models: [
      { name: 'Majesty 111 / 120', note: 'the tri-deck flagships' },
      { name: 'Majesty 140 / 160 / 175', note: 'the superyacht range' },
    ],
  },
  'ocean alexander': {
    country: 'United States & Taiwan', founded: 1978, sizeRange: "70 to 135 feet",
    known: 'motoryachts prized for engineering and long-range comfort',
    strengths: ['renowned engineering and systems access', 'long-range, sea-kindly hulls', 'Evan K. Marshall interior design', 'four distinct lines for different owners'],
    models: [
      { name: 'Divergence', note: 'the coupé-styled crossovers' },
      { name: 'Explorer', note: 'long-range motor yachts' },
      { name: 'Legend', note: 'the classic flagship motoryachts' },
      { name: 'Puro', note: 'the sleek modern flagships' },
    ],
  },
  bertram: {
    country: 'Tampa, Florida', founded: 1960, sizeRange: "35 to 61 feet",
    known: 'the deep-V sportfishing pioneer',
    hull: 'The original deep-V offshore hull, refined over six decades',
    strengths: ['the boat that invented the deep-V sportfisher', 'legendary rough-water ability', 'tournament-proven fishability', 'timeless, purposeful lines'],
    models: [
      { name: 'Bertram 35', note: 'the modern classic' },
      { name: 'Bertram 50 / 61', note: 'the flagship convertibles' },
    ],
  },
  viking: {
    country: 'New Gretna, New Jersey', founded: 1964, sizeRange: "38 to 90 feet",
    known: 'the tournament standard in sportfishing yachts',
    hull: 'In-house designed and tooled convertible hulls built for speed offshore',
    strengths: ['built entirely in-house, hull to hardware', 'the tournament fishing benchmark', 'relentless year-over-year innovation', 'the Valhalla center-console sister brand'],
    models: [
      { name: 'Convertible', note: 'the flagship sportfishers, 38–90ft' },
      { name: 'Sport Tower / Sport Coupe', note: 'express fishers' },
      { name: 'Valhalla', note: 'the performance center consoles' },
    ],
  },
  streamline: {
    country: 'South Florida', sizeRange: "center-console dayboats",
    known: 'modern center consoles engineered in South Florida',
    strengths: ['clean, contemporary center-console design', 'built for Florida’s waters', 'fishing and family versatility', 'quality outboard rigging'],
  },
  intrepid: {
    country: 'Largo, Florida', founded: 1983, sizeRange: "24 to 47 feet",
    known: 'semi-custom center consoles and walkarounds built one at a time',
    hull: 'Stepped deep-V hulls with a legendary offshore ride',
    strengths: ['fully semi-custom, built to order', 'stepped deep-V hulls with a superb ride', 'obsessive fit and finish', 'strong resale value'],
    models: [
      { name: 'Center Console', note: 'the core 24–47ft range' },
      { name: 'Sport Yacht', note: 'the cabin-equipped crossovers' },
      { name: 'Valor', note: 'the flagship walkaround' },
    ],
  },
  mangusta: {
    country: 'Viareggio, Italy', founded: 1985, sizeRange: "80 to 174 feet",
    known: 'Overmarine’s open maxi yachts',
    hull: 'Waterjet-driven planing hulls for high-speed open cruising',
    strengths: ['the maxi-open segment it defined', 'waterjet propulsion and high speed', 'flush, uncluttered open decks', 'carbon and aluminium construction'],
    models: [
      { name: 'Maxi Open', note: 'the signature 80–165ft opens' },
      { name: 'GranSport', note: 'the fast-displacement crossovers' },
      { name: 'Oceano', note: 'the displacement flybridge line' },
    ],
  },
  richmond: {
    country: 'British Columbia, Canada', founded: 1998, sizeRange: "125 to 150 feet",
    known: 'tri-deck luxury yachts hand-built in the Pacific Northwest',
    strengths: ['hand-built North American quality', 'raised-pilothouse tri-deck volume', 'long-range capability', 'semi-custom interiors'],
  },
  regal: {
    country: 'Orlando, Florida', founded: 1969, sizeRange: "19 to 42 feet",
    known: 'family-owned express cruisers, bowriders, and sport yachts',
    strengths: ['family-owned since 1969', 'the FasTrac stepped-hull ride', 'strong fit and finish for the class', 'surf, cruise, and day-boat versatility'],
    models: [
      { name: 'LX / Surf', note: 'bowriders and surf boats' },
      { name: 'Express', note: 'the cruisers' },
      { name: 'Sport Coupe', note: 'the flagship day yachts' },
    ],
  },
  vandutch: {
    country: 'Netherlands', founded: 2008, sizeRange: "32 to 75 feet",
    known: 'minimalist Dutch-designed dayboats',
    hull: 'Efficient semi-displacement hulls with a signature plumb bow',
    strengths: ['the instantly-recognisable Miami Beach silhouette', 'minimalist, timeless styling', 'efficient long-range dayboat hulls', 'a design icon on any waterfront'],
    models: [
      { name: 'VanDutch 32 / 40', note: 'the core dayboats' },
      { name: 'VanDutch 48 / 56', note: 'the mid-range' },
      { name: 'VanDutch 75', note: 'the flagship' },
    ],
  },
  pursuit: {
    country: 'Fort Pierce, Florida', founded: 1977, sizeRange: "20 to 43 feet",
    known: 'offshore and dual-console boats with fit and finish above their class',
    strengths: ['premium fit and finish for the segment', 'genuine offshore capability', 'versatile dual-console and center-console layouts', 'strong resale value'],
    models: [
      { name: 'S Series', note: 'the center consoles' },
      { name: 'DC Series', note: 'the dual consoles' },
      { name: 'OS Series', note: 'the offshore sport range' },
    ],
  },
  'boston whaler': {
    country: 'Edgewater, Florida', founded: 1958, sizeRange: "11 to 42 feet",
    known: 'the unsinkable legend of American boatbuilding',
    hull: 'The foam-cored Unibond hull — famously unsinkable',
    strengths: ['the legendary unsinkable Unibond hull', 'bank-vault build quality', 'the strongest resale value in its class', 'a model from 11 to 42 feet'],
    models: [
      { name: 'Montauk', note: 'the timeless center consoles' },
      { name: 'Outrage', note: 'the offshore fishers' },
      { name: 'Conquest', note: 'the cabin fishers and cruisers' },
      { name: 'Realm', note: 'the flagship crossovers' },
    ],
  },
  marquis: {
    country: 'Pulaski, Wisconsin', founded: 2003, sizeRange: "42 to 72 feet",
    known: 'luxury sport yachts with European styling',
    strengths: ['European design, American build', 'sport-coupé and sport-bridge layouts', 'high-gloss finish quality', 'value against imported rivals'],
    models: [
      { name: 'Sport Coupe', note: 'the sleek express yachts' },
      { name: 'Sport Bridge', note: 'the flybridge range' },
    ],
  },
  prestige: {
    country: 'Les Herbiers, France', founded: 1989, sizeRange: "36 to 70 feet",
    known: 'French flybridge and coupé yachts engineered by Groupe Beneteau',
    hull: 'Efficient hulls, including IPS pod-drive configurations',
    strengths: ['clever, liveable single-level layouts', 'the resources of Groupe Beneteau', 'IPS pod-drive efficiency and handling', 'private full-beam owner suites'],
    models: [
      { name: 'F-Line', note: 'the flybridge yachts' },
      { name: 'M-Line', note: 'the multihull motor yachts' },
      { name: 'S-Line', note: 'the sport-coupé range' },
    ],
  },
  'palmer johnson': {
    country: 'Sturgeon Bay, Wisconsin', founded: 1918, sizeRange: "120 to 210 feet",
    known: 'sport yachts with unmistakable lines',
    strengths: ['the striking SuperSport profile', 'aluminium and carbon construction', 'a century of American yacht building', 'high-performance displacement hulls'],
    models: [
      { name: 'SuperSport', note: 'the signature sport-yacht series' },
    ],
  },
  westport: {
    country: 'Washington State, USA', founded: 1964, sizeRange: "112 to 172 feet",
    known: 'America’s premier semi-production superyachts',
    hull: 'Proven composite displacement hulls in tooled series production',
    strengths: ['series-built consistency and value', 'quick delivery versus full custom', 'proven, sea-kindly displacement hulls', 'strong American resale demand'],
    models: [
      { name: 'Westport 112 / 125 / 130', note: 'the core motor yachts' },
      { name: 'Westport 164 / 172', note: 'the flagship superyachts' },
    ],
  },
  heesen: {
    country: 'Oss, Netherlands', founded: 1978, sizeRange: "100 to 260 feet",
    known: 'aluminium fast-displacement superyachts',
    hull: 'Award-winning Fast Displacement Hull Form (FDHF) in aluminium',
    strengths: ['the low-resistance Fast Displacement Hull Form', 'lightweight all-aluminium construction', 'Dutch engineering and finish', 'both planing and displacement flagships'],
    models: [
      { name: 'Aluminium Class', note: 'the fast semi-displacement yachts' },
      { name: 'Steel Class', note: 'the long-range 50m+ flagships' },
    ],
  },
  maiora: {
    country: 'Viareggio, Italy', founded: 1985, sizeRange: "60 to 130 feet",
    known: 'semi-custom flybridge yachts from the Next Yacht Group',
    strengths: ['semi-custom flexibility', 'classic Italian flybridge proportions', 'planing performance', 'hand-built craftsmanship'],
    models: [
      { name: 'Maiora', note: 'the flybridge motor yachts' },
      { name: 'Exuma', note: 'the explorer-style range' },
    ],
  },
  feadship: {
    country: 'Netherlands', founded: 1949, sizeRange: "100 to 360+ feet",
    known: 'the pinnacle of Dutch custom superyacht building',
    strengths: ['fully custom, one-off superyachts', 'unmatched Dutch build and finish', 'industry-leading engineering and sustainability', 'legendary resale prestige'],
    models: [
      { name: 'Custom', note: 'every Feadship is a bespoke commission' },
    ],
  },
  tiara: {
    country: 'Holland, Michigan', founded: 1974, sizeRange: "34 to 48 feet",
    known: 'meticulously-crafted luxury dayboats and sport yachts',
    strengths: ['heirloom-grade fit and finish', 'the versatile outboard-powered EX and LS lines', 'genuine day-to-overnight versatility', 'strong resale value'],
    models: [
      { name: 'Sport / LS', note: 'the outboard dayboats' },
      { name: 'EX', note: 'the express cruisers' },
      { name: 'Coupe', note: 'the enclosed flagships' },
    ],
  },
  contender: {
    country: 'Homestead, Florida', founded: 1984, sizeRange: "22 to 44 feet",
    known: 'tournament-grade center consoles',
    hull: 'Fine-entry deep-V hulls built for a dry, fast offshore ride',
    strengths: ['serious tournament fishing pedigree', 'fine-entry deep-V offshore hulls', 'hand-laid, rugged construction', 'the trust of hardcore anglers'],
    models: [
      { name: 'Tournament (T)', note: 'the fishing flagships' },
      { name: 'Sport (S)', note: 'the family-friendly consoles' },
      { name: 'Bay', note: 'the inshore range' },
    ],
  },
  carver: {
    country: 'Pulaski, Wisconsin', founded: 1954, sizeRange: "34 to 40 feet",
    known: 'voluminous, livable motor yachts with unmatched space per dollar',
    strengths: ['exceptional interior volume for the length', 'liveaboard-friendly layouts', 'approachable ownership and value', 'command-bridge and coupé options'],
    models: [
      { name: 'C Series', note: 'the command-bridge motor yachts' },
      { name: 'Coupe', note: 'the enclosed-bridge range' },
    ],
  },
};

// Aliases so both "sanlorenzo" and "san lorenzo" (and similar) resolve.
const ALIAS: Record<string, string> = {
  'sanlorenzo': 'sanlorenzo',
  'ferretti': 'ferretti yachts',
  'majesty yachts': 'majesty',
  'cigarette racing': 'cigarette',
};

function factsFor(name: string): BrandFacts | undefined {
  const key = name.toLowerCase();
  if (FACTS[key]) return FACTS[key];
  if (ALIAS[key] && FACTS[ALIAS[key]]) return FACTS[ALIAS[key]];
  // fall back on first word (e.g. "Ferretti Yachts" -> "ferretti")
  const first = key.split(' ')[0];
  if (FACTS[first]) return FACTS[first];
  return undefined;
}

export function getBrandDetail(name: string, blurb: string): BrandDetail {
  const f: BrandFacts = factsFor(name) ?? {
    country: 'renowned yards worldwide',
    known: blurb.replace(/\.$/, '').toLowerCase(),
    strengths: ['distinctive design', 'proven engineering', 'strong resale demand'],
  };
  return {
    tagline: f.tagline ?? `Experience ${f.known}, represented worldwide by FYI Yachts from Miami.`,
    intro: genIntro(name, f),
    apart: genApart(name, f),
    apartPoints: f.strengths.map(cap),
    models: f.models ?? [],
    uses: genUses(name),
    build: genBuild(name, f),
    faqs: genFaqs(name, f),
    video: f.video,
    closing: f.closing ?? `FYI Yachts is a leading ${name} brokerage in Miami, representing new and used ${name} yachts for sale worldwide. Explore the live inventory above, call ${PHONE}, or send an inquiry — a ${name} specialist responds within one business day.`,
    country: f.country,
    founded: f.founded,
    sizeRange: f.sizeRange,
  };
}
