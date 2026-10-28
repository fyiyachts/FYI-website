// One fetch per URL per session for the site's data endpoints.
//
// Identical requests that are in flight at the same time share one fetch, and
// a successful JSON answer is kept in memory for the rest of the session (the
// feeds change a few times a day), so two components wanting the same data —
// or an SPA hop back to a page — never ask the proxy twice. Failures are not
// cached: the next caller tries again.

export class HttpError extends Error {
  constructor(public status: number, public retryAfterSec?: number) {
    super(`HTTP ${status}`);
  }
}

const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, { at: number; data: unknown }>();
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function fetchJsonShared<T = any>(url: string, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.data as T);
  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;
  const req = fetch(url, { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) {
        const ra = Number(r.headers.get('Retry-After'));
        throw new HttpError(r.status, Number.isFinite(ra) && ra > 0 ? ra : undefined);
      }
      return r.json() as Promise<T>;
    })
    .then((data) => {
      cache.set(url, { at: Date.now(), data });
      return data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, req);
  return req;
}
