import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ListingContent } from '../../api/_lib/listingContent';
import type { SpecGroupRows } from './specFields';

// The listing page's description and specification blocks.
//
// Both are built from the raw feed record by shared, dependency-free modules
// (api/_lib/listingContent.ts and api/_lib/specFields.ts) that the server
// render in api/listing.ts uses too — so the page a crawler reads and the page
// a visitor sees carry the same words.
//
// The HTML injected here has been reduced to an attribute-free tag allowlist
// (p, br, ul, ol, li, strong, b, em, i, h3, h4, table…) with all text escaped;
// that is what makes dangerouslySetInnerHTML safe.

const heading = 'font-serif text-2xl italic tracking-wide text-yacht-900';

/** How many detail sections start open; the rest are collapsed. */
const OPEN_BY_DEFAULT = 2;

export function ListingDescription({ content }: { content: ListingContent }) {
  const { descriptionHtml, sections } = content;
  const [open, setOpen] = useState<Set<number>>(
    () => new Set(Array.from({ length: Math.min(OPEN_BY_DEFAULT, sections.length) }, (_, i) => i)),
  );
  const allOpen = open.size === sections.length;
  const toggle = (i: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  if (!descriptionHtml && !sections.length) {
    return (
      <p className="mt-4 text-[14px] font-light text-yacht-900/50">
        Full details available on request — enquire and a broker will send the complete specification.
      </p>
    );
  }

  return (
    <>
      {descriptionHtml && (
        <div className="listing-prose mt-6" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      )}
      {sections.length > 0 && (
        <div className="mt-8">
          {sections.length > OPEN_BY_DEFAULT && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((_, i) => i)))}
                className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yacht-brand transition-colors hover:text-yacht-900"
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          )}
          <div className="border-t border-yacht-900/10">
            {sections.map((s, i) => {
              const isOpen = open.has(i);
              const bodyId = `listing-section-${i}`;
              return (
                <section key={`${s.title}-${i}`} className="border-b border-yacht-900/10">
                  <h3>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      aria-controls={bodyId}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left text-[13px] font-semibold uppercase tracking-[0.2em] text-yacht-900 transition-colors hover:text-yacht-brand"
                    >
                      {s.title}
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                  </h3>
                  {/* Collapsed sections stay in the document (hidden), so the
                      full text is there for search engines that render the page. */}
                  <div id={bodyId} hidden={!isOpen} className="listing-prose pb-6" dangerouslySetInnerHTML={{ __html: s.html }} />
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The dynamic specification table: one card per group, a two-column
 * label/value grid on desktop and one column on a phone. Only the rows and
 * groups the listing actually has — nothing renders as "--".
 */
export function SpecGroups({ groups }: { groups: SpecGroupRows[] }) {
  if (!groups.length) return null;
  return (
    <section className="mt-12">
      <h2 className={heading}>Specifications</h2>
      <div className="mt-5 grid gap-5">
        {groups.map((g) => (
          <section key={g.heading} className="border border-yacht-900/10 bg-white px-6 pb-3 pt-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yacht-brand">{g.heading}</h3>
            <dl className="mt-3 grid gap-x-10 sm:grid-cols-2">
              {g.rows.map((r, i) => (
                <div key={`${r.label}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-yacht-900/10 py-3 text-[14px] last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                  <dt className="shrink-0 font-light text-yacht-900/55">{r.label}</dt>
                  <dd className="text-right font-medium text-yacht-900">
                    {r.was && <s className="mr-2 font-light text-yacht-900/45">{r.was}</s>}
                    {r.value}
                    {r.note && <span className="block text-[12px] font-light text-yacht-900/55">{r.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}

/** The listing's legal footnote: the feed's own Disclaimer section when it has one, else ours — never both. */
export function ListingDisclaimer({ html }: { html: string }) {
  const cls = 'mt-12 border-t border-yacht-900/10 pt-6 text-[12px] font-light italic leading-6 text-yacht-900/45';
  if (html) return <div className={`${cls} [&_p+p]:mt-3`} dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <p className={cls}>
      This company offers the details of this vessel in good faith but cannot guarantee or warrant the accuracy of
      this information nor warrant the condition of the vessel. A buyer should instruct his agents, or his surveyors,
      to investigate such details as the buyer desires validated. This vessel is offered subject to prior sale,
      price change or withdrawal without notice.
    </p>
  );
}
