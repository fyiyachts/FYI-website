import { searchInventory, type SearchParams, type InventoryBoat } from '../_lib/briannaInventory.js';

// GET /api/voice/inventory — live FYI inventory search for the ElevenLabs
// phone receptionist (Brianna). Same feed + matcher as the website chatbot
// (api/_lib/briannaInventory), but shaped for a voice agent: a handful of
// compact results the model can read aloud, no image URLs, no descriptions
// beyond a first sentence. Public inventory data — no auth, modest cache.

export const maxDuration = 30;

const num = (v: unknown): number | undefined => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim() ? s.trim() : undefined;
};

const forVoice = (b: InventoryBoat) => ({
  id: b.id,
  name: b.name,
  make: b.make || undefined,
  model: b.model || undefined,
  year: b.year,
  length_ft: b.lengthFt,
  asking_price_usd: b.priceUsd,
  condition: b.condition || undefined,
  category: b.category || undefined,
  location: [b.city, b.state].filter(Boolean).join(', ') || undefined,
  listing_url: `https://fyiyachts.com/listing/${encodeURIComponent(b.id)}`,
  summary: (b.description || '').split(/(?<=[.!?])\s/)[0]?.slice(0, 220) || undefined,
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const q = req.query || {};
  const params: SearchParams = {
    document_id: str(q.document_id),
    query: str(q.query),
    make: str(q.make),
    category: str(q.category),
    condition: str(q.condition),
    min_price: num(q.min_price),
    max_price: num(q.max_price),
    min_length_ft: num(q.min_length_ft),
    max_length_ft: num(q.max_length_ft),
    min_year: num(q.min_year),
    max_year: num(q.max_year),
    sort: str(q.sort) as SearchParams['sort'],
    limit: Math.min(num(q.limit) ?? 5, 8),
  };
  try {
    const { totalActive, matches, queryMatched } = await searchInventory(params);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).json({
      total_active_listings: totalActive,
      matches_shown: matches.length,
      query_matched: queryMatched,
      // Without this the boats below read as answers, and Brianna names hulls
      // the caller never asked about.
      note: queryMatched
        ? undefined
        : `Nothing in FYI's active inventory matches "${params.query ?? ''}". `
          + 'The boats listed are OTHER current listings, not matches. Tell the caller FYI '
          + 'does not currently list that vessel, and offer to connect them with a broker '
          + 'who can track it down — do not read these boats back as if they were it.',
      boats: matches.map(forVoice),
    });
  } catch (err) {
    console.error('[voice/inventory] search failed:', err);
    res.status(502).json({ error: 'inventory temporarily unavailable' });
  }
}
