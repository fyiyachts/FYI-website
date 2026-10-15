// Shared FAQ accordion for the public marketing pages. AI engines quote
// Q&A-shaped content heavily, so charter/sell pages carry these and the
// prerender mirrors them as FAQPage JSON-LD (scripts/seoData.ts).
import type { QA } from './faqData';
export { CHARTER_FAQS, SELL_FAQS } from './faqData';
export type { QA };

export function FaqSection({
  heading = 'Frequently asked questions',
  faqs,
  dark = false,
  background,
  iconClassName,
}: {
  heading?: string;
  faqs: QA[];
  dark?: boolean;
  /** Override the section background (defaults to bg-yacht-900 when dark, transparent otherwise). */
  background?: string;
  /** Override the +/expand icon's size (defaults to inheriting the question's text size). */
  iconClassName?: string;
}) {
  if (!faqs.length) return null;
  const bgClass = background ?? (dark ? 'bg-yacht-900' : '');
  return (
    <section className={`px-6 py-16 lg:px-8 ${bgClass}`}>
      <div className="mx-auto max-w-3xl">
        <p className={`text-center text-[11px] font-semibold uppercase tracking-[0.35em] ${dark ? 'text-yacht-teal' : 'text-yacht-brand'}`}>Questions, Answered</p>
        <h2 className={`mt-4 text-center text-2xl font-light tracking-wide lg:text-3xl ${dark ? 'text-white' : 'text-yacht-900'}`}>{heading}</h2>
        <div className="mt-10">
          {faqs.map(({ q, a }) => (
            <details key={q} className={`group border-b py-5 ${dark ? 'border-white/10' : 'border-yacht-900/10'}`}>
              <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium tracking-wide [&::-webkit-details-marker]:hidden ${dark ? 'text-white' : 'text-yacht-900'}`}>
                {q}
                <span className={`text-yacht-brand transition-transform group-open:rotate-45 ${iconClassName ?? ''}`} aria-hidden="true">+</span>
              </summary>
              <p className={`mt-4 text-[14px] font-light leading-7 ${dark ? 'text-white/70' : 'text-yacht-900/70'}`}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

