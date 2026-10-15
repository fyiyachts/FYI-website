// FAQs for the pages that had none: the ten inventory category pages, plus
// about / contact / financing-adjacent general questions.
//
// Charter, sell, lease-to-own, and the 37 brand pages already carried FAQs
// (faqData.ts and brandContent.ts's genFaqs). These fill the gap so every
// public template answers at least five real questions — both because buyers
// ask them and because AI engines quote Q&A-shaped content heavily.
//
// Facts used here are drawn from the site's own copy and the brand data:
// Miami brokerage founded 1994, 300+ years of combined consultant experience,
// in-house closing services, 10–20 year marine loan terms at 10–20% down,
// lease-to-own and cryptocurrency settlement, charters from $3,600 inclusive
// of tax, and a one-business-day response commitment. Do not add a claim that
// isn't already backed somewhere in this repo or by FYI directly.
//
// Plain data only (no JSX) so the prerender's esbuild bundle can import it.
import type { QA } from './faqData';

const PHONE = '305-854-6020';

/** Questions that apply to any inventory page, appended after the specific ones. */
const COMMON: QA[] = [
  {
    q: 'Can FYI find a yacht that isn’t listed here?',
    a: `Yes — and it happens often. What you see is FYI's own represented inventory; our consultants also work the worldwide market and off-market network, including vessels whose owners haven't publicly listed. Tell us what you're after and we'll go looking. Call ${PHONE} or send an inquiry — a broker responds within one business day.`,
  },
  {
    q: 'What does FYI charge a buyer?',
    a: 'Nothing. In a standard brokerage transaction the commission is paid by the seller out of the sale proceeds, so working with an FYI consultant as a buyer costs you nothing and gets you independent representation, comparable-sale data, and someone negotiating on your side.',
  },
];

