// Price history in Upstash KV — the only source of "Price Reduced".
//
// The BoatsGroup feeds carry no previous-price field (checked 2026-11-13: an
// unfiltered inventory record has Price, NormPrice, OriginalPrice and
// PriceHideInd only, and OriginalPrice is the price in the listing's original
// currency, NOT a pre-reduction price). So api/cron/price-snapshot.ts records
// every active boat's asking price once a day and notes when it goes down.
// Reductions therefore exist only from the first snapshot forward: a price
// that went down before then cannot be dated, so it is not shown.
//
// Storage (all written by the cron, read by everything else):
//   price:hist:<0-9>     hash, DocumentID → PriceRecord JSON. Ten hashes keyed
//                        by the id's last digit keep each read under ~250 KB.
//   price:reduced        JSON { updated, items: { id: Reduction } } — every
//                        boat inside its 90-day "Price Reduced" window. Small:
//                        the cards and the listing page badge read this.
//   price:reduced:cards  JSON array of card-shaped feed rows for those boats —
//                        the "Price reduced" filter on /yachts-for-sale.
//   price:drops          the older exclusives-only list the portal page reads.
//
// Every function no-ops (null / empty) when KV is not configured.

import { manualReductions } from './listingOverrides.js';

const KV_URL = (process.env.KV_REST_API_URL || '').replace(/\/$/, '');
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

/** How long a reduction is shown after the price went down. */
export const REDUCED_WINDOW_DAYS = 90;
const SHARDS = 10;

export const kvConfigured = (): boolean => !!KV_URL && !!KV_TOKEN;

export interface PriceRecord {
  /** Asking price in the listing's own currency; absent while the price is hidden. */
  price?: number;
  currency?: string;
  /** USD equivalent from the feed (sorting only — never compared across days for non-USD boats). */
  normPrice?: number;
  /** First day the snapshot saw this boat (YYYY-MM-DD). */
  firstSeen: string;
  /** Last day the asking price changed. */
  lastChanged?: string;
  /** The asking price before the latest reduction; cleared when the price goes back up. */
  previousPrice?: number;
  /** 'e' FYI exclusive (incl. hand-entered), 'c' co-brokerage. */
  type: 'e' | 'c';
  /** Enough to suggest similar boats once this one has left the feed. */
  make?: string;
  lengthFt?: number;
  /** Day the boat was first missing from the feed; cleared if it returns. */
  gone?: string;
}

export interface Reduction {
  /** Previous asking price, in `currency`. */
  previous: number;
  /** Current asking price, in `currency`. */
  price: number;
  currency: string;
  /** Day the price went down (YYYY-MM-DD). */
  date: string;
  /** Whole-percent size of the reduction. */
  pct: number;
}

export const today = (): string => new Date().toISOString().slice(0, 10);

