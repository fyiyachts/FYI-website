import { parseJsonBody, fail, ok, methodNotAllowed } from '../_lib/http.js';
import { markAlertsSubscribed } from '../_lib/supabaseUsers.js';
import { syncMarketAlertContact } from '../_lib/fyiHubspot.js';
import { parseAttribution, attributionContactProps } from '../_lib/attribution.js';
import { checkSubscribe, clientIp } from '../_lib/leadGuard.js';

// Distinct, trimmed brand names. Accepts the client-derived list and unions it
// with anything already on file so re-subscribing never loses a brand.
function normalizeBrands(...lists: Array<unknown>): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const v of list) {
      if (typeof v === 'string' && v.trim()) out.add(v.trim());
    }
  }
  return [...out];
}

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

async function kvSet(key: string, value: any): Promise<void> {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
}

// Upstash returns the stored value as a raw (JSON-encoded) string; parse it back
// into an object so the merge below actually sees prior savedBoats/savedSearches.
function parseKvValue(result: any): any {
  if (result == null) return null;
  let value: any = result;
  for (let i = 0; i < 2 && typeof value === 'string'; i++) {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value;
}

async function kvGet(key: string): Promise<any> {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseKvValue(data.result);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!KV_URL || !KV_TOKEN) return fail(res, 'KV not configured');

  try {
    const body = parseJsonBody(req);
    const { attribution } = body;

    // Bot/abuse screen. This endpoint writes a KV row, a Supabase row AND a
    // HubSpot contact per accepted request, so an unguarded one lets anybody
    // bulk-subscribe harvested addresses — polluting the CRM and signing real
    // people up for mail they never asked for, which costs sending reputation.
    // Nothing below runs until a submission clears it. See api/_lib/leadGuard.ts.
    const verdict = await checkSubscribe(req, body);
    if (!verdict.ok) {
      console.warn(`[alerts/subscribe] rejected (${verdict.reason}) ip=${clientIp(req)}`);
      // Honeypot hits answer 200 with no write, so a bot cannot tell a filtered
      // request from an accepted one and start probing for the rule it tripped.
      if (verdict.silent) return ok(res, { subscribed: true });
      return fail(res, verdict.error || 'Subscription could not be completed.', verdict.status);
    }
    if (verdict.flags.length) {
      console.log(`[alerts/subscribe] flagged: ${verdict.flags.join('; ')}`);
    }
    const { email, savedBoats, savedSearches } = verdict.clean;

    const key = `alert:user:${email}`;
    const existing = await kvGet(key);
    const boatBrands = normalizeBrands(verdict.clean.brands, existing?.brands);
    const subscription = {
      email,
      // The guard bounds these arrays; an empty one from the client still means
      // "no change", so the stored value wins as before.
      savedBoats: savedBoats.length ? savedBoats : existing?.savedBoats || [],
      savedSearches: savedSearches.length ? savedSearches : existing?.savedSearches || [],
      brands: boatBrands,
      updatedAt: Date.now(),
    };

    await kvSet(key, subscription);
    // Mirror the subscription flag + brand interest into Supabase (Market Alert
    // Recipients — the source for FYI HubSpot's brand segments).
    try { await markAlertsSubscribed(subscription.email, boatBrands); }
    catch (err) { console.error('Supabase markAlertsSubscribed failed:', err); }
    // Enrich-or-create the contact in FYI HubSpot and drop them into brand
    // segments — WITHOUT entering the broker lead pipeline. Inert (safe no-op)
    // until FYI_HUBSPOT_PAT is configured; see api/_lib/fyiHubspot.ts.
    try {
      await syncMarketAlertContact(
        subscription.email,
        boatBrands,
        attributionContactProps(parseAttribution(attribution)),
      );
    }
    catch (err) { console.error('FYI HubSpot syncMarketAlertContact failed:', err); }
    return ok(res, { subscribed: true });
  } catch (err) {
    return fail(res, err);
  }
}
