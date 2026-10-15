import { PublicShell, PageHero, PublicInquiryForm } from './PublicPages';
import { usePageMeta } from '../../utils/usePageMeta';

/**
 * Template for the migrated fyiyachts.com content/SEO pages (services,
 * careers, FAQ, Miami landing pages, seller-education pages...). Copy is
 * captured verbatim from the live WordPress pages (see contentData.ts) so
 * the keyword-bearing text that ranks today survives the redesign — per
 * the meeting rule: simplify the chrome, never strip the content.
 */

export interface ContentSection {
  heading?: string;
  text: string;
}

export interface ContentPageData {
  slug: string;          // exact fyiyachts.com slug
  eyebrow: string;
  h1: string;
  title: string;         // <title>
  description: string;   // meta description
  intro: string;
  sections: ContentSection[];
  inquiryContext?: string; // renders a closing inquiry band when set
  cta?: { label: string; href: string }; // optional button after the article
}

export function ContentPage({ data }: { data: ContentPageData }) {
  usePageMeta(data.title, data.description, `/${data.slug}/`);
  return (
    <PublicShell>
      <PageHero eyebrow={data.eyebrow} h1={data.h1} intro={data.intro} />
      <article className="mx-auto max-w-3xl px-6 py-14 lg:px-0">
        {data.sections.map((s, i) => (
          <section key={i} className={i > 0 ? 'mt-10' : ''}>
            {s.heading && (
              <h2 className="text-xl font-light tracking-wide text-yacht-900 lg:text-2xl">{s.heading}</h2>
            )}
            <p className={`whitespace-pre-line text-[15px] font-light leading-8 text-yacht-900/75 ${s.heading ? 'mt-4' : ''}`}>
              {s.text}
            </p>
          </section>
        ))}
        {data.cta && (
          <a
            href={data.cta.href}
            target={data.cta.href.startsWith('http') ? '_blank' : undefined}
            rel={data.cta.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="mt-10 inline-flex items-center gap-2 bg-yacht-brand px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
          >
            {data.cta.label}
          </a>
        )}
      </article>
      {data.inquiryContext && (
        <section className="bg-yacht-900 px-6 py-16">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">Talk to a broker</h2>
              <p className="mt-4 text-[15px] font-light leading-7 text-white/70">
                A specialist responds within one business day.
              </p>
            </div>
            <PublicInquiryForm context={data.inquiryContext} dark messagePlaceholder="Your message (optional)" />
          </div>
        </section>
      )}
    </PublicShell>
  );
}
