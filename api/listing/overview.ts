// AI-written listing overview (FYI meeting 2026-07-07: "AI overview that
// reads human"). GET ?id=<DocumentID> → { overview } — 3-4 warm, factual
// sentences composed from the feed data only. Reuses the same
// OPENAI_API_KEY that powers Brianna; per-instance cache keeps repeat
// views free. Silently 404s when the key is absent so the UI hides.
import OpenAI from 'openai';

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(name: string, value: string): VercelResponse;
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  end(): VercelResponse;
};

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

const cache = new Map<string, { text: string; at: number }>();
const TTL = 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) return res.status(404).json({ error: 'not configured' });

  const id = String(req.query?.id || '').replace(/[^0-9]/g, '');
  if (!id) return res.status(400).json({ error: 'id required' });

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json({ overview: hit.text, cached: true });
  }

  try {
    const url = new URL(UPSTREAM);
    url.searchParams.set('key', KEY);
    url.searchParams.set('documentid', id);
    const feed = await fetch(url).then((r) => r.json()) as { results?: Record<string, unknown>[] };
    const it = feed.results?.[0] as Record<string, any> | undefined;
    if (!it) return res.status(404).json({ error: 'listing not found' });

    const loc = it.BoatLocation || {};
    const facts = {
      name: it.BoatName || undefined,
      year: it.ModelYear,
      make: it.MakeString,
      model: it.Model,
      lengthFt: it.LengthOverall ?? it.NominalLength,
      condition: it.SaleClassCode,
      type: it.BoatCategoryCode,
      cabins: it.CabinsCountNumeric,
      beam: it.BeamMeasure,
      engines: Array.isArray(it.Engines) ? it.Engines.length : undefined,
      engineMake: Array.isArray(it.Engines) ? it.Engines[0]?.Make : undefined,
      cruiseSpeed: it.CruisingSpeedMeasure,
      maxSpeed: it.MaximumSpeedMeasure,
      city: loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : undefined,
      state: loc.BoatStateCode,
      description: typeof it.GeneralBoatDescription === 'string'
        ? it.GeneralBoatDescription.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 2500)
        : undefined,
    };

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You write short vessel overviews for a luxury yacht brokerage website (FYI Yachts, Miami). ' +
            'Write 3-4 sentences in a warm, knowledgeable, human voice — the way an experienced broker would describe the boat to a serious buyer. ' +
            'Use ONLY the facts provided; never invent features, history, or condition claims. No bullet lists, no headings, no exclamation marks, ' +
            'no clichés like "turnkey", "pride of ownership", or "won\'t last". Do not mention the price or that you are an AI.',
        },
        { role: 'user', content: JSON.stringify(facts) },
      ],
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return res.status(502).json({ error: 'empty completion' });

    cache.set(id, { text, at: Date.now() });
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json({ overview: text });
  } catch (err: unknown) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'overview failed' });
  }
}