export const CATEGORY_FAQS: Record<string, QA[]> = {
  '60-to-80-ft-yachts-for-sale': [
    {
      q: 'What do you get moving up from a 50-footer to a 60–90 ft yacht?',
      a: 'The step up is bigger than the numbers suggest: full-beam master staterooms, genuine guest cabins instead of convertible berths, room for water toys, and the range and seakeeping for the Bahamas or the Keys without watching the weather window as nervously. Many owners in this range still run the boat themselves; others add a captain — a consultant can walk you through what the specific vessel demands.',
    },
    {
      q: 'Can FYI sell my current boat while I buy a larger one?',
      a: `Yes — trade-up transactions are routine here. FYI lists and markets your current vessel while sourcing the next one, and can coordinate both closings through our in-house closing team so the timing works. Call ${PHONE} and tell us what you're running now.`,
    },
    {
      q: 'Can I finance a 60–90 ft yacht?',
      a: 'Yes. Marine lenders in this range typically work with 10–20% down and terms of 10–20 years, and FYI works with lenders who finance vessels of this size routinely — including refinancing the equity in your current boat toward the next one. Lease-to-own structures are also available on select vessels.',
    },
    {
      q: 'Where can I see these yachts in person?',
      a: 'Most of the 60-to-90-footers we represent lie in South Florida — Miami, Miami Beach, Coconut Grove, and nearby marinas — so showings are easy to arrange, often same-week. For vessels lying elsewhere, consultants run video walkthroughs and coordinate travel only when it’s worth your time.',
    },
    ...COMMON,
  ],
  'yachts-for-sale-venezuela': [
    {
      q: 'Can an American buy a yacht lying in Venezuela?',
      a: `Yes, and FYI does it regularly — it is the largest part of our book outside the United States. The vessel is bought where she lies, then either delivered on her own bottom or shipped to Florida. Our consultants handle the export side and the US import and duty entry, and work in Spanish with the seller. Call ${PHONE} to talk through a specific boat.`,
    },
    {
      q: 'Where in Venezuela are these boats?',
      a: 'Mostly the central coast and the fishing grounds our clients know: La Guaira and Vargas, Morrocoy and Tucacas on the Falcón coast, Higuerote, and Lecherías in the east. Sportfish hulls — Viking, Bertram, Albemarle — are heavily represented, alongside Sea Ray, Sunseeker, Pershing and Azimut cruisers.',
    },
    {
      q: 'How do I see a boat before committing?',
      a: 'A consultant arranges a video walkthrough first so you only travel for a vessel worth travelling for, then coordinates a survey and sea trial with a surveyor we have used before. Nothing moves to closing until the survey is in your hands.',
    },
    ...COMMON,
  ],
  'yachts-for-sale-mexico': [
    {
      q: 'Where in Mexico does FYI represent yachts?',
      a: 'Both coasts. On the Pacific side, La Paz and the Sea of Cortez and Puerto Vallarta; on the Caribbean side, Cozumel and Cancún. The Mexican book skews large — most of it sits between 70 and 100 feet — so it is where a buyer looking for a serious motor yacht should start.',
    },
    {
      q: 'Can the boat be brought to the United States?',
      a: `Yes. A US buyer can run her north or have her shipped, and FYI handles the Mexican export paperwork and the US import entry either way. Duty and documentation depend on the vessel's build and flag history, so ask a consultant about the specific hull — call ${PHONE}.`,
    },
    {
      q: 'Do your consultants work in Spanish?',
      a: 'Yes. Several of our consultants are native Spanish speakers and deal with Mexican yards, marinas and owners directly, which matters when a survey finding has to be negotiated rather than translated.',
    },
    ...COMMON,
  ],
  'yachts-for-sale-puerto-rico': [
    {
      q: 'Is buying a yacht in Puerto Rico easier than elsewhere in the Caribbean?',
      a: 'Considerably, for a US buyer. Puerto Rico is US territory, so there is no import duty to pay, no foreign flag to change, and US Coast Guard documentation carries over — the transaction looks much like buying in Florida. It is also a short run to the Spanish and US Virgin Islands.',
    },
    {
      q: 'Where are the boats and how do I see one?',
      a: 'San Juan, Fajardo and Palmas del Mar hold most of the island\u2019s brokerage fleet. A consultant sets up a video walkthrough first, then a survey and sea trial on the island; direct flights from Miami make an in-person showing a day trip rather than a trip.',
    },
    {
      q: 'Can FYI represent me on a boat that is not on this page?',
      a: `Yes — this page shows what is publicly listed today, and our consultants source well beyond it, including vessels whose owners have never advertised them. Tell us the brief and we will go find it: ${PHONE}.`,
    },
    ...COMMON,
  ],
  'yachts-for-sale-miami': [
    {
      q: 'Where is FYI Yachts located in Miami?',
      a: `FYI Yachts — Florida Yachts International — is headquartered at 2424 Coral Way, Miami, FL 33145, and has served Miami’s boating community since 1994. We work the whole South Florida waterfront: Coconut Grove, Coral Gables, Miami Beach, Key Biscayne, Aventura, and up to Fort Lauderdale. Call ${PHONE} or stop by.`,
    },
    {
      q: 'Why buy through a Miami brokerage?',
      a: 'Miami is one of the deepest yacht markets in the world, and a local brokerage sees it daily: which vessels are priced to sell, which marinas have slips, which surveyors and yards to trust, and what comparable boats actually closed for. FYI’s consultants bring 300+ years of combined experience on exactly this water.',
    },
    {
      q: 'Are these boats actually in Miami?',
      a: 'Every vessel on this page lies in Florida, most in greater Miami — so you can see the boat this week, not after a flight. Our full inventory and the worldwide market are on the Yachts for Sale page; consultants source and represent vessels anywhere.',
    },
    {
      q: 'Can FYI help me find a slip or manage the boat after I buy?',
      a: 'Consultants routinely help buyers line up dockage, insurance introductions, and captains or management for larger vessels — the after-sale part of buying in Miami is something we navigate weekly. Ask your consultant during the search so the plan is in place before closing.',
    },
    ...COMMON,
  ],
  'yachts-for-sale': [
    {
      q: 'How current is this inventory?',
      a: 'It updates live from our brokerage feed, so what you see is what is actually available today — as vessels go under contract or close, they drop off. Prices shown are the current asking price, not a stale snapshot.',
    },
    {
      q: 'What’s the first step in buying a yacht?',
      a: `Before looking at boats, get clear on how you'll use her — day cruising, overnighting, entertaining, fishing, or long passages — and where you'll keep her. That answers size, draft, and layout faster than browsing does. Then a consultant shortlists against live comparable sales so you're comparing real market value, not asking prices. Call ${PHONE} to start there.`,
    },
    {
      q: 'Do I need a survey and sea trial?',
      a: 'Yes, on any pre-owned vessel. A marine survey and sea trial are how you find what the listing photos don’t show, and the results are normal grounds for renegotiating or walking away. FYI coordinates the surveyor, the haul-out, and the sea trial as part of the purchase.',
    },
    {
      q: 'How long does a yacht purchase take to close?',
      a: 'From accepted offer to closing is usually a few weeks, driven by survey scheduling, financing if you’re using it, and documentation. FYI’s in-house closing team handles escrow, documentation, titling, and registration, which removes the third-party delays that stretch out most transactions.',
    },
    {
      q: 'Can FYI represent me on a yacht that isn’t in Florida?',
      a: 'Yes. FYI brokers source and represent vessels worldwide — our consultants work with buyers on boats in the Mediterranean, the Caribbean, and across the US. The representation, negotiation, and closing support are the same wherever the vessel sits.',
    },
    {
      q: 'How does buying a yacht located abroad work?',
      a: 'The mechanics — offer, survey, sea trial, closing — are the same, with additional attention to flag state, VAT or duty status, import considerations, and delivery or shipping. A consultant walks you through which of those apply to your specific vessel before you make an offer.',
    },
    {
      q: 'Do I have to travel to see the boat?',
      a: 'Not necessarily. Consultants regularly run remote transactions with video walkthroughs and an independent surveyor as your eyes on the ground. Many clients only travel for the sea trial, and some not at all.',
    },
    {
      q: 'Who handles the paperwork on an international purchase?',
      a: 'FYI’s in-house closing services handle escrow, documentation, titling, and registration, and coordinate with the specialists a cross-border transaction needs. The paperwork stays off your plate.',
    },
    ...COMMON,
  ],

  'featured-listings': [
    {
      q: 'What makes a listing “featured”?',
      a: 'These are vessels FYI represents directly — our own exclusive listings rather than aggregated inventory. That means our consultants know the boat, know the owner’s situation, and can answer questions about condition, history, and flexibility without going through another brokerage.',
    },
    {
      q: 'Does exclusive representation change what I pay?',
      a: 'Not as a buyer. It changes how much we can tell you and how fast we can move — a direct line to the owner shortens every question, from whether a survey date works to whether an offer has room.',
    },
    {
      q: 'Can I see one of these in person?',
      a: `Yes. Most featured vessels are in South Florida and can be viewed by appointment, usually within a day or two. Call ${PHONE} and a consultant will arrange it.`,
    },
    {
      q: 'Are featured listings negotiable?',
      a: 'Every vessel is negotiable — the question is by how much, and that depends on the owner’s timeline and what comparable boats have actually sold for. Because we represent these directly, we can give you a straight read on where the number really sits.',
    },
    ...COMMON,
  ],

  'super-yachts-for-sale': [
    {
      q: 'What counts as a superyacht?',
      a: 'Conventionally, 80 feet and up — which is where this page starts. Above that length the boat stops being something you run yourself: professional crew, different berthing, and different operating economics all come with it.',
    },
    {
      q: 'What does it cost to run a superyacht each year?',
      a: 'The working industry rule of thumb is roughly 10% of the purchase price per year, covering crew, dockage, insurance, fuel, and maintenance — but it varies enormously with size, how much you cruise, and whether the vessel charters. A consultant will build a realistic figure for the specific vessel before you commit.',
    },
    {
      q: 'Can a superyacht earn charter income?',
      a: 'Yes — many owners offset a meaningful share of operating cost by placing the vessel in charter when they aren’t using her. It changes the flag, crew, and compliance picture, so it’s a decision to make before you buy rather than after.',
    },
    {
      q: 'Do I need to own it through an LLC or trust?',
      a: 'Many buyers at this level do, for liability and confidentiality reasons. FYI regularly coordinates closings through LLCs, trusts, or corporate structures — but the right structure is a question for your own counsel and tax advisor, and we’ll work with them.',
    },
    ...COMMON,
  ],

  'new-yachts-for-sale': [
    {
      q: 'What does “new” mean on this page?',
      a: 'Factory-new vessels — current-year builds, immediate-delivery boats, and new-construction slots from the shipyards FYI has direct relationships with. Not lightly-used or brokerage boats.',
    },
    {
      q: 'How long does a new build take?',
      a: 'It depends on the yard and the size, and it ranges from an immediate-delivery hull already in build to a two-year-plus programme for a custom vessel. A consultant can tell you what current slots look like at each yard we represent.',
    },
    {
      q: 'Can I customise the specification?',
      a: 'On a new build, yes — layout, finishes, engine and drive configuration, and electronics are all typically open. Our specialists will also tell you which options genuinely hold value at resale and which don’t.',
    },
    {
      q: 'Is a new yacht harder to finance than a used one?',
      a: 'No — marine lenders finance both, typically over 10-to-20-year terms with 10–20% down. New builds add a progress-payment element during construction, which the lender structures. FYI coordinates the financing alongside the purchase.',
    },
    ...COMMON,
  ],

  'used-yachts-for-sale': [
    {
      q: 'How do I know a used yacht has been looked after?',
      a: 'Maintenance records, a marine survey, and an engine survey — in that order of what people skip and shouldn’t. A well-documented service history from a known yard tells you more than hours on the meter. FYI arranges the survey and reads the report with you.',
    },
    {
      q: 'What’s the sweet spot in age for value?',
      a: 'Broadly, boats that have taken their steepest depreciation but haven’t yet reached the major systems-replacement window — often somewhere in the five-to-twelve-year range, depending on the builder and how the boat was used. Your consultant will show you where the curve sits for the specific model.',
    },
    {
      q: 'Can I negotiate after the survey?',
      a: 'Yes, and it’s normal. Survey findings are standard grounds for renegotiating price or requiring repairs before closing — or for walking away, if the offer was written correctly in the first place.',
    },
    {
      q: 'Are used yachts financeable?',
      a: 'Yes. Marine lenders finance pre-owned vessels on similar 10-to-20-year terms, though older boats and unusual types can narrow the lender pool. Insurance also has to be bound at closing, which FYI helps arrange in step with the loan.',
    },
    ...COMMON,
  ],

  'small-yachts-for-sale': [
    {
      q: 'What size is a “small” yacht?',
      a: 'On this page, broadly under 50 feet — boats you can realistically run yourself, keep in a standard slip, and use on a weekend without a crew or a plan.',
    },
    {
      q: 'Can I run one without a captain?',
      a: 'Most owners at this size do. There is no licence requirement for recreational use in Florida for most adults, though a boater education card is required depending on your date of birth — and a few hours with a captain when you take delivery is the cheapest insurance there is.',
    },
    {
      q: 'What does dockage cost in Miami?',
      a: 'It varies widely by marina, season, and whether you want liveaboard or amenities, and it is worth pricing before you buy rather than after. A consultant can point you at the marinas with realistic availability for your length.',
    },
    {
      q: 'Is a smaller boat a good first purchase?',
      a: 'Usually, yes — a boat you actually use beats a bigger one that intimidates you. Many FYI clients start here and trade up within a few years, and we coordinate the sale of the first boat against the purchase of the next so the timing works in your favour.',
    },
    ...COMMON,
  ],

  'sport-fishing-yachts-for-sale': [
    {
      q: 'What should I look at first on a sportfish?',
      a: 'Engine hours and service history, then the cockpit and fishing systems, then the tower and electronics. The fishing package is expensive to add and cheap to inherit, so a well-equipped boat at a slightly higher number is often the better buy.',
    },
    {
      q: 'Convertible or express — which suits me?',
      a: 'A convertible gives you a flybridge, more interior volume, and genuine liveaboard comfort for longer trips. An express is simpler, usually faster to a number, and easier to run shorthanded. It comes down to how far offshore you go and how many nights you spend aboard.',
    },
    {
      q: 'How important are the engines on a sportfish?',
      a: 'More than on almost any other type — these boats run hard. A proper engine survey by a marine diesel specialist, separate from the hull survey, is not optional on a used sportfish.',
    },
    {
      q: 'Do sportfish boats hold their value?',
      a: 'Well-known builders in this segment hold value strongly, particularly boats with documented maintenance and current electronics. It is one of the more liquid parts of the South Florida market, which cuts both ways — good boats move fast.',
    },
    ...COMMON,
  ],

  'center-console-boats-for-sale': [
    {
      q: 'What are center consoles best for?',
      a: 'Fishing, diving, sandbar days, and running Biscayne Bay and the Keys — a shallow-water, all-round boat with 360-degree access around the deck and no interior to maintain.',
    },
    {
      q: 'How many engines do I need?',
      a: 'Under about 30 feet, twins are usually plenty; beyond that, triples and quads are common and are as much about redundancy running offshore as about speed. More engines also mean more maintenance, so match it to how far out you actually go.',
    },
    {
      q: 'Can a center console handle offshore water?',
      a: 'Modern boats in the 35–45 foot range absolutely can, with the range and the hull to run well offshore. Below that it depends much more on the day and your judgement than on the boat.',
    },
    {
      q: 'Are center consoles easy to resell?',
      a: 'They are among the most liquid boats in South Florida — demand is deep and year-round. Keeping the electronics current and the service history documented is most of what protects your number.',
    },
    ...COMMON,
  ],

  'catamaran-yachts-for-sale': [
    {
      q: 'Why choose a catamaran over a monohull?',
      a: 'Stability, deck and interior space for the length, and shallow draft — a catamaran sits flatter at anchor and gives you far more usable room than a monohull of the same length. The trade-offs are marina fees, which are usually charged at a premium for the beam, and different handling under way.',
    },
    {
      q: 'Is a catamaran harder to dock?',
      a: 'Different rather than harder. Twin widely-spaced engines make a catamaran unusually manoeuvrable once you learn to steer on the throttles — most owners find it easier than a single-screw monohull after a few sessions.',
    },
    {
      q: 'Power or sail?',
      a: 'Power catamarans give you the space and stability with simpler operation and predictable passage times; sailing catamarans give you range and running economy at the cost of more to learn and more to maintain. How you plan to cruise decides it.',
    },
    {
      q: 'Do catamarans cost more to keep?',
      a: 'Berthing usually does, because of the beam, and you have two of several systems to maintain. Against that, shallow draft opens up anchorages and cruising grounds a monohull can’t reach, which is why many owners consider it a fair trade.',
    },
    ...COMMON,
  ],
};

