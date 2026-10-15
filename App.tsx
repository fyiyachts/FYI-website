import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthProvider';
import LoginPage from './components/auth/LoginPage';
import QuizUnavailablePage from './components/quiz/QuizUnavailablePage';
import NotFoundPage from './components/public/NotFoundPage';
import ThankYouPage from './components/public/ThankYouPage';
import { CaseStudiesPage, CaseStudyPage } from './components/public/CaseStudies';
import HomePage from './components/home/HomePage';
import {
  BrandInventoryPage, CategoryInventoryPage, SoldYachtsPage,
  SellPage, FinancingPage, LeaseToOwnPage, AboutPage, ContactPage,
} from './components/public/PublicPages';
import { CharterPage, CharterVesselPage } from './components/public/CharterPages';
import { BRAND_PAGES, CATEGORY_PAGES } from './components/public/publicData';
import { trackRouteChange } from './utils/hubspotTracking';
import { track } from './utils/analytics';
import { OurTeamPage, ConsultantPage } from './components/public/TeamPublicPages';
import { ContentPage } from './components/public/ContentPage';
import { CONTENT_PAGES } from './components/public/contentData';
import { NewsIndexPage, NewsArticlePage, NewsArticleOr404 } from './components/news/NewsPages';
import { NEWS_SLUGS } from './components/news/newsSlugs';
import { EsHomePage, EsSellPage, EsCharterPage, EsInventoryPage, EsFinancingPage, EsTeamPage, EsContactPage } from './components/es/EsPages';
import { ES_TO_EN } from './components/es/esRoutes';
import { YACHT_MATCH_ENABLED, SPANISH_ENABLED } from './utils/featureFlags';

// The authenticated portal is code-split so public/SEO visitors never
// download the dashboard, admin, search, charts, or chat bundles.
const PortalRoutes = lazy(() => import('./components/portal/PortalRoutes'));

// Client-only pages are code-split too: none of them is prerendered (their
// URLs serve the empty SPA shell and fetch data on mount), so splitting them
// costs no static-shell flash — it only keeps the quiz, the chat embed, and
// the two listing-detail pages out of the JS every SEO landing page parses.
const BriannaEmbedPage = lazy(() => import('./components/chat/BriannaEmbedPage'));
const QuizPage = lazy(() => import('./components/quiz/QuizPage'));
const PublicListingPage = lazy(() => import('./components/listing/PublicListingPage'));

function PortalFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-yacht-900">
      <div className="w-8 h-8 border-2 border-yacht-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Legacy bare portal paths (from before the app moved to /app) — bookmarks
// and old links land here and get redirected to their /app equivalent
// instead of hard-404ing. The live portal itself is mounted at /app/* below.
//
// ⚠️ Keep this in lockstep with the SPA rewrites in vercel.json: this list
// decides what the *client* redirects, that list decides what the *server*
// redirects with a 301 instead of routing to /api/not-found. A path added to
// one and not the other either 404s a legacy bookmark or leaves it live at
// the old URL.
const LEGACY_PORTAL_PREFIXES = [
  'internal-stats', 'admin', 'search', 'newest', 'for-you', 'new-build',
  'yacht', 'saved', 'compare', 'price-drops', 'team',
];

function isLegacyPortalPath(pathname: string): boolean {
  const first = pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  return LEGACY_PORTAL_PREFIXES.includes(first);
}

// Final catch-all: migrated fyiyachts.com news articles live at their exact
// root-level WordPress slugs (280 of them — too many to enumerate as
// routes), so unmatched single-segment paths are checked against the
// static slug set first, then legacy bare portal paths get redirected to
// their /app equivalent, then 404.
function NewsOrPortalOr404() {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\/+|\/+$/g, '');
  if (NEWS_SLUGS.has(slug)) return <NewsArticlePage slug={slug} />;
  if (isLegacyPortalPath(pathname)) return <Navigate to={`/app${pathname}`} replace />;
  // NEWS_SLUGS is generated at migration time, so it cannot know about an
  // article published from the AI-Marketer Studio since the last build. Ask
  // the archive and the journal feed before calling the URL a 404 — a
  // single-segment path is the shape every FYI article has.
  if (/^[a-z0-9%._-]+$/i.test(slug)) return <NewsArticleOr404 slug={slug} />;
  return <NotFoundPage />;
}

