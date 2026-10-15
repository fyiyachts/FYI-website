import { useEffect } from 'react';

// Inject a schema.org JSON-LD block for the current page (used by the
// dynamic listing pages, where the build-time prerender can't know the
// data). Static public pages get their JSON-LD from scripts/prerender.mjs.
export function useJsonLd(id: string, data: object | null): void {
  useEffect(() => {
    if (!data) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.jsonld = id;
    el.text = JSON.stringify(data).replace(/</g, '\\u003c');
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [id, data]);
}
