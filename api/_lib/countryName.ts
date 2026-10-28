// Country names for boat locations. Outside the US the feeds give only a
// two-letter country code, and "ME" (Montenegro) reads as Maine — so
// locations spell the country out. US state codes are not countries and are
// never passed here. Shared by the API (llms-inventory, listing server
// render) and the listing page.

// Common English names where the ICU data uses another form.
const OVERRIDES: Record<string, string> = { TR: 'Turkey' };

let names: Intl.DisplayNames | null = null;

/** "TR" → "Turkey", "FR" → "France"; anything that isn't a 2-letter code passes through. */
export function countryName(code: string | undefined | null): string {
  const c = String(code ?? '').trim();
  if (!/^[A-Za-z]{2}$/.test(c)) return c;
  const up = c.toUpperCase();
  if (OVERRIDES[up]) return OVERRIDES[up];
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(up) || c;
  } catch {
    return c;
  }
}
