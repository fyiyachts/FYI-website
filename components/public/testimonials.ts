// Client reviews, verbatim from FYI's own published testimonial wall on
// fyiyachts.com. Shared between the homepage, /about-us, and /contact so the
// same sourced quotes appear everywhere rather than living on a single route.
//
// ⚠️ CONTENT INTEGRITY — read before editing (brain: Website Setup Standard §8).
// Never add a quote that FYI has not actually published, never invent an
// attribution, and never attach a star rating or an AggregateRating to these.
// We hold the quotes; we do NOT hold verified per-review ratings or a verified
// review count, so rendering stars or emitting `AggregateRating` schema would
// be fabricated data — and a rating we can't defend is both a trust problem
// and a Google structured-data violation. To publish ratings, first get the
// Google Business Profile review export from FYI and source them properly.
//
// Plain data only (no JSX) so the prerender's esbuild bundle can import it.

export interface Testimonial {
  quote: string;
  /** How the reviewer is identified on FYI's published wall. */
  who: string;
  /** Consultant named in the review, where the reviewer named one. */
  consultant?: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'My point of contact was Jose Noy. He was an excellent salesman and good with paperwork. He referred me to reputable contractors such as insurance providers and loan originators… I feel he went above and beyond and it should reflect upon the company he works for.',
    who: 'Yacht buyer, Miami',
    consultant: 'Jose Noy',
  },
  {
    quote:
      'Hiram Concepcion was extremely attentive, took calls during and after the purchase, and the staff made the paperwork process flow smoothly. Long after the sale, Hiram has turned out to be a good friend that is always available. GREAT EXPERIENCE!',
    who: 'Boat buyer, Miami-Dade',
    consultant: 'Hiram Concepcion',
  },
  {
    quote:
      'Probably the best experience I had with a broker ever. I was purchasing a vessel located in South Florida from New Jersey. Arney and Michelle guided me through the whole transaction over the phone and email. Highly responsive and honest people.',
    who: 'Remote buyer, New Jersey',
    consultant: 'Arney Mendez',
  },
];
