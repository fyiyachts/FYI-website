import type { SavedBoat, SavedSearch, PriceSnapshot, RecentlyViewedEntry, UserProfile } from '../types/user';

const KEYS = {
  savedBoats: 'fyi_saved_boats',
  notes: 'fyi_notes',
  recentlyViewed: 'fyi_recently_viewed',
  savedSearches: 'fyi_saved_searches',
  compareList: 'fyi_compare_list',
  priceSnapshots: 'fyi_price_snapshots',
  userProfile: 'fyi_user_profile',
};

function getJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}

function setJson(key: string, value: any): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Saved Boats
export function getSavedBoats(): SavedBoat[] { return getJson(KEYS.savedBoats, []); }
export function saveBoat(boat: SavedBoat): void {
  const boats = getSavedBoats().filter(b => b.id !== boat.id);
  boats.unshift(boat);
  setJson(KEYS.savedBoats, boats);
}
export function unsaveBoat(id: number): void {
  setJson(KEYS.savedBoats, getSavedBoats().filter(b => b.id !== id));
}
export function isBoatSaved(id: number): boolean {
  return getSavedBoats().some(b => b.id === id);
}

// Notes
export function getNotes(): Record<string, string> { return getJson(KEYS.notes, {}); }
export function getNote(boatId: string): string { return getNotes()[boatId] || ''; }
export function setNote(boatId: string, text: string): void {
  const notes = getNotes();
  if (text.trim()) notes[boatId] = text; else delete notes[boatId];
  setJson(KEYS.notes, notes);
}

// Recently Viewed
export function getRecentlyViewed(): RecentlyViewedEntry[] { return getJson(KEYS.recentlyViewed, []); }
export function addRecentlyViewed(entry: RecentlyViewedEntry): void {
  const items = getRecentlyViewed().filter(e => e.id !== entry.id);
  items.unshift(entry);
  setJson(KEYS.recentlyViewed, items.slice(0, 50));
}

// Saved Searches
export function getSavedSearches(): SavedSearch[] { return getJson(KEYS.savedSearches, []); }
export function saveSearch(search: SavedSearch): void {
  const searches = getSavedSearches().filter(s => s.id !== search.id);
  searches.unshift(search);
  setJson(KEYS.savedSearches, searches);
}
export function removeSavedSearch(id: string): void {
  setJson(KEYS.savedSearches, getSavedSearches().filter(s => s.id !== id));
}
export function toggleSearchAlerts(id: string): void {
  const searches = getSavedSearches();
  const search = searches.find(s => s.id === id);
  if (search) search.alertsEnabled = !search.alertsEnabled;
  setJson(KEYS.savedSearches, searches);
}
export function setSearchEmailFrequency(id: string, frequency: 'daily' | 'weekly' | 'off'): void {
  const searches = getSavedSearches();
  const search = searches.find(s => s.id === id);
  if (search) {
    search.emailFrequency = frequency;
    search.alertsEnabled = frequency !== 'off';
  }
  setJson(KEYS.savedSearches, searches);
}

// Compare List
export function getCompareList(): number[] { return getJson(KEYS.compareList, []); }
export function addToCompare(id: number): boolean {
  const list = getCompareList();
  if (list.length >= 6 || list.includes(id)) return false;
  list.push(id);
  setJson(KEYS.compareList, list);
  return true;
}
export function removeFromCompare(id: number): void {
  setJson(KEYS.compareList, getCompareList().filter(i => i !== id));
}
export function isInCompare(id: number): boolean {
  return getCompareList().includes(id);
}
export function clearCompare(): void { setJson(KEYS.compareList, []); }

// User Profile
export function getUserProfile(): UserProfile { return getJson(KEYS.userProfile, { name: '', phone: '', profileImage: '' }); }
export function setUserProfile(profile: UserProfile): void {
  setJson(KEYS.userProfile, profile);
  // Fire-and-forget sync to server
  syncProfileToServer(profile).catch(() => {});
}

export async function syncProfileToServer(profile: UserProfile): Promise<void> {
  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(profile),
  });
}

export async function loadProfileFromServer(): Promise<UserProfile | null> {
  try {
    const res = await fetch('/api/profile', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const { profile } = await res.json();
    if (profile && (profile.name || profile.phone || profile.profileImage)) {
      const local: UserProfile = { name: profile.name || '', phone: profile.phone || '', profileImage: profile.profileImage || '' };
      setJson(KEYS.userProfile, local);
      return local;
    }
    return null;
  } catch {
    return null;
  }
}

// Price Snapshots
export function getPriceSnapshots(): Record<string, PriceSnapshot[]> { return getJson(KEYS.priceSnapshots, {}); }
export function addPriceSnapshot(boatId: string, price: string): void {
  const snapshots = getPriceSnapshots();
  if (!snapshots[boatId]) snapshots[boatId] = [];
  const last = snapshots[boatId][snapshots[boatId].length - 1];
  if (!last || last.price !== price) {
    snapshots[boatId].push({ price, date: Date.now() });
  }
  setJson(KEYS.priceSnapshots, snapshots);
}

// Price Drop Alerts
const PRICE_ALERTS_KEY = 'fyi_price_alerts';
export interface PriceAlert { title: string; price: string; image: string; savedAt: number; }
export function getPriceAlerts(): Record<string, PriceAlert> { return getJson(PRICE_ALERTS_KEY, {}); }
export function setPriceAlert(boatId: string, alert: PriceAlert): void {
  const alerts = getPriceAlerts();
  alerts[boatId] = alert;
  setJson(PRICE_ALERTS_KEY, alerts);
}
export function removePriceAlert(boatId: string): void {
  const alerts = getPriceAlerts();
  delete alerts[boatId];
  setJson(PRICE_ALERTS_KEY, alerts);
}
export function hasPriceAlert(boatId: string): boolean {
  return !!getPriceAlerts()[boatId];
}
