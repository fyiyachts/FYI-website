import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Phone, Search } from 'lucide-react';
import { PublicShell, PageHero } from './PublicPages';
import { usePageMeta } from '../../utils/usePageMeta';
import { track } from '../../utils/analytics';
import { BRAND_PAGES, CATEGORY_PAGES } from './publicData';
import { RESPONSE_PROMISE } from './responsePromise';

/**
 * Custom 404.
 *
 * Two halves to this, and both matter:
 *
 *  - **This page** — a designed dead-end recovery, not a bare "not found".
 *    A buyer who mistyped a URL or followed a stale link gets the search box
 *    and the money pages rather than a wall.
 *  - **A real HTTP 404 status** — served by `api/not-found.ts`, which the
 *    catch-all rewrite in `vercel.json` points at. Before that, unknown URLs
 *    fell through to the portal and returned **200 on a login screen**, which
 *    Google indexes as a soft 404. See the audit in the brain
 *    (`50-projects/FYI Website Redesign` → 20-point pre-launch audit).
 *
 * Fires a `page_not_found` GA4 event carrying the dead path, so broken
 * inbound links show up in analytics instead of silently bleeding traffic.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation();

  usePageMeta(
    'Page Not Found | FYI Yachts',
    'That page has moved or no longer exists. Search the live FYI Yachts inventory, browse by yacht type or builder, or call a Miami broker on 305-854-6020.',
  );

  useEffect(() => {
    track('page_not_found', { page_path: pathname, referrer: typeof document !== 'undefined' ? document.referrer : '' });
  }, [pathname]);

  // Crawlers must not index the 404 body even though the status is correct —
  // usePageMeta owns title/description, so the robots tag is set here.
  useEffect(() => {
    const el = document.createElement('meta');
    el.name = 'robots';
    el.content = 'noindex, follow';
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  return (
    <PublicShell>
      <PageHero
        eyebrow="404 — Off the chart"
        h1="We couldn't find that page"
        intro="The page may have moved, or the link that brought you here may be out of date. Everything below is still exactly where you left it."
      />

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {/* Search is the fastest recovery for the most common case: someone
            landed here looking for a specific boat. */}
        <form
          action="/yachts-for-sale"
          method="get"
          className="flex items-center gap-3 border-b border-yacht-900/20 pb-3"
          onSubmit={() => track('not_found_search', { page_path: pathname })}
        >
          <Search className="h-5 w-5 flex-none text-yacht-900/40" aria-hidden="true" />
          <input
            type="search"
            name="q"
            aria-label="Search the FYI Yachts inventory"
            placeholder="Search the inventory — builder, model, or length"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] font-light text-yacht-900 placeholder:text-yacht-900/45 focus:outline-none"
          />
          <button
            type="submit"
            className="flex-none bg-yacht-brand px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
          >
            Search
          </button>
        </form>

        <div className="mt-14 grid gap-12 lg:grid-cols-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Browse by type</h2>
            <ul className="mt-5 space-y-2.5">
              {CATEGORY_PAGES.map((c) => (
                <li key={c.slug}>
                  <Link to={`/${c.slug}`} className="text-[15px] font-light text-yacht-900/75 transition-colors hover:text-yacht-brand">
                    {c.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Popular builders</h2>
            <ul className="mt-5 space-y-2.5">
              {BRAND_PAGES.slice(0, 10).map((b) => (
                <li key={b.slug}>
                  <Link to={`/${b.slug}`} className="text-[15px] font-light text-yacht-900/75 transition-colors hover:text-yacht-brand">
                    {b.name} yachts
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Or start here</h2>
            <ul className="mt-5 space-y-2.5">
              {([
                ['Sell your yacht', '/sell'],
                ['Charter a yacht in Miami', '/charter'],
                ['Yacht financing', '/yacht-financing'],
                ['Sold yachts', '/sold-yachts'],
                ['Client results', '/case-studies'],
                ['Meet the team', '/our-team'],
                ['FYI News', '/fyi-news'],
                ['Contact us', '/contact'],
              ] as [string, string][]).map(([label, href]) => (
                <li key={href}>
                  <Link to={href} className="text-[15px] font-light text-yacht-900/75 transition-colors hover:text-yacht-brand">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <a
              href="tel:+13058546020"
              onClick={() => track('phone_click', { context: '404 page', placement: 'body' })}
              className="mt-8 inline-flex items-center gap-3 bg-yacht-900 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-900/90"
            >
              <Phone className="h-4 w-4 text-yacht-teal" aria-hidden="true" />
              305-854-6020
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="mt-3 text-[13px] font-light text-yacht-900/55">{RESPONSE_PROMISE}</p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