// Legacy /worldwide-listings visitors (bookmarks, backlinks, and the news
// archive's own hardcoded links) land on /yachts-for-sale. Query params
// (?make=, ?length=, etc.) carry over to its filters.
function WorldwideListingsRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/yachts-for-sale', search }} replace />;
}

// SPA navigations keep the previous scroll offset, so following a link from
// far down a long page (e.g. /charter#fleet → /charter/:slug) used to land you
// near the bottom of the new page. Reset to the top on every path change, but
// leave in-page hash links (#fleet, #inquire) alone so anchors still work.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    // Hash links (/charter#fleet) land before React has rendered the target,
    // so the browser's own anchor jump finds nothing and stays at the top.
    // Poll briefly for the element, then scroll it into view ourselves.
    const id = decodeURIComponent(hash.slice(1));
    let frame = 0;
    let raf = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView(); return; }
      if (frame++ < 60) raf = requestAnimationFrame(tryScroll);
    };
    raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);
  return null;
}

// Attribution runtime: reports SPA navigations to HubSpot analytics (the
// tracking script only sees the initial load on its own) and fires a GA4
// click_to_call event on any tel: tap — the one signal the site can capture
// before a phone conversion leaves the web entirely.
function AttributionRuntime() {
  const { pathname } = useLocation();
  useEffect(() => { trackRouteChange(pathname); }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="tel:"]');
      if (a) track('click_to_call', { page_path: window.location.pathname });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <AttributionRuntime />
      <Routes>
        {/* The authenticated portal — dashboard, search, saved, admin, etc.
            Code-split so public/SEO visitors never download its bundle. */}
        <Route
          path="/app/*"
          element={<Suspense fallback={<PortalFallback />}><PortalRoutes /></Suspense>}
        />
        <Route path="/login" element={<LoginPage />} />
        {/* Public: the Brianna chatbot iframe target for fyiyachts.com. */}
        <Route path="/brianna" element={<Suspense fallback={<PortalFallback />}><BriannaEmbedPage /></Suspense>} />
        {/* Public: the Yacht Match Platform landing (quiz + portal signup),
            linked from fyiyachts.com via public/quiz-embed.js. */}
        <Route path="/quiz" element={YACHT_MATCH_ENABLED ? <Suspense fallback={<PortalFallback />}><QuizPage /></Suspense> : <QuizUnavailablePage />} />
        {/* Public: single-listing detail by DocumentID — the target for the
            fyiyachts.com broker-listings embed (public/broker-listings.js). */}
        <Route path="/listing/:id" element={<Suspense fallback={<PortalFallback />}><PublicListingPage /></Suspense>} />
        {/* Retired worldwide-search detail pages land on the inventory page. */}
        <Route path="/worldwide-listing/:slug" element={<Navigate to="/yachts-for-sale" replace />} />
        {/* Public: FYIyachts.com homepage — Ritz-Carlton-inspired art
            direction on FYI brand colors/fonts. */}
        <Route path="/" element={<HomePage />} />
        {/* Legacy URL from before the homepage moved to root. */}
        <Route path="/homepage" element={<Navigate to="/" replace />} />
        {/* Public: SEO-parity pages mirroring fyiyachts.com's exact slugs
            (page-sitemap.xml) so the future domain cutover keeps every
            ranking URL. Canonicals point at fyiyachts.com until then. */}
        {CATEGORY_PAGES.map((c) => (
          <Route key={c.slug} path={`/${c.slug}`} element={<CategoryInventoryPage config={c} />} />
        ))}
        {/* Merged into /yachts-for-sale. The bare path 301s server-side
            (vercel.json); this only catches in-app navigations and preserves
            query params. */}
        <Route path="/worldwide-listings" element={<WorldwideListingsRedirect />} />
        {BRAND_PAGES.map((b) => (
          <Route key={b.slug} path={`/${b.slug}`} element={<BrandInventoryPage brand={b} />} />
        ))}
        <Route path="/sold-yachts" element={<SoldYachtsPage />} />
        {/* Spanish tier — natively written, hreflang-paired with English.
            Held back behind SPANISH_ENABLED while the English site is still
            being revised (client, 2026-08-13) — each /es/* path redirects to
            its English counterpart instead of rendering while off. */}
        {SPANISH_ENABLED ? (
          <>
            <Route path="/es" element={<EsHomePage />} />
            <Route path="/es/vender" element={<EsSellPage />} />
            <Route path="/es/charter" element={<EsCharterPage />} />
            <Route path="/es/inventario" element={<EsInventoryPage />} />
            <Route path="/es/financiamiento" element={<EsFinancingPage />} />
            <Route path="/es/equipo" element={<EsTeamPage />} />
            <Route path="/es/contacto" element={<EsContactPage />} />
          </>
        ) : (
          Object.entries(ES_TO_EN).map(([es, en]) => (
            <Route key={es} path={es} element={<Navigate to={en} replace />} />
          ))
        )}
        {/* Migrated news archive: index + 280 articles at exact WP slugs
            (articles resolve via the NewsOrPortal catch-all below). WP
            category archives collapse into the filterable index. */}
        <Route path="/fyi-news" element={<NewsIndexPage />} />
        {/* WP category archives collapse into the filterable index. The real
            redirect is a 301 in vercel.json — this client route only catches
            in-app navigations, since the edge answers direct hits first. */}
        <Route path="/category/*" element={<Navigate to="/fyi-news" replace />} />
        <Route path="/charter" element={<CharterPage />} />
        <Route path="/yacht-charter" element={<CharterPage />} />
        {/* A real page per charter vessel — what FYI was promised. */}
        <Route path="/charter/:slug" element={<CharterVesselPage />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/yacht-financing" element={<FinancingPage />} />
        <Route path="/lease-to-own" element={<LeaseToOwnPage />} />
        <Route path="/about-us" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        {/* Conversion destination for every public form — gives GA4/Ads a URL
            to fire against, which an inline confirmation never had. */}
        <Route path="/thank-you" element={<ThankYouPage />} />
        {/* Narrative proof: published closings told as deals, sourced from
            FYI's own announcements (components/public/caseStudyData.ts). */}
        <Route path="/case-studies" element={<CaseStudiesPage />} />
        <Route path="/case-studies/:slug" element={<CaseStudyPage />} />
        {/* Public team pages — roster + per-consultant profiles fed by the
            BoatsGroup SalesRep feed. Slugs mirror fyiyachts.com; the site's
            few top-level broker URLs redirect into /consultants/. */}
        <Route path="/our-team" element={<OurTeamPage />} />
        <Route path="/consultants" element={<OurTeamPage />} />
        {/* The live site misspells Hiram's slug — keep it reachable. */}
        <Route path="/consultants/hiram-conception" element={<Navigate to="/consultants/hiram-concepcion" replace />} />
        {/* Departed brokers: profile URLs from the WP sitemap redirect to
            the roster instead of 404ing. */}
        <Route path="/consultants/peter-kelly" element={<Navigate to="/our-team" replace />} />
        {/* Consultants removed from the roster (client, 2026-07-28) — their
            profile URLs bounce to the team page instead of 404ing. */}
        <Route path="/consultants/rey-lucena" element={<Navigate to="/our-team" replace />} />
        <Route path="/consultants/robert-damas" element={<Navigate to="/our-team" replace />} />
        <Route path="/consultants/nathaly-noy" element={<Navigate to="/our-team" replace />} />
        <Route path="/consultants/michael-macia" element={<Navigate to="/our-team" replace />} />
        <Route path="/consultants/pietro-lucchese" element={<Navigate to="/our-team" replace />} />
        <Route path="/consultants/:slug" element={<ConsultantPage />} />
        <Route path="/ralph-navarro" element={<Navigate to="/consultants/ralph-navarro" replace />} />
        <Route path="/maria-palacios" element={<Navigate to="/consultants/maria-palacios" replace />} />
        <Route path="/arney-mendez" element={<Navigate to="/consultants/arney-mendez" replace />} />
        <Route path="/andrea-mont-2" element={<Navigate to="/consultants/andrea-mont" replace />} />
        <Route path="/fyi-giovanni-tummolillo" element={<Navigate to="/consultants/giovanni-tummolillo" replace />} />
        {/* Public: migrated fyiyachts.com content/SEO pages — copy captured
            verbatim from the live WordPress site (contentData.ts). */}
        {CONTENT_PAGES.map((c) => (
          <Route key={c.slug} path={`/${c.slug}`} element={<ContentPage data={c} />} />
        ))}
        {/* Legacy fyiyachts.com slugs (duplicates, renamed pages, retired
            single-yacht pages) — redirected so no ranking URL 404s after
            cutover. Junk/test and form thank-you pages are intentionally
            not mirrored; they get noindex/410 at cutover. */}
        <Route path="/sea-ray-boats-for-sale-2" element={<Navigate to="/sea-ray-boats-for-sale" replace />} />
        <Route path="/riva-yachts-for-sale-new" element={<Navigate to="/riva-yachts-for-sale" replace />} />
        <Route path="/sanlorenzo-yachts-for-sale-new" element={<Navigate to="/sanlorenzo-yachts-for-sale" replace />} />
        <Route path="/center-console-boats-for-sale-old-page" element={<Navigate to="/center-console-boats-for-sale" replace />} />
        <Route path="/sold-yachts-new" element={<Navigate to="/sold-yachts" replace />} />
        <Route path="/all-about-florida-yachts-international-in-miami" element={<Navigate to="/about-us" replace />} />
        <Route path="/favorites" element={<Navigate to="/app/saved" replace />} />
        {['home-2023', 'home-2024', 'home-3'].map((s) => (
          <Route key={s} path={`/${s}`} element={<Navigate to="/" replace />} />
        ))}
        {/* Retired single-listing pages → live inventory. */}
        {['regal-38-2002-38-regal-boats-2002', 'pain-killer-42-tiara-boats-2003',
          'arena-92-pershing-motor-yacht-2013', '84-sunseeker-motor-yacht-2000',
          '62-prestige-motor-yacht-2013', 'azimut-105'].map((s) => (
          <Route key={s} path={`/${s}`} element={<Navigate to="/yachts-for-sale" replace />} />
        ))}
        {/* WP charter photo galleries → the matching per-vessel charter page,
            which now carries those same galleries. */}
        {([
          ['photo-gallery-69-ft-sunseeker-charter', 'sunseeker-69'],
          ['photo-gallery-86-ft-azimut-charter', 'azimut-86'],
          ['photo-gallery-92-ft-riva-privilegio-charter', 'riva-92-privilegio'],
        ] as [string, string][]).map(([from, slug]) => (
          <Route key={from} path={`/${from}`} element={<Navigate to={`/charter/${slug}`} replace />} />
        ))}
        {/* Past boat-show pages → news landing. */}
        {['flibs-2022', 'boat-show-in-fort-lauderdale-florida', 'soflo-boat-show-2024',
          'ft-lauderdale-international-boat-show-2024', 'miami-international-boat-show-nhd-2025',
          'miami-international-boat-show-okean-2025', 'miami-show-boats', 'mibs-2026'].map((s) => (
          <Route key={s} path={`/${s}`} element={<Navigate to="/fyi-news" replace />} />
        ))}
        {/* Explicit 404 route, so the SPA can navigate to it directly. */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/*" element={<NewsOrPortalOr404 />} />
      </Routes>
    </AuthProvider>
  );
}
