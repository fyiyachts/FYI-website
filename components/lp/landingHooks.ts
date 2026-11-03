// Hooks the /lp/* route components share: each renders its header + hero
// (hydrated from the prerendered HTML) and fetches the rest of the page as
// its own chunk on mount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { scrollToId } from './LpChrome';

/** noindex for the client-rendered page too; the built HTML (and vercel.json) already say so. */
export function useNoindex(): void {
  useEffect(() => {
    if (document.head.querySelector('meta[name="robots"]')) return;
    const el = document.createElement('meta');
    el.name = 'robots';
    el.content = 'noindex';
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);
}

/**
 * The page's below-the-hero chunk, null until it arrives. One retry: a chunk
 * request can drop on a flaky phone connection. If both fail, the hero's
 * phone number is still there. `load` must be stable (a module-level const).
 */
export function useLazyModule<T>(load: () => Promise<T>): T | null {
  const [mod, setMod] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .catch(() => new Promise((r) => setTimeout(r, 1500)).then(load))
      .then((m) => { if (alive) setMod(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [load]);
  return mod;
}

/**
 * Scroll to a section, or — if it is in the chunk that hasn't arrived yet —
 * as soon as `ready` turns true. For hero links tapped in the first second.
 */
export function useScrollWhenReady(ready: boolean): (id: string, focusId?: string) => void {
  const pending = useRef<{ id: string; focusId?: string } | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!ready || !p) return;
    pending.current = null;
    requestAnimationFrame(() => scrollToId(p.id, p.focusId));
  }, [ready]);
  return useCallback((id: string, focusId?: string) => {
    if (!scrollToId(id, focusId)) pending.current = { id, ...(focusId ? { focusId } : {}) };
  }, []);
}
