/**
 * EN ↔ ES route pairs behind the nav language toggle. Every Spanish page is
 * natively written (see EsPages.tsx) — this map is what makes the toggle land
 * on the counterpart page instead of dumping visitors on /es every time.
 * Pages with no Spanish counterpart fall back to /es (and / the other way),
 * which is the honest behaviour: better the Spanish front door than an
 * English page with a Spanish URL.
 */
export const EN_TO_ES: Record<string, string> = {
  '/': '/es',
  '/sell': '/es/vender',
  '/charter': '/es/charter',
  '/yacht-financing': '/es/financiamiento',
  '/our-team': '/es/equipo',
  '/contact': '/es/contacto',
  '/yachts-for-sale': '/es/inventario',
};

export const ES_TO_EN: Record<string, string> = {
  '/es': '/',
  '/es/vender': '/sell',
  '/es/charter': '/charter',
  '/es/financiamiento': '/yacht-financing',
  '/es/equipo': '/our-team',
  '/es/contacto': '/contact',
  '/es/inventario': '/yachts-for-sale',
};

export function isSpanishPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return p === '/es' || p.startsWith('/es/');
}

/** Where the language toggle goes from the current page. */
export function languageToggleTarget(pathname: string): { href: string; label: 'ES' | 'EN' } {
  const p = pathname.replace(/\/$/, '') || '/';
  if (isSpanishPath(p)) return { href: ES_TO_EN[p] ?? '/', label: 'EN' };
  return { href: EN_TO_ES[p] ?? '/es', label: 'ES' };
}
