/**
 * Admin leads feed + dashboard aggregation against FYI's HubSpot (portal
 * 3826631). Ported from valhalla-yacht-sales' dealer portal
 * (api/_lib/integration-leads.ts / hubspot-reporting.ts) and adapted to FYI's
 * property taxonomy:
 *   - source     : the broker-set `lead_source` enumeration (Website,
 *                  YachtWorld, Boat Trader, FB Paid Ads, Answer Connect, …)
 *   - status     : `hs_lead_status` (FYI's pipeline vocabulary), falling back
 *                  to lifecyclestage
 *   - brand      : boat_of_interest_make_model → what_brand_of_vessel →
 *                  vessel_make (first non-empty)
 *   - activity   : latest of hs_last_activity_date / recent_conversion_date /
 *                  notes_last_contacted — drives the stale-lead colouring
 *
 * HubSpot has no aggregation API, and FYI's CRM is ~71k contacts, so the
 * dashboard NEVER paginates the whole book: exact totals come from cheap
 * `total`-only searches, and breakdowns are computed over the newest ≤2000
 * contacts of the selected window (flagged `sampleTruncated` when capped).
 */

const HUBSPOT_API = 'https://api.hubapi.com';

export interface FyiLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Broker-set Lead Source value, or null when untagged. */
  source: string | null;
  distributedTo: string | null;
  ownerId: string | null;
  status: string | null;
  createdAt: string | null;
  /** Most recent sign of life — null only when nothing was ever logged. */
  lastActivityAt: string | null;
  state: string | null;
  brand: string | null;
}

type Props = Record<string, string | null>;

/** The most recent of several ISO timestamps, or null when all are empty. */
function latestIso(...vals: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const v of vals) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t) && t > bestT) {
      bestT = t;
      best = v;
    }
  }
  return best;
}

const CONTACT_PROPS = [
  'email',
  'firstname',
  'lastname',
  'phone',
  'mobilephone',
  'lead_source',
  'hubspot_owner_id',
  'hs_lead_status',
  'lifecyclestage',
  'createdate',
  'hs_last_activity_date',
  'recent_conversion_date',
  'notes_last_contacted',
  'state',
  'boat_of_interest_make_model',
  'what_brand_of_vessel',
  'vessel_make',
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// HubSpot's search API is rate-limited (~4 req/s); back off on 429/5xx so a
// transient blip doesn't blank the page (same policy as api/admin/stats.ts).
export async function hsRequest(
  token: string,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${HUBSPOT_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(10_000, retryAfter * 1000)
          : Math.min(8000, 300 * 2 ** attempt);
      await sleep(waitMs);
      continue;
    }
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }
}

/** ownerId → display name, for the "distributed to" column. */
export async function fetchOwnerNames(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const qs = `?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const r = await hsRequest(token, 'GET', `/crm/v3/owners${qs}`);
    if (!r.ok) break;
    for (const o of r.json?.results ?? []) {
      const name =
        [o.firstName?.trim(), o.lastName?.trim()].filter(Boolean).join(' ') ||
        o.email ||
        `Owner ${o.id}`;
      map.set(o.id, name);
    }
    after = r.json?.paging?.next?.after;
    if (!after) break;
  }
  return map;
}

function toLead(c: { id: string; properties?: Props }, owners: Map<string, string>): FyiLead {
  const p = c.properties ?? {};
  const ownerId = (p.hubspot_owner_id ?? '').trim() || null;
  return {
    id: c.id,
    name:
      [p.firstname, p.lastname].filter(Boolean).join(' ').trim() ||
      p.email ||
      '(no name)',
    email: p.email || null,
    phone: p.phone || p.mobilephone || null,
    source: (p.lead_source ?? '').trim() || null,
    distributedTo: ownerId ? owners.get(ownerId) ?? `Owner ${ownerId}` : null,
    ownerId,
    status: p.hs_lead_status || p.lifecyclestage || null,
    createdAt: p.createdate || null,
    lastActivityAt: latestIso(
      p.hs_last_activity_date,
      p.recent_conversion_date,
      p.notes_last_contacted
    ),
    state: (p.state ?? '').trim() || null,
    brand:
      (p.boat_of_interest_make_model ?? '').trim() ||
      (p.what_brand_of_vessel ?? '').trim() ||
      (p.vessel_make ?? '').trim() ||
      null,
  };
}

/**
 * Newest-first leads, optionally filtered to one Lead Source value or to
 * contacts created on/after `since` (ISO). Capped at `limit` (max 500).
 * `filterGroups` (raw HubSpot search groups, OR'd) overrides source/since —
 * used by the drill-down endpoint to list the contacts behind a KPI count.
 */
export async function listLeads(
  token: string,
  opts: { source?: string; since?: string; limit?: number; filterGroups?: unknown[] } = {}
): Promise<{ leads: FyiLead[]; total: number; truncated: boolean }> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 250));
  const filters: Array<Record<string, string>> = [];
  if (opts.source) filters.push({ propertyName: 'lead_source', operator: 'EQ', value: opts.source });
  if (opts.since) filters.push({ propertyName: 'createdate', operator: 'GTE', value: opts.since });

  const owners = await fetchOwnerNames(token);
  const leads: FyiLead[] = [];
  let after: string | undefined;
  let truncated = false;
  let grandTotal = 0;

  const filterGroups = opts.filterGroups ?? (filters.length ? [{ filters }] : []);

  for (let i = 0; i < Math.ceil(limit / 100) + 1; i++) {
    const body: Record<string, unknown> = {
      filterGroups,
      properties: CONTACT_PROPS,
      limit: 100,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    };
    if (after) body.after = after;

    const r = await hsRequest(token, 'POST', '/crm/v3/objects/contacts/search', body);
    if (!r.ok) throw new Error(`HubSpot contacts search failed (${r.status})`);
    grandTotal = typeof r.json?.total === 'number' ? r.json.total : grandTotal;

    for (const c of r.json?.results ?? []) {
      leads.push(toLead(c, owners));
      if (leads.length >= limit) {
        truncated = true;
        break;
      }
    }
    if (truncated) break;
    after = r.json?.paging?.next?.after;
    if (!after) break;
  }

  return { leads, total: grandTotal, truncated: truncated && grandTotal > leads.length };
}
