import { useEffect } from 'react';

/**
 * Per-route SEO plumbing for the public pages: document title, meta
 * description, and a canonical URL.
 *
 * The canonical always points at https://fyiyachts.com + the current path.
 * While these pages preview on the *.vercel.app domain that makes them
 * non-competing duplicates of the live WordPress pages (Google consolidates
 * to the canonical), and after the domain cutover the same tag becomes a
 * correct self-referencing canonical — no code change needed at migration.
 */
export function usePageMeta(
  title: string,
  description: string,
  canonicalPath?: string,
  alternates?: { hreflang: string; path: string }[],
): void {
  useEffect(() => {
    document.title = title;

    const altEls: HTMLLinkElement[] = [];
    for (const alt of alternates ?? []) {
      const el = document.createElement('link');
      el.rel = 'alternate';
      el.hreflang = alt.hreflang;
      el.href = `https://fyiyachts.com${alt.path}`;
      document.head.appendChild(el);
      altEls.push(el);
    }

    let desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!desc) {
      desc = document.createElement('meta');
      desc.name = 'description';
      document.head.appendChild(desc);
    }
    // Keep the prerendered description when it was built for this exact route:
    // the build has data the client does not (live inventory counts and price
    // ranges on the hub pages), so overwriting it on mount would downgrade the
    // snippet Google renders. Any other route — a client-side navigation away
    // from the prerendered one — falls through to the normal write.
    const staticFor = desc.getAttribute('data-static-path');
    const keepStatic = !!staticFor && staticFor === window.location.pathname.replace(/(.)\/+$/, '$1');
    const prevDesc = desc.content;
    if (!keepStatic) desc.content = description;

    let canon = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevCanon = canon?.href;
    if (canonicalPath) {
      if (!canon) {
        canon = document.createElement('link');
        canon.rel = 'canonical';
        document.head.appendChild(canon);
      }
      canon.href = `https://fyiyachts.com${canonicalPath}`;
    }

    return () => {
      if (desc && !keepStatic) desc.content = prevDesc;
      if (canon && prevCanon) canon.href = prevCanon;
      else canon?.remove();
      altEls.forEach((el) => el.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonicalPath, JSON.stringify(alternates ?? [])]);
}
