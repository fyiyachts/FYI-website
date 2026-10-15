// FAQ copy shared between the rendered accordions (Faq.tsx) and the
// prerender's FAQPage JSON-LD (scripts/seoData.ts). Plain data only — no
// JSX — so the prerender's esbuild bundle can import it.
export interface QA { q: string; a: string }

export const CHARTER_FAQS: QA[] = [
  { q: 'What does a Miami yacht charter cost?', a: 'Crewed charters with FYI start at $3,600, with all rates inclusive of tax. The final rate depends on the vessel, the length of the charter, and provisioning — a consultant tailors a quote to your group.' },
  { q: "What's included in a charter?", a: 'Captain and professional crew, fuel, and provisioning are arranged by FYI. You tell us the occasion — a day on Biscayne Bay, a weekend to the Bahamas, fishing, or a celebration — and we build the program around it.' },
  { q: 'How large are the charter yachts?', a: 'Our crewed charter fleet runs from roughly 72 to 105 feet out of Miami, with options for larger vessels on request through our worldwide network.' },
  { q: 'Can I charter a yacht I might want to buy?', a: 'Yes — chartering is a great way to experience a model before purchasing, and many owners offset ownership costs by offering their yacht for charter. Ask about our lease-to-own program too.' },
];

export const LEASE_FAQS: QA[] = [
  { q: 'How does lease-to-own work for a yacht?', a: 'You start using the vessel under a structured lease with a defined path to title: agreed terms up front, payments that build toward ownership, and a close when you are ready. A FYI consultant structures the agreement around the specific vessel and your situation.' },
  { q: 'Do I need a large lump sum to start?', a: 'No — the point of the program is flexible entry compared with a traditional purchase or 10–20%-down marine loan. Terms are structured per vessel and per buyer; a consultant will walk you through what your entry looks like.' },
  { q: 'Which yachts qualify for lease-to-own?', a: 'Availability varies by listing — many brokerage vessels can be structured this way, and it also widens the buyer pool for sellers who list with FYI. Ask your consultant which of the vessels you are considering qualify.' },
  { q: 'Can I pay in cryptocurrency?', a: 'Yes — FYI accepts cryptocurrency settlement for qualified transactions, on lease-to-own and conventional purchases alike.' },
  { q: 'What if I decide to buy sooner?', a: 'The agreement defines your path to title, and moving faster is usually welcome — your consultant will lay out exactly how an early close works before you sign anything.' },
  { q: 'Is lease-to-own better than chartering?', a: 'They answer different questions. Charter is the way to experience a yacht or a model before committing; lease-to-own is for when you have found the boat and want to be on the water now while building toward owning her.' },
  // "rent to own sailboats" ranks this page ~#4 (4,600+ impressions/quarter,
  // zero clicks) but FYI has no sailboat lease-to-own — answer the query
  // honestly and pivot to what the brokerage can do, rather than promising
  // inventory that does not exist.
  { q: 'Do you offer lease-to-own or rent-to-own sailboats?', a: 'No — the lease-to-own program is structured for motor yachts and powerboats. If a sailboat is what you are after, FYI can still help: our consultants source sailing yachts for purchase through the worldwide brokerage market, and conventional marine financing applies to sail just as it does to power. Call +1-305-854-6020 and tell us what you want to sail.' },
];

export const SELL_FAQS: QA[] = [
  // The three questions below lead with the exact phrases searchers use —
  // "how do i sell my yacht" ranks /sell around page 2 with zero clicks, so
  // the page should visibly answer it, not just pitch the brokerage.
  { q: 'How do I sell my yacht?', a: 'Four steps. First, a free valuation: a consultant prices your vessel from three decades of Miami closings and live comparable-sale data. Second, preparation: professional photography, video, and listing copy. Third, marketing: syndication across the major brokerage networks, FYI channels reaching 50,000+ people a day, and direct outreach to our worldwide buyer list. Fourth, negotiation and closing: buyers are qualified before they ever step aboard, and our in-house closing team handles escrow, documentation, titling, and registration. You pay nothing until the boat sells.' },
  { q: 'How long does it take to sell a yacht?', a: 'It depends on the vessel, the price positioning, and the season — a sharply priced boat in a liquid segment can move in weeks, while rarer vessels take longer to find their buyer. Your consultant will give you an honest read from recent comparable sales before you list, and pricing to the comps from day one is the single biggest factor in selling quickly.' },
  { q: 'What documents do I need to sell my yacht?', a: 'Typically the title or documentation, current registration, a loan payoff statement if the vessel is financed, and whatever maintenance and service records you have — good records genuinely help the price. FYI’s in-house closing team walks you through exactly what your transaction needs and handles the paperwork end to end.' },
  { q: 'How does FYI market my yacht?', a: 'Professional photography and video, placement across the major brokerage networks and our own channels reaching over 50,000 people per day, and direct outreach to our worldwide buyer network — all managed by your consultant.' },
  { q: 'What does it cost to list with FYI?', a: 'Standard brokerage commission is due only on a successful sale — there is no upfront fee to list. Request a free valuation and a consultant will walk you through the numbers for your vessel.' },
  { q: 'How do you price my yacht?', a: 'We price from three decades of local closings and live comparable-sale data, not a national average — so your yacht is positioned to sell without leaving money on the table.' },
  { q: 'Who handles the closing?', a: "FYI's in-house closing services handle escrow, documentation, titling, and registration end to end, so the paperwork is off your plate." },
  { q: 'Can I sell and buy at the same time?', a: 'Yes — many clients trade up. Your consultant coordinates the sale of your current vessel with the purchase of the next so the timing works in your favor.' },
];
