// Hourly IndexNow push (Vercel Cron, minute 10 of every hour — vercel.json).
//
// Tells Bing/Yandex about the listing URLs that changed since the last run,
// FYI exclusives AND co-brokerage, and nothing else:
//
//   new        a boat that was not in the feeds before (or came back)
//   price      its asking price changed
//   modified   the feed's LastModificationDate moved
//   removed    it left the feed — /listing/<id> now answers 410, and the
//              submission is what makes Bing drop it
//
// This replaces the IndexNow half of the daily seo-sync cron, which sent every
// exclusive modified in the last 7 days in one nightly batch: the same URLs
// night after night, which Bing Webmaster Tools flags as "Avoid IndexNow
// Batch Mode". It also ran on both Vercel projects that deploy this repo, so
// each URL went twice. This job needs KV, which only the live project has.
//
// How a change is detected
//   indexnow:seen:<0-9>  hash, DocumentID → what was last told to Bing:
//                        "<e|c>:<price>|<currency>|<LastModificationDate>",
//                        prefixed "?" after one run without the boat, or
//                        "gone" once its removal has been submitted.
//   price:hist:*         the daily price snapshot (api/_lib/priceHistory.ts),
//                        the baseline for a boat this job has not seen yet:
//                        absent or marked gone there → new; a different price
//                        there → price change; otherwise it is only recorded.
//                        So the first run submits what moved since the last
//                        snapshot, not the whole inventory.
//   indexnow:queue       DocumentIDs waiting to be sent. At most MAX_PER_RUN
//                        go out per run; the rest wait for the next one. Ids
//                        leave the queue only after IndexNow accepts them.
//
// A boat must be missing on two consecutive runs before it is submitted as
// removed: the co-brokerage feed is paged while it changes, and a row can
// slip between two pages once. A feed that fails is skipped whole, exactly as
// in the price snapshot — its boats are neither changed nor removed.

import { MANUAL_LISTINGS } from '../_lib/manualListings.js';
import { submitToIndexNow, type IndexNowResult } from '../_lib/indexNow.js';
import { plsConfigured, plsFetchAll } from '../_lib/plsFeed.js';
import { listPrice } from '../_lib/price.js';
import {
  getAllPriceRecords, kv, kvConfigured, kvGetJson, kvPipeline, kvSetJson, type PriceRecord,
} from '../_lib/priceHistory.js';

const SITE = (process.env.SITE_URL || 'https://fyiyachts.com').replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_SECRET || '';
const UPSTREAM = 'https://api.boats.com/inventory/search';
const KEY = process.env.BOATS_API_KEY || '';

/** URLs sent per run; the remainder stays queued for the next hour. */
const MAX_PER_RUN = 500;
const SHARDS = 10;
const QUEUE_KEY = 'indexnow:queue';
const FEED_FIELDS = 'DocumentID,Price,NormPrice,PriceHideInd,LastModificationDate';
/** A removal the price snapshot recorded this recently is still news to Bing. */
const RECENT_GONE_DAYS = 3;
/** More boats than this vanishing at once is a broken feed, not a market event. */
const MAX_REMOVED_SHARE = 0.25;

export const maxDuration = 120;

type Kind = 'e' | 'c';

const shardKey = (id: string): string => `indexnow:seen:${Number(id.slice(-1)) % SHARDS || 0}`;

async function fetchExclusives(): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [...MANUAL_LISTINGS];
  for (let page = 0; page < 6; page++) {
    const url = new URL(UPSTREAM);
    url.searchParams.set('key', KEY);
    url.searchParams.set('salesstatus', 'active');
    url.searchParams.set('rows', '500');
    url.searchParams.set('start', String(page * 500));
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`inventory feed HTTP ${res.status}`);
    const items = ((await res.json()) as { results?: Record<string, any>[] }).results ?? [];
    out.push(...items);
    if (items.length < 500) break;
  }
  return out;
}