/** About / company questions — used on /about-us. */
export const ABOUT_FAQS: QA[] = [
  {
    q: 'How long has Florida Yachts International been in business?',
    a: 'FYI was founded in 1994 and has been brokering yachts out of Miami ever since — three decades of local closings, through several market cycles.',
  },
  {
    q: 'Where is FYI based?',
    a: 'Our office is at 2424 Coral Way, Miami, FL 33145, minutes from Coral Gables, Coconut Grove, and Brickell. Charters depart separately from Bayshore Landing at 2550 S Bayshore Drive in Coconut Grove.',
  },
  {
    q: 'What does FYI actually do?',
    a: 'Yacht sales and purchases, charter, financing, lease-to-own, new construction, and in-house closing services — escrow, documentation, titling, and registration handled by the same team as the transaction.',
  },
  {
    q: 'How experienced are FYI’s consultants?',
    a: 'The team carries 300+ years of combined experience in the yachting industry. Every consultant’s live listings and sold history are published on their own profile page, so you can see what they actually work on before you call.',
  },
  {
    q: 'Do you have consultants who speak my language?',
    a: `Yes — our consultants collectively speak English, Spanish, Portuguese, Italian, and more, and the site has a full Spanish-language section. Call ${PHONE} and ask for someone in your language.`,
  },
];