const daysAgo = (n: number): string => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/** The reduction to show for a record, or null: hidden prices and old drops never show. */
export function reductionOf(rec: PriceRecord | null | undefined, now = today()): Reduction | null {
  if (!rec || rec.gone || !rec.price || !rec.previousPrice || !rec.lastChanged) return null;
  if (rec.previousPrice <= rec.price) return null;
  // A drop can only be observed on a day after the boat was first recorded.
  if (rec.lastChanged <= rec.firstSeen) return null;
  const cutoff = new Date(Date.parse(now) - REDUCED_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  if (rec.lastChanged < cutoff) return null;
  return {
    previous: rec.previousPrice,
    price: rec.price,
    currency: rec.currency || 'USD',
    date: rec.lastChanged,
    pct: Math.max(1, Math.round(((rec.previousPrice - rec.price) / rec.previousPrice) * 100)),
  };
}

/* ------------------------------------------------ Upstash REST */

export async function kv(command: (string | number)[], timeoutMs = 4_000): Promise<any> {
  if (!kvConfigured()) return null;
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`KV ${command[0]} HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`KV ${command[0]}: ${data.error}`);
  return data.result ?? null;
}

export async function kvPipeline(commands: (string | number)[][], timeoutMs = 15_000): Promise<void> {
  if (!kvConfigured() || !commands.length) return;
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`KV pipeline HTTP ${res.status}`);
}

const parse = <T>(raw: unknown): T | null => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const v = JSON.parse(raw);
    // Older keys were written double-encoded (a JSON string holding JSON).
    return (typeof v === 'string' ? JSON.parse(v) : v) as T;
  } catch {
    return null;
  }
};

export async function kvGetJson<T>(key: string): Promise<T | null> {
  return parse<T>(await kv(['GET', key]));
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
  await kv(['SET', key, JSON.stringify(value)], 15_000);
}

const shardKey = (id: string): string => `price:hist:${Number(id.slice(-1)) % SHARDS || 0}`;

/* ------------------------------------------------ readers */

/** One boat's record. Null on a miss, an error, or with KV off — never throws. */
export async function getPriceRecord(id: string): Promise<PriceRecord | null> {
  if (!/^\d+$/.test(id)) return null;
  let rec: PriceRecord | null = null;
  if (kvConfigured()) {
    try {
      rec = parse<PriceRecord>(await kv(['HGET', shardKey(id), id], 2_500));
    } catch { /* fall through */ }
  }
  return withManualReduction(id, rec);
}

/**
 * A reduction entered by hand (api/_lib/listingOverrides.ts, while BoatWizard
 * can't be edited) wins over the recorded history for that boat.
 */
function withManualReduction(id: string, rec: PriceRecord | null): PriceRecord | null {
  const m = manualReductions()[id];
  if (!m) return rec;
  const dayBefore = new Date(Date.parse(m.date) - 864e5).toISOString().slice(0, 10);
  return {
    ...(rec || { type: 'e' as const }),
    price: m.price,
    currency: m.currency,
    previousPrice: m.previous,
    lastChanged: m.date,
    firstSeen: rec?.firstSeen && rec.firstSeen < m.date ? rec.firstSeen : dayBefore,
    gone: undefined,
  };
}

/** The whole history, id → record (the cron's starting point). Throws on a KV error. */
export async function getAllPriceRecords(): Promise<Map<string, PriceRecord>> {
  const out = new Map<string, PriceRecord>();
  if (!kvConfigured()) return out;
  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) => kv(['HGETALL', `price:hist:${i}`], 20_000)),
  );
  for (const flat of shards) {
    if (!Array.isArray(flat)) continue;
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const rec = parse<PriceRecord>(flat[i + 1]);
      if (rec) out.set(String(flat[i]), rec);
    }
  }
  return out;
}

/** Write changed records and delete pruned ones, a few hundred per request. */
export async function writePriceRecords(changed: Map<string, PriceRecord>, removed: string[] = []): Promise<void> {
  const commands: (string | number)[][] = [];
  for (const [id, rec] of changed) commands.push(['HSET', shardKey(id), id, JSON.stringify(rec)]);
  for (const id of removed) commands.push(['HDEL', shardKey(id), id]);
  for (let i = 0; i < commands.length; i += 300) await kvPipeline(commands.slice(i, i + 300));
}

export interface ReducedIndex { updated: string; items: Record<string, Reduction> }

/** Every boat currently showing "Price Reduced". Only the hand-entered ones on a KV error. */
export async function getReducedIndex(): Promise<ReducedIndex> {
  // The cron prunes daily; this also holds if it misses a day.
  const cutoff = daysAgo(REDUCED_WINDOW_DAYS);
  const items: Record<string, Reduction> = {};
  let updated = '';
  if (kvConfigured()) {
    try {
      const idx = await kvGetJson<ReducedIndex>('price:reduced');
      if (idx && typeof idx.items === 'object') {
        updated = idx.updated || '';
        for (const [id, r] of Object.entries(idx.items)) if (r && r.date >= cutoff) items[id] = r;
      }
    } catch { /* recorded history unavailable */ }
  }
  // Reductions entered by hand (api/_lib/listingOverrides.ts) win.
  for (const [id, r] of Object.entries(manualReductions())) if (r.date >= cutoff) items[id] = r;
  return { updated, items };
}

/** The portal's Price Drops entries, with hand-entered reductions' current prices. */
export function withManualDrops(drops: unknown[]): unknown[] {
  const manual = manualReductions();
  return drops.map((d: any) => {
    const m = d && manual[String(d.id)];
    return m ? { ...d, oldPrice: m.previous, newPrice: m.price, pct: m.pct } : d;
  });
}

/** Card rows (feed-shaped) for the "Price reduced" filter. Empty on any error. */
export async function getReducedCards(): Promise<Record<string, any>[]> {
  if (!kvConfigured()) return [];
  try {
    const cards = await kvGetJson<Record<string, any>[]>('price:reduced:cards');
    if (!Array.isArray(cards)) return [];
    // A hand-entered price (api/_lib/listingOverrides.ts) wins over the saved card's.
    const manual = manualReductions();
    for (const c of cards) {
      const m = manual[String(c?.DocumentID)];
      if (m) { c.Price = `${m.price.toFixed(2)} ${m.currency}`; c.NormPrice = m.price; }
    }
    return cards;
  } catch {
    return [];
  }
}
