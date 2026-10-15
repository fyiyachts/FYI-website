// Feature flags for temporarily switching portal features on or off.

// Yacht Match — the quiz modal, the "Find Your Match" nav entries, and the
// public /quiz landing embedded from fyiyachts.com. Re-enabled (client,
// 2026-08-13).
export const YACHT_MATCH_ENABLED = true;

// Voice search — the mic button in the homepage hero search box, backed by the
// Web Speech API. Hidden because the recognition was misfiring in practice
// (client, 2026-07-31). Flip to true to restore; the implementation is intact
// in HeroSearch, only the control is withheld.
export const VOICE_SEARCH_ENABLED = false;

// Spanish tier (/es, /es/vender, /es/charter, etc.) — natively written and
// hreflang-paired. Held back from 2026-08-13 while the English site was being
// revised (client: get the English site right first, then bring Spanish back);
// re-enabled 2026-08-21 at the client's request now that revision has landed;
// switched back off 2026-08-25 (client: no Spanish version of the site yet).
// Off means the ES/EN nav toggle is hidden and every /es path 301s to its
// English counterpart — the pages and copy stay in the repo, so re-enabling is
// this flag plus the seven redirect entries again.
//
// This flag and the /es redirects in vercel.json are TWO separate switches and
// must move together. Removing the redirects alone leaves the prerendered
// Spanish HTML served to crawlers on a 200 while this flag sends every human
// visitor to the English page on hydration — search engines see one page and
// users see another, which is cloaking. If Spanish ever goes back off, turn
// both off in the same change.
export const SPANISH_ENABLED = false;