async function getSeen(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) => kv(['HGETALL', `indexnow:seen:${i}`], 20_000)),
  );
  for (const flat of shards) {
    if (!Array.isArray(flat)) continue;
    for (let i = 0; i + 1 < flat.length; i += 2) out.set(String(flat[i]), String(flat[i + 1]));
  }
  return out;
}

/** "<price>|<currency>" — the same reading of a price as the snapshot's. */
const priceSig = (price?: number, currency?: string): string => `${price ?? ''}|${price ? currency || 'USD' : ''}`;

const rowSig = (it: Record<string, any>): { price: string; full: string } => {
  const shown = listPrice(it);
  const price = priceSig(shown?.amount, shown?.currency);
  return { price, full: `${price}|${String(it.LastModificationDate ?? '').trim()}` };
};

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization || '';
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!kvConfigured()) {
    console.log('[cron/indexnow] skipped: KV not configured');
    return res.status(200).json({ ok: true, configured: false });
  }

  try {
    const [exclusiveRows, co] = await Promise.all([
      fetchExclusives().catch((err) => {
        console.error('[cron/indexnow] exclusives failed:', err?.message || err);
        return null;
      }),
      plsConfigured()
        ? plsFetchAll(FEED_FIELDS).catch((err) => {
            console.error('[cron/indexnow] co-brokerage failed:', err?.message || err);
            return null;
          })
        : Promise.resolve(null),
    ]);
    if (!exclusiveRows && !co) {
      console.error('[cron/indexnow] sent=0 — both feeds failed');
      return res.status(502).json({ ok: false, error: 'both feeds failed' });
    }
    const feedRead = (kind: Kind): boolean => (kind === 'e' ? !!exclusiveRows : !!co);

    const now = new Map<string, { it: Record<string, any>; kind: Kind }>();
    for (const it of exclusiveRows ?? []) {
      const id = String(it.DocumentID ?? '').replace(/[^0-9]/g, '');
      if (id) now.set(id, { it, kind: 'e' });
    }
    for (const it of co?.results ?? []) {
      const id = String(it.DocumentID ?? '').replace(/[^0-9]/g, '');
      // FYI's own boats are in PLS too: the exclusive version wins.
      if (id && !now.has(id)) now.set(id, { it, kind: 'c' });
    }

    const [seen, history, storedQueue] = await Promise.all([
      getSeen(),
      getAllPriceRecords(),
      kvGetJson<string[]>(QUEUE_KEY),
    ]);
    // With no snapshot and no state there is nothing to compare against:
    // record today's boats and submit nothing, rather than all ~9,000.
    const seedOnly = seen.size === 0 && history.size === 0;

    const writes = new Map<string, string>();
    const forget: string[] = [];
    const found = { new: [] as string[], price: [] as string[], modified: [] as string[], removed: [] as string[] };

    // 1. Boats in the feeds now.
    for (const [id, { it, kind }] of now) {
      const sig = rowSig(it);
      const value = `${kind}:${sig.full}`;
      const stored = seen.get(id);
      if (stored === undefined) {
        const rec: PriceRecord | undefined = history.get(id);
        if (seedOnly) { /* record only */ }
        else if (!rec || rec.gone) found.new.push(id);
        else if (priceSig(rec.price, rec.currency) !== sig.price) found.price.push(id);
        writes.set(id, value);
        continue;
      }
      if (stored === 'gone') { found.new.push(id); writes.set(id, value); continue; }
      const live = stored.replace(/^\?/, '');
      // An exclusive whose own feed failed this run is showing its PLS row:
      // not a change, and not a reason to rewrite what is stored.
      if (live[0] === 'e' && kind === 'c' && !exclusiveRows) continue;
      const before = live.slice(2);
      if (before !== sig.full) {
        const [p, c] = before.split('|');
        (`${p}|${c}` !== sig.price ? found.price : found.modified).push(id);
      }
      if (stored !== value) writes.set(id, value);
    }

    // 2. Boats that are not. First miss: marked. Second: submitted as removed.
    const removedNow: string[] = [];
    const recentCutoff = new Date(Date.now() - RECENT_GONE_DAYS * 864e5).toISOString().slice(0, 10);
    for (const [id, stored] of seen) {
      if (now.has(id)) continue;
      if (stored === 'gone') { if (!history.has(id)) forget.push(id); continue; }
      const live = stored.replace(/^\?/, '');
      if (!feedRead(live[0] as Kind)) continue;
      if (stored[0] === '?') removedNow.push(id);
      else writes.set(id, `?${live}`);
    }
    for (const [id, rec] of history) {
      if (now.has(id) || seen.has(id) || !feedRead(rec.type)) continue;
      // Already gone in the snapshot: news only if it happened recently.
      if (rec.gone) { if (rec.gone >= recentCutoff) removedNow.push(id); continue; }
      // In yesterday's snapshot, not in the feed now: wait one run to be sure.
      writes.set(id, `?${rec.type}:${priceSig(rec.price, rec.currency)}|`);
    }
    const knownLive = [...seen.values()].filter((v) => v !== 'gone').length || history.size;
    const massRemoval = removedNow.length > Math.max(50, knownLive * MAX_REMOVED_SHARE);
    if (massRemoval) {
      console.error(`[cron/indexnow] ${removedNow.length} boats missing at once — treated as a feed fault, not submitted`);
    } else {
      for (const id of removedNow) { found.removed.push(id); writes.set(id, 'gone'); }
    }

    // 3. Queue first, then state: a crash in between re-detects, never loses.
    const queue = [...new Set([...(Array.isArray(storedQueue) ? storedQueue.map(String) : []),
      ...found.removed, ...found.new, ...found.price, ...found.modified])];
    await kvSetJson(QUEUE_KEY, queue);
    const commands: (string | number)[][] = [];
    for (const [id, value] of writes) commands.push(['HSET', shardKey(id), id, value]);
    for (const id of forget) commands.push(['HDEL', shardKey(id), id]);
    for (let i = 0; i < commands.length; i += 300) await kvPipeline(commands.slice(i, i + 300));

    // 4. Send at most MAX_PER_RUN; what is left goes next hour.
    const batch = queue.slice(0, MAX_PER_RUN);
    let result: IndexNowResult | null = null;
    if (batch.length) {
      const urls = batch.map((id) => `${SITE}/listing/${id}`);
      result = await submitToIndexNow(urls);
      // The first call after a key rotation answers 403 while IndexNow
      // fetches the new key file, then accepts the same call moments later.
      if (result.status === 403) {
        await new Promise((r) => setTimeout(r, 8_000));
        result = await submitToIndexNow(urls);
      }
      if (result.ok) await kvSetJson(QUEUE_KEY, queue.slice(batch.length));
    }
    const sent = result?.ok ? batch.length : 0;
    const summary = {
      sent,
      leftInQueue: queue.length - sent,
      found: {
        new: found.new.length, price: found.price.length,
        modified: found.modified.length, removed: found.removed.length,
      },
      tracked: now.size,
      exclusives: exclusiveRows ? 'ok' : 'feed failed',
      cobrokerage: co ? 'ok' : plsConfigured() ? 'feed failed' : 'not configured',
      ...(seedOnly ? { seeded: true } : {}),
      ...(massRemoval ? { removalsHeld: removedNow.length } : {}),
      ...(result ? { status: result.status, detail: result.detail } : {}),
    };
    // The count of URLs each run sends — search the logs for "[cron/indexnow] sent=".
    const line = `[cron/indexnow] sent=${sent} ${JSON.stringify(summary)}`;
    if (result && !result.ok) console.error(line); else console.log(line);
    return res.status(200).json({ ok: !result || result.ok, ranAt: new Date().toISOString(), ...summary });
  } catch (err: any) {
    console.error('[cron/indexnow] failed:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'indexnow run failed' });
  }
}
