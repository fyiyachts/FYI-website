import { useSyncExternalStore } from 'react';
import { Heart } from 'lucide-react';
import { track } from '../../utils/analytics';

// Logged-out wishlist (meeting requirement: browse + wishlist without an
// account). A tiny localStorage-backed store the public fleet cards use to
// let visitors favorite vessels; the count surfaces in the header, and
// signing into My FYI is offered as the way to save alerts. No account
// needed to collect favorites.
const KEY = 'fyi_wishlist';
const EVT = 'fyi:wishlist';

// Cache the parsed snapshot and only mint a new array reference when the
// stored string actually changes — useSyncExternalStore requires a stable
// reference between reads or it loops (React error #185).
let cachedRaw: string | null = null;
let cachedArr: string[] = [];
function read(): string[] {
  if (typeof localStorage === 'undefined') return cachedArr;
  const raw = localStorage.getItem(KEY) || '[]';
  if (raw === cachedRaw) return cachedArr;
  cachedRaw = raw;
  try {
    const v = JSON.parse(raw);
    cachedArr = Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { cachedArr = []; }
  return cachedArr;
}

function write(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVT));
}

export function toggleWishlist(id: string) {
  const ids = read();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  write(next);
  track(ids.includes(id) ? 'wishlist_remove' : 'wishlist_add', { id });
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb); };
}

// Stable server snapshot avoids hydration mismatch (localStorage is client-only).
const EMPTY: string[] = [];
export function useWishlist(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function WishlistHeart({ id, className = '' }: { id: string; className?: string }) {
  const saved = useWishlist().includes(id);
  return (
    <button
      type="button"
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={saved}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(id); }}
      className={`flex h-9 w-9 items-center justify-center bg-white/90 backdrop-blur-sm transition-colors hover:bg-white ${className}`}
    >
      <Heart className={`h-4 w-4 transition-colors ${saved ? 'fill-yacht-brand text-yacht-brand' : 'text-yacht-900/60'}`} />
    </button>
  );
}
