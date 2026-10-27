// /llms-inventory.txt (rewritten here by vercel.json): FYI's current exclusive
// listings as plain text for AI assistants — one line per boat, longest
// first, each with a link to its page. llms.txt points here.
//
// Exclusives only: FYI's own BoatsGroup book (BOATS_API_KEY) plus the
// hand-entered listings. Co-brokerage (PLS) boats are never listed.

type VercelRequest = { query: Record<string, string | string[]>; method?: string };
type VercelResponse = {
  setHeader(n: string, v: string): VercelResponse;
  status(c: number): VercelResponse;
  send(b: string): VercelResponse;
};

import { MANUAL_LISTINGS } from './_lib/manualListings.js';

const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';
const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');
const ROWS = 400; // FYI's active book runs ~135
const UPSTREAM_TIMEOUT_MS = 10_000;

export const maxDuration = 30;

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();

/** "{Year} {Make} {Model}" — same rule as the site's cards (utils/boatTitle.ts). */
function title(it: Record<string, any>): string {
  const make = clean(it.MakeString);
  let model = clean(it.Model);
  if (make && model.toLowerCase().startsWith(`${make.toLowerCase()} `)) model = model.slice(make.length).trim();
  if (!make && !model) return clean(it.BoatName) || 'Yacht';
  return [clean(it.ModelYear), make, model].filter(Boolean).join(' ');
}

function line(it: Record<string, any>): { len: number; text: string } {
  const loc = it.BoatLocation || {};
  const lengthFt = num(it.LengthOverall ?? it.NominalLength);
  const price = it.PriceHideInd ? undefined : num(it.NormPrice ?? it.Price);
  const name = clean(it.BoatName);
  const t = title(it);
  const city = loc.BoatCityName && loc.BoatCityName !== 'Unknown' ? clean(loc.BoatCityName) : '';
  const where = [city, clean(loc.BoatStateCode) || clean(loc.BoatCountryID)].filter(Boolean).join(', ');
  const parts = [
    `- ${t}${name && !t.toLowerCase().includes(name.toLowerCase()) ? `, "${name}"` : ''}`,
    lengthFt ? `${Math.round(lengthFt)} ft` : 'Length on request',
    price && price > 0 ? `$${Math.round(price).toLocaleString('en-US')}` : 'Price on request',
    ...(where ? [where] : []),
    `${SITE}/listing/${String(it.DocumentID).replace(/[^0-9]/g, '')}`,
  ];
  return { len: lengthFt ?? -1, text: parts.join(' | ') };
}

async function fyiBook(): Promise<Record<string, any>[]> {
  if (!KEY) return [];
  const url = new URL(UPSTREAM);
  url.searchParams.set('key', KEY);
  url.searchParams.set('salesstatus', 'active');
  url.searchParams.set('rows', String(ROWS));
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`boats.com ${res.status}`);
  const body = (await res.json()) as { results?: Record<string, any>[] };
  return body.results ?? [];
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  try {
    const seen = new Set<string>();
    const lines = [...MANUAL_LISTINGS, ...(await fyiBook())]
      .filter((it) => {
        const id = String(it.DocumentID ?? '').replace(/[^0-9]/g, '');
        if (!id || seen.has(id) || it.ListingType === 'cobrokerage') return false;
        seen.add(id);
        return true;
      })
      .map(line)
      .sort((a, b) => b.len - a.len)
      .map((l) => l.text);

    const updated = new Date().toISOString().slice(0, 10);
    const text = [
      `FYI Yachts (Florida Yachts International), Miami — current exclusive listings. Updated ${updated}. Contact +1-305-854-6020, sales@fyiyachts.com.`,
      `${lines.length} listings, longest first. Each line: year builder model, boat name | length | asking price | location | page.`,
      `FYI can also sell ~9,000 co-brokerage yachts listed by other brokerages; search them at ${SITE}/yachts-for-sale.`,
      '',
      ...lines,
      '',
    ].join('\n');

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(text);
  } catch {
    // Never cache a failure for an hour: a short miss, then try the feed again.
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(503).send(
      'FYI Yachts (Florida Yachts International), Miami — the listings feed is temporarily unavailable. '
      + `Browse ${SITE}/yachts-for-sale or contact +1-305-854-6020, sales@fyiyachts.com.\n`,
    );
  }
}
