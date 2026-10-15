/**
 * What page is the visitor actually looking at?
 *
 * Brianna answers questions like "tell me about this one" or "how much is
 * it?", which are meaningless without knowing the page. This derives a short,
 * human-readable description that rides along with each chat request.
 *
 * Two contexts to handle:
 *  - The floating widget on this site: window.location IS the page.
 *  - The /brianna iframe embedded on fyiyachts.com: window.location is
 *    /brianna, which tells us nothing. document.referrer is the parent page
 *    when framed, so we read that instead — no embed-script change needed.
 */

export interface PageContext {
  url: string;
  path: string;
  title?: string;
  /** DocumentID when the visitor is on a listing detail page. */
  listingId?: string;
  /** Slug when the visitor is on a charter vessel page. */
  charterSlug?: string;
  /** Short label for the kind of page, e.g. "brand page". */
  kind?: string;
}

const KNOWN = [
  [/^\/$/, 'the homepage'],
  [/^\/yachts-for-sale\/?$/, 'the main inventory page'],
  [/^\/sold-yachts\/?$/, 'the recently-sold page'],
  [/^\/charter\/?$/, 'the charter fleet page'],
  [/^\/yacht-charter\/?$/, 'the charter fleet page'],
  [/^\/sell\/?$/, 'the sell-your-yacht page'],
  [/^\/yacht-financing\/?$/, 'the financing page'],
  [/^\/lease-to-own\/?$/, 'the lease-to-own page'],
  [/^\/about-us\/?$/, 'the about page'],
  [/^\/contact\/?$/, 'the contact page'],
  [/^\/our-team\/?$/, 'the team roster'],
  [/^\/consultants\//, 'a broker profile'],
  [/^\/fyi-news\/?$/, 'the news index'],
  [/^\/es(\/|$)/, 'a Spanish-language page'],
] as const;

function describe(path: string): string | undefined {
  for (const [re, label] of KNOWN) if (re.test(path)) return label as string;
  if (/-for-sale\/?$/.test(path) || /-boats-for-sale\/?$/.test(path)) return 'a brand or category inventory page';
  return undefined;
}

export function getPageContext(): PageContext | undefined {
  if (typeof window === 'undefined') return undefined;

  // When framed, the parent page is the real context.
  let href = window.location.href;
  let title: string | undefined = document.title;
  const framed = window.self !== window.top;
  if (framed && document.referrer) {
    href = document.referrer;
    title = undefined; // the parent's title isn't readable cross-origin
  }

  let path: string;
  try {
    path = new URL(href).pathname;
  } catch {
    return undefined;
  }

  const listing = path.match(/^\/listing\/([^/]+)/);
  const charter = path.match(/^\/charter\/([^/]+)/);

  return {
    url: href,
    path,
    title,
    listingId: listing?.[1],
    charterSlug: charter?.[1],
    kind: describe(path),
  };
}
