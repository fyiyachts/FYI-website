// YouTube videos on FYI's exclusive listings.
//
// The inventory feed carries a listing's videos in `Videos.url` and
// `EmbeddedVideo` ("url|" strings): YouTube links (youtu.be/…, youtube.com/
// watch?v=…, /embed/, /shorts/) and boats.com-hosted .mp4 files. The YouTube
// ones that can actually be watched on our site — public and embeddable,
// checked with YouTube's oEmbed endpoint — are attached to the row as
// `FyiVideos: [{ id, title }]`; the listing page shows them in the gallery
// right after the main photo.
//
// oEmbed answers 401 (embedding disabled), 403 or 404 (private, removed) for a
// video we can't show, which is a definite "no". A timeout or network error is
// not: the video is shown (fail open) rather than lose it to a slow YouTube.
// Answers are cached per lambda instance — 6 h for a yes, 1 h for a no — so a
// listing view costs YouTube at most one call per video.

export interface ListingVideo { id: string; title?: string }

const YT_ID = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/;
const OK_TTL_MS = 6 * 3600_000;
const NO_TTL_MS = 3600_000;
const CHECK_TIMEOUT_MS = 1_500;
const MAX_VIDEOS = 5;

const cache = new Map<string, { ok: boolean; title?: string; at: number }>();

/** The YouTube video IDs a feed row links to, in feed order, without repeats. */
export function youtubeIds(it: Record<string, any>): string[] {
  const v = it?.Videos;
  const urls: unknown[] = [
    ...(Array.isArray(v?.url) ? v.url : []),
    ...(Array.isArray(it?.EmbeddedVideo) ? it.EmbeddedVideo.map((s: unknown) => String(s ?? '').split('|')[0]) : []),
  ];
  const ids: string[] = [];
  for (const u of urls) {
    const m = YT_ID.exec(String(u ?? ''));
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids.slice(0, MAX_VIDEOS);
}

async function check(id: string): Promise<{ ok: boolean; title?: string }> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < (hit.ok ? OK_TTL_MS : NO_TTL_MS)) return hit;
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    if (r.ok) {
      const d = (await r.json().catch(() => null)) as { title?: unknown } | null;
      const res = { ok: true, title: typeof d?.title === 'string' ? d.title : undefined, at: Date.now() };
      cache.set(id, res);
      return res;
    }
    if ([400, 401, 403, 404].includes(r.status)) {
      const res = { ok: false, at: Date.now() };
      cache.set(id, res);
      return res;
    }
    return { ok: true }; // YouTube hiccup (5xx, 429): not a "no"
  } catch {
    return { ok: true }; // timeout / network: fail open, uncached
  }
}

/**
 * Attach the watchable YouTube videos to an exclusive's feed row, in place, as
 * `FyiVideos`. Co-brokerage rows are left alone. Never throws.
 */
export async function attachListingVideos<T extends Record<string, any>>(it: T): Promise<T> {
  try {
    if (!it || it.ListingType === 'cobrokerage') return it;
    const ids = youtubeIds(it);
    if (!ids.length) return it;
    const results = await Promise.all(ids.map(check));
    const videos: ListingVideo[] = ids
      .map((id, i) => (results[i].ok ? { id, ...(results[i].title ? { title: results[i].title } : {}) } : null))
      .filter((x): x is ListingVideo => !!x);
    if (videos.length) (it as Record<string, any>).FyiVideos = videos;
  } catch { /* videos are extras: never fail the listing */ }
  return it;
}
