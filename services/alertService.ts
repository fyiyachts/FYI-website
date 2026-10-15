import { getSavedBoats, getSavedSearches } from './storageService';
import { getAttribution } from '../utils/attribution';
import type { SavedBoat, SavedSearch } from '../types/user';

// The distinct boat brands (make) a user has shown interest in — from their saved
// boats' specs and their saved-search filters. This is the raw material for FYI
// HubSpot brand segmentation; captured here so the server can persist it.
function extractBrands(boats: SavedBoat[], searches: SavedSearch[]): string[] {
  const brands = new Set<string>();
  for (const b of boats) {
    const make = b.specs?.make?.trim();
    if (make) brands.add(make);
  }
  for (const s of searches) {
    const f = s.filters || {};
    const make = f.make ?? f.makeFilter;
    if (typeof make === 'string' && make.trim()) brands.add(make.trim());
  }
  return [...brands];
}

export async function syncAlertSubscription(email: string): Promise<void> {
  const boats = getSavedBoats();
  const searches = getSavedSearches();

  const savedBoats = boats.map(b => ({
    id: b.id,
    title: b.title,
    make: b.specs?.make,
    priceAtSubscribe: b.priceAtSave,
  }));

  const savedSearches = searches
    .filter(s => s.alertsEnabled)
    .map(s => ({
      id: s.id,
      query: s.query,
      filters: s.filters,
      frequency: s.emailFrequency || 'weekly',
      lastResultIds: [] as string[],
    }));

  if (savedBoats.length === 0 && savedSearches.length === 0) return;

  const brands = extractBrands(boats, searches);

  await fetch('/api/alerts/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, savedBoats, savedSearches, brands, attribution: getAttribution() }),
  });
}

/**
 * Turn off market alerts for the signed-in visitor.
 *
 * The address is no longer sent: the endpoint takes it from the verified
 * session cookie, so this can only ever unsubscribe the person making the
 * request. Passing an email did nothing but let anyone unsubscribe anyone.
 *
 * `token` is for the unsubscribe link in an alert email, where there is no
 * session — see api/_lib/unsubscribeToken.ts.
 *
 * Resolves true when the subscription was removed.
 */
export async function unsubscribeAlerts(token?: string): Promise<boolean> {
  const res = await fetch('/api/alerts/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(token ? { token } : {}),
  });
  return res.ok;
}