/** Contact-page questions — practical, about reaching us. */
export const CONTACT_FAQS: QA[] = [
  {
    q: 'How fast will someone get back to me?',
    a: 'A broker responds within one business day. If your inquiry is urgent, call — we answer the phone.',
  },
  {
    q: 'Who will I be talking to?',
    a: 'Your inquiry goes to the consultant who knows the vessel or the market segment you asked about, not a shared inbox. If you already know which consultant you want, name them and we’ll route it.',
  },
  {
    q: 'Can I just call instead of filling in a form?',
    a: `Always. ${PHONE} reaches the office; there's also WhatsApp on (786) 353-8073 if that's easier, and a dedicated charter desk on 305-306-8462.`,
  },
  {
    q: 'Can I visit the office?',
    a: 'Yes — 2424 Coral Way, Miami, FL 33145. Call ahead so the right consultant is there when you arrive rather than out showing a boat.',
  },
  {
    q: 'What should I include in my first message?',
    a: 'What you want to do (buy, sell, charter, or just get a valuation), the vessel or type you have in mind, and a rough budget or asking price. That’s enough for a consultant to come back with something useful instead of a request for more information.',
  },
];

/** General buying/selling questions for the homepage. */
export const GENERAL_FAQS: QA[] = [
  {
    q: 'What does a yacht broker actually do for me?',
    a: 'On a purchase: shortlists vessels against live comparable sales, negotiates, coordinates survey and sea trial, and runs the closing. On a sale: prices the boat honestly, markets it properly, screens buyers so you aren’t showing the vessel to tyre-kickers, and holds the deal together through survey. The broker is paid on a successful sale, so the incentive is to close — not to list.',
  },
  {
    q: 'How much does it cost to work with FYI?',
    a: 'As a buyer, nothing — the seller pays the commission out of the sale proceeds. As a seller, standard brokerage commission is due only on a successful sale; there is no upfront fee to list, and a valuation is free.',
  },
  {
    q: 'Can I charter a yacht before deciding to buy one?',
    a: `Yes, and it's the cheapest research you'll ever do. Crewed charters with FYI start at $3,600 inclusive of tax, and spending a day on a model you're considering answers questions no listing photo can. Many owners also offset ownership cost by chartering their own vessel.`,
  },
  {
    q: 'Do I have to pay cash for a yacht?',
    a: 'No. Marine lenders finance new and pre-owned vessels, typically over 10-to-20-year terms with 10–20% down. FYI also runs a lease-to-own programme with a defined path to title, and accepts cryptocurrency settlement on qualified transactions.',
  },
  {
    q: 'How quickly will someone get back to me?',
    a: `A broker responds within one business day — and if it's urgent, call ${PHONE} and we'll answer.`,
  },
];
