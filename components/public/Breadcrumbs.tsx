import { Fragment } from 'react';
import { Link } from 'react-router-dom';

/**
 * Visible breadcrumb trail.
 *
 * The prerender already emits `BreadcrumbList` JSON-LD for category, brand,
 * charter, and listing routes (scripts/seoData.ts), but until now only the
 * listing and charter-vessel pages rendered a trail a human could see or
 * click. Structured data without a visible equivalent is also against
 * Google's own breadcrumb guidance.
 *
 * Keep the `items` here in lockstep with the `crumbs([...])` call for the same
 * route in scripts/seoData.ts — they are meant to describe the same trail.
 */

export interface Crumb {
  label: string;
  /** Omit on the final (current) crumb. */
  href?: string;
}

export function Breadcrumbs({ items, dark = false, className = '' }: { items: Crumb[]; dark?: boolean; className?: string }) {
  if (items.length < 2) return null;

  const muted = dark ? 'text-white/55' : 'text-yacht-900/55';
  const current = dark ? 'text-white/85' : 'text-yacht-900/80';
  const sep = dark ? 'text-white/25' : 'text-yacht-900/25';

  return (
    // Layout-neutral by design: the hero owns the nav clearance and the max-w
    // container, so a trail rendered inside a dark hero and one rendered on a
    // cream page body both line up with the rest of the page.
    <nav aria-label="Breadcrumb" className={className}>
      <ol className={`flex flex-wrap items-center gap-2 text-[13px] font-light ${muted}`}>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              <li>
                {c.href && !last ? (
                  <Link to={c.href} className="transition-colors hover:text-yacht-brand">
                    {c.label}
                  </Link>
                ) : (
                  <span className={current} aria-current={last ? 'page' : undefined}>
                    {c.label}
                  </span>
                )}
              </li>
              {!last && <li aria-hidden="true" className={sep}>&rsaquo;</li>}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
