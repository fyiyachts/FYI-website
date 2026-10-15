import { Link } from 'react-router-dom';
import { Quote } from 'lucide-react';
import { TESTIMONIALS } from './testimonials';

/**
 * Reusable testimonial wall for the public marketing pages.
 *
 * These quotes previously rendered only inside HomePage.tsx, i.e. only on
 * `/homepage` — the redesign concept route — so the site's social proof was
 * effectively unpublished. This section puts the same sourced quotes on
 * /about-us and /contact.
 *
 * Deliberately no star graphics and no AggregateRating schema: we have the
 * quotes, not verified ratings. See the warning in ./testimonials.ts.
 */
export function TestimonialsSection({
  heading = 'What Our Clients Say',
  dark = false,
}: { heading?: string; dark?: boolean }) {
  return (
    <section className={`px-6 py-20 lg:px-8 ${dark ? 'bg-yacht-900' : 'bg-yacht-cream'}`}>
      <div className="mx-auto max-w-7xl lg:px-2">
        <p className={`text-center text-[11px] font-semibold uppercase tracking-[0.35em] ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`}>
          Testimonials
        </p>
        <h2 className={`mt-4 text-center text-2xl font-light tracking-wide lg:text-3xl ${dark ? 'text-white' : 'text-yacht-900'}`}>
          {heading}
        </h2>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.who}
              className={`flex h-full flex-col p-8 shadow-sm ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white'}`}
            >
              <Quote className={`h-6 w-6 ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`} aria-hidden="true" />
              <blockquote className={`mt-5 flex-1 text-[14px] font-light leading-7 ${dark ? 'text-white/75' : 'text-yacht-900/75'}`}>
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className={`mt-6 border-t pt-4 text-[11px] font-semibold uppercase tracking-[0.2em] ${dark ? 'border-white/10 text-white/50' : 'border-yacht-900/10 text-yacht-900/50'}`}>
                {t.who}
              </figcaption>
            </figure>
          ))}
        </div>

        <p className={`mt-10 text-center text-[13px] font-light ${dark ? 'text-white/55' : 'text-yacht-900/55'}`}>
          Reviews published by clients of Florida Yachts International.{' '}
          <Link to="/case-studies" className="underline transition-colors hover:text-yacht-brand">
            See the deals behind them
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
