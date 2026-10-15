import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PublicShell, PageHero, PublicInquiryForm } from '../public/PublicPages';
import { usePageMeta } from '../../utils/usePageMeta';
import type { NewsIndexEntry } from './newsTypes';
import NotFoundPage from '../public/NotFoundPage';

/**
 * FYI News — the migrated fyiyachts.com article archive (280 posts from
 * post-sitemap.xml, captured 2026-07-22). Each article lives at its exact
 * WordPress slug so every ranking URL survives cutover; content is served
 * as sanitized JSON from /news/<slug>.json (see the extraction pipeline
 * notes in newsSlugs.ts). Canonicals point at fyiyachts.com until cutover.
 * New articles are added as JSON files in public/news (plus an entry in
 * public/news/index.json and newsSlugs.ts).
 */

export type { NewsIndexEntry } from './newsTypes';

interface NewsArticle extends NewsIndexEntry {
  description: string;
  html: string;      // sanitized: whitelist tags only, escaped attributes
}

let indexCache: NewsIndexEntry[] | null = null;

function useNewsIndex() {
  const [entries, setEntries] = useState<NewsIndexEntry[]>(indexCache ?? []);
  const [loading, setLoading] = useState(!indexCache);
  useEffect(() => {
    if (indexCache) return;
    let alive = true;
    fetch('/news/index.json')
      .then(r => r.json())
      .then((archive) => {
        const list: NewsIndexEntry[] = Array.isArray(archive) ? archive : [];
        indexCache = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (alive) setEntries(indexCache);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return { entries, loading };
}

const fmtDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/* ------------------------------------------------------------ index */

const PAGE_SIZE = 24;

export function NewsIndexPage() {
  usePageMeta(
    'FYI News | FYI Yachts',
    'News from Florida Yachts International — new boat listings, boat shows and events, sold yachts, industry news, and yacht tips.',
    '/fyi-news/',
  );
  const { entries, loading } = useNewsIndex();
  const [category, setCategory] = useState('All');
  const [shown, setShown] = useState(PAGE_SIZE);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return ['All', ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)];
  }, [entries]);

  const filtered = useMemo(
    () => (category === 'All' ? entries : entries.filter(e => e.category === category)),
    [entries, category],
  );

  return (
    <PublicShell>
      <PageHero
        eyebrow="News & Events"
        h1="FYI News"
        intro="New listings, boat shows and events, recent sales, industry news, and yacht tips from the FYI Yachts team."
      />
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { setCategory(c); setShown(PAGE_SIZE); }}
              className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                c === category
                  ? 'bg-yacht-brand text-white'
                  : 'bg-white text-yacht-900/60 hover:text-yacht-900'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="animate-pulse bg-white shadow-sm">
                <div className="aspect-[16/10] bg-yacht-900/10" />
                <div className="space-y-3 p-6">
                  <div className="h-2.5 w-24 bg-yacht-900/10" />
                  <div className="h-4 w-3/4 bg-yacht-900/10" />
                  <div className="h-3 w-full bg-yacht-900/10" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, shown).map(e => (
                <a key={e.slug} href={`/${e.slug}`} className="group block overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="aspect-[16/10] overflow-hidden bg-yacht-900/5">
                    {e.image && (
                      <img
                        src={e.image}
                        alt={e.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-yacht-brand">{e.category}</p>
                    <h3 className="mt-2 line-clamp-2 text-[15px] font-medium leading-snug tracking-wide text-yacht-900">{e.title}</h3>
                    <p className="mt-3 line-clamp-2 text-[13px] font-light leading-6 text-yacht-900/60">{e.excerpt}</p>
                    <p className="mt-4 text-[11px] font-light tracking-wider text-yacht-900/40">{fmtDate(e.date)}</p>
                  </div>
                </a>
              ))}
            </div>
            {shown < filtered.length && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setShown(s => s + PAGE_SIZE)}
                  className="inline-flex items-center gap-2 bg-yacht-900 px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand"
                >
                  Load more ({filtered.length - shown} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </PublicShell>
  );
}

/* ---------------------------------------------------------- article */

/**
 * Resolve an unknown root-level slug: an article (static JSON) or the 404
 * page. The edge answers most direct hits before this runs (prerendered
 * HTML); this path covers in-app navigation.
 */
export function NewsArticleOr404({ slug }: { slug: string }) {
  const [state, setState] = useState<'checking' | 'found' | 'missing'>('checking');

  useEffect(() => {
    let alive = true;
    setState('checking');
    fetch(`/news/${slug}.json`, { method: 'HEAD' })
      .then(r => r.ok)
      .catch(() => false)
      .then(found => { if (alive) setState(found ? 'found' : 'missing'); });
    return () => { alive = false; };
  }, [slug]);

  if (state === 'checking') return null;
  return state === 'found' ? <NewsArticlePage slug={slug} /> : <NotFoundPage />;
}

export function NewsArticlePage({ slug }: { slug: string }) {
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [failed, setFailed] = useState(false);
  usePageMeta(
    article ? `${article.title} | FYI Yachts` : 'FYI News | FYI Yachts',
    article?.description || '',
    `/${slug}/`,
  );

  useEffect(() => {
    let alive = true;
    setArticle(null);
    setFailed(false);
    fetch(`/news/${slug}.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (alive) setArticle(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [slug]);

  return (
    <PublicShell>
      <header className="bg-yacht-900 px-6 pb-14 pt-32 lg:pt-40">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">
            {article?.category || 'FYI News'}
          </p>
          <h1 className="mt-4 text-3xl font-light leading-tight tracking-wide text-white lg:text-4xl">
            {article?.title ?? (failed ? 'Article unavailable' : ' ')}
          </h1>
          {article?.date && (
            <p className="mt-4 text-[12px] font-light tracking-wider text-white/50">{fmtDate(article.date)}</p>
          )}
        </div>
      </header>

      {failed ? (
        <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:px-0">
          <p className="text-[15px] font-light leading-7 text-yacht-900/70">
            This article could not be loaded. Browse the latest from FYI instead.
          </p>
          <a href="/fyi-news" className="mt-6 inline-flex items-center gap-2 bg-yacht-brand px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light">
            FYI News <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : (
        <article className="mx-auto max-w-3xl px-6 py-14 lg:px-0">
          {article?.image && (
            <img src={article.image} alt={article.title} className="mb-10 w-full object-cover" />
          )}
          {article ? (
            <div
              /* Sanitized at build time: whitelist tags, escaped attrs, no
                 scripts/handlers — see the extraction pipeline (newsSlugs.ts). */
              dangerouslySetInnerHTML={{ __html: article.html }}
              className="news-prose text-[15px] font-light leading-8 text-yacht-900/80
                [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-light [&_h2]:tracking-wide [&_h2]:text-yacht-900 lg:[&_h2]:text-2xl
                [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-normal [&_h3]:tracking-wide [&_h3]:text-yacht-900
                [&_h4]:mt-6 [&_h4]:text-base [&_h4]:font-medium [&_h4]:text-yacht-900
                [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6
                [&_li]:mt-1.5 [&_blockquote]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-yacht-brand [&_blockquote]:pl-5 [&_blockquote]:italic
                [&_a]:text-yacht-brand [&_a]:underline [&_a]:decoration-yacht-brand/30 [&_a]:underline-offset-2 hover:[&_a]:decoration-yacht-brand
                [&_img]:my-8 [&_img]:w-full [&_img]:object-cover
                [&_iframe]:my-8 [&_iframe]:aspect-video [&_iframe]:w-full"
            />
          ) : (
            <div className="animate-pulse space-y-4" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className={`h-3.5 bg-yacht-900/10 ${i % 3 === 2 ? 'w-4/5' : 'w-full'}`} />
              ))}
            </div>
          )}
        </article>
      )}

      {/* The archive ranks for Miami boating-lifestyle queries (dock-and-dine
          etc.) — readers are locals already on the water. Give that traffic a
          direct next step before the generic broker form below. */}
      <section className="border-y border-yacht-900/10 bg-[#f8f6f0] px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-brand">On the water this weekend</p>
            <h2 className="mt-2 text-xl font-light tracking-wide text-yacht-900 lg:text-2xl">
              Charter a crewed yacht in Miami — or find one to call yours.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/charter" className="inline-flex items-center gap-2 bg-yacht-900 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand">
              Charter with FYI <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/yachts-for-sale" className="inline-flex items-center gap-2 border border-yacht-900/25 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand">
              Browse yachts
            </a>
          </div>
        </div>
      </section>

      <section className="bg-yacht-900 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">Talk to a broker</h2>
            <p className="mt-4 text-[15px] font-light leading-7 text-white/70">
              Questions about a vessel or the market? A specialist responds within one business day.
            </p>
            <a href="/fyi-news" className="mt-8 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-teal transition-colors hover:text-white">
              More from FYI News <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <PublicInquiryForm context={`Article: ${article?.title ?? slug}`} dark messagePlaceholder="Your message (optional)" />
        </div>
      </section>
    </PublicShell>
  );
}
