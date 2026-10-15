import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, FileText, Users } from 'lucide-react';
import { PublicShell, PageHero, PublicInquiryForm, SectionHead } from './PublicPages';
import NotFoundPage from './NotFoundPage';
import { usePageMeta } from '../../utils/usePageMeta';
import { useJsonLd } from '../../utils/useJsonLd';
import { CASE_STUDIES, getCaseStudy, type CaseStudy } from './caseStudyData';
import { RESPONSE_PROMISE } from './responsePromise';
import { StickyCta } from './StickyCta';

/**
 * Client results — the narrative proof the site was missing. /sold-yachts
 * lists closings as inventory data; these are the deals told as stories.
 *
 * Every fact rendered here comes from FYI's own published closing
 * announcements — see the header of ./caseStudyData.ts before adding one.
 */

function ResultCard({ c }: { c: CaseStudy }) {
  return (
    <Link
      to={`/case-studies/${c.slug}`}
      className="group flex h-full flex-col border border-yacht-900/10 bg-white p-8 transition-colors hover:border-yacht-brand/40"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-brand">{c.segment}</p>
      <h3 className="mt-4 text-xl font-light leading-snug tracking-wide text-yacht-900">{c.headline}</h3>
      <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/65">
        {c.year} {c.builder} &middot; {c.vessel} &middot; {c.location}
      </p>
      {c.askingAtSale && (
        <p className="mt-5 text-[13px] font-light text-yacht-900/55">
          Asking at time of sale <span className="text-yacht-900">{c.askingAtSale}</span>
        </p>
      )}
      <p className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45 transition-colors group-hover:text-yacht-brand">
        Read the deal
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </p>
    </Link>
  );
}

export function CaseStudiesPage() {
  usePageMeta(
    'Client Results & Case Studies | FYI Yachts',
    'Real closings from Florida Yachts International — sportfish, motor yachts, and high-performance boats sold in Miami, with the consultants who represented each side and what the transaction actually required.',
    '/case-studies/',
  );

  useJsonLd('case-studies', useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Client Results & Case Studies',
    description: 'Published closings brokered by Florida Yachts International.',
    hasPart: CASE_STUDIES.map((c) => ({
      '@type': 'Article',
      headline: c.headline,
      about: `${c.year} ${c.builder} ${c.vessel}`,
      url: `https://fyiyachts.com/case-studies/${c.slug}/`,
    })),
  }), []));

  return (
    <PublicShell>
      <PageHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Client Results' }]}
        eyebrow="Client Results"
        h1="The deals behind the sold list"
        intro="Every result below is a closing FYI published at the time, with the consultants who represented each side named. Figures shown are the last asking price at the time of sale — the number the vessel was marketed at, not the confidential settlement figure."
      />

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CASE_STUDIES.map((c) => (
            <ResultCard key={c.slug} c={c} />
          ))}
        </div>
      </section>

      <section className="bg-yacht-900 px-6 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHead eyebrow="Your vessel" title="What would yours look like?" dark />
            <p className="mt-6 text-[15px] font-light leading-8 text-white/70">
              Every one of these started with a valuation conversation and a consultant who knew the
              segment. Tell us about your vessel and we&apos;ll tell you honestly what the market is
              doing with boats like it. {RESPONSE_PROMISE}
            </p>
            <Link
              to="/sold-yachts"
              className="mt-8 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-teal transition-colors hover:text-white"
            >
              See every recent closing
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div>
            <PublicInquiryForm context="Sell my yacht (from Client Results)" dark messagePlaceholder="Tell us about your vessel (optional)" />
          </div>
        </div>
      </section>
      <StickyCta context="Client Results" inquireHref="/contact" label="Free valuation" />
    </PublicShell>
  );
}

export function CaseStudyPage() {
  const { slug = '' } = useParams();
  const c = getCaseStudy(slug);

  // An unknown /case-studies/:slug is a real 404, not a blank template.
  if (!c) return <NotFoundPage />;

  return <CaseStudyDetail c={c} />;
}

function CaseStudyDetail({ c }: { c: CaseStudy }) {
  const title = `${c.year} ${c.builder} ${c.vessel}`;

  usePageMeta(
    `${title} — Sold by FYI Yachts | Client Results`,
    `${c.headline}. ${c.year} ${c.builder} in ${c.location}, brokered by ${c.represented.map((r) => r.name).join(' and ')} of Florida Yachts International.`,
    `/case-studies/${c.slug}/`,
  );

  useJsonLd(`case-study-${c.slug}`, useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.headline,
    about: title,
    datePublished: c.sourceDate,
    articleSection: c.segment,
    author: { '@type': 'Organization', name: 'Florida Yachts International' },
    publisher: { '@type': 'Organization', name: 'Florida Yachts International' },
    mainEntityOfPage: `https://fyiyachts.com/case-studies/${c.slug}/`,
  }), [c.headline, c.slug, c.segment, c.sourceDate, title]));

  return (
    <PublicShell>
      <PageHero
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Client Results', href: '/case-studies' },
          { label: title },
        ]}
        eyebrow={`${c.segment} · ${c.location}`}
        h1={c.headline}
        intro={title}
      />

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          <article>
            {c.body.map((p) => (
              <p key={p.slice(0, 40)} className="mt-6 text-[15px] font-light leading-8 text-yacht-900/75 first:mt-0">
                {p}
              </p>
            ))}

            <p className="mt-10 flex items-start gap-3 border-t border-yacht-900/10 pt-6 text-[13px] font-light leading-7 text-yacht-900/55">
              <FileText className="mt-0.5 h-4 w-4 flex-none text-yacht-900/30" aria-hidden="true" />
              <span>
                Source:{' '}
                <Link to={`/${c.source}`} className="underline transition-colors hover:text-yacht-brand">
                  FYI Yachts closing announcement
                </Link>
                , {c.sourceDate}. Figures shown are the last asking price at the time of sale, as
                published — not the final settlement figure, which is confidential.
              </span>
            </p>
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-yacht-900/10 bg-white p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">Vessel</p>
              <dl className="mt-5">
                {c.specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-yacht-900/10 py-3 text-[14px] last:border-0">
                    <dt className="font-light text-yacht-900/55">{k}</dt>
                    <dd className="text-right font-medium text-yacht-900">{v}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">
                <Users className="h-4 w-4 text-yacht-brand" aria-hidden="true" />
                Represented by
              </p>
              <ul className="mt-4 space-y-3">
                {c.represented.map((r) => (
                  <li key={r.slug} className="text-[14px] font-light leading-6 text-yacht-900/70">
                    <Link to={`/consultants/${r.slug}`} className="font-medium text-yacht-900 underline transition-colors hover:text-yacht-brand">
                      {r.name}
                    </Link>
                    <span className="block text-[13px] text-yacht-900/55">{r.side}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 border border-yacht-900/10 bg-white p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">
                Selling something similar?
              </p>
              <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/65">{RESPONSE_PROMISE}</p>
              <div className="mt-6">
                <PublicInquiryForm context={`Sell my yacht (from ${c.builder} case study)`} messagePlaceholder="Tell us about your vessel (optional)" />
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-16 border-t border-yacht-900/10 pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">More results</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CASE_STUDIES.filter((o) => o.slug !== c.slug).slice(0, 3).map((o) => (
              <ResultCard key={o.slug} c={o} />
            ))}
          </div>
        </div>
      </section>
      <StickyCta context={`Case study — ${c.builder}`} inquireHref="/contact" label="Free valuation" />
    </PublicShell>
  );
}
