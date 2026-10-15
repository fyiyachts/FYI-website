import { fail, ok, methodNotAllowed } from '../_lib/http.js';
import { verifySession } from '../_lib/authVerify.js';
import { parseLengthFt } from '../_lib/fyiLeadSize.js';

// Internal admin stats for the "Internal Stats FYI" page. Reads FYI's HubSpot
// (portal 3826631) with a server-only Private App token and returns pre-aggregated
// counts. NEVER expose the HubSpot token to the client — this route is the only
// thing that touches it, and it is gated on an authenticated admin session.

// Mirror of utils/admin.ts (kept inline so the serverless bundle has no
// cross-directory import). Keep the two in sync — explicit allowlist + domains.
const ADMIN_EMAILS = [
  'salvarez@fyiyachts.com',
  'alejandra@fyiyachts.com',
  'navarro@fyiyachts.com',
  'joelgomes@fyiyachts.com',
];
const ADMIN_EMAIL_DOMAINS: string[] = [];
const isAdminEmail = (email: string | undefined | null): boolean => {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (ADMIN_EMAILS.includes(e)) return true;
  const domain = e.split('@')[1];
  return !!domain && ADMIN_EMAIL_DOMAINS.includes(domain);
};

// FYI HubSpot Private App token. The project already stores it as
// HUBSPOT_ACCESS_TOKEN (Production); HUBSPOT_FYI_TOKEN is accepted as a fallback.
const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const HS_SEARCH = 'https://api.hubapi.com/crm/v3/objects/contacts/search';

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
// Bump the version suffix whenever a metric DEFINITION changes — a cached v(n)
// payload was computed under the old rules and must not be served as current.
// v2: notes count as outreach + note_reply_detected in responded (2026-07-09).
// v3: adds size buckets (≤59 / 60–89 / 90+) over 30/60/90-day windows (2026-08-18).
// v4: size buckets prefer the numeric boat_length_of_interest property
//     (written by website inquiries + the enrich-lead-sizes cron) (2026-08-18).
const CACHE_KEY = 'admin:stats:v4';
const CACHE_TTL = 3600; // 1 hour

// Allow time for the throttled, retrying HubSpot aggregate (first/uncached load).
export const maxDuration = 60;

type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };
type Group = { filters: Filter[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// HubSpot's CRM Search API is rate-limited (~4 req/s). Retry 429s (and transient
// 5xx) with backoff, honoring Retry-After, so a burst doesn't fail the whole page.
async function hsCount(filterGroups: Group[], attempt = 0): Promise<number> {
  const res = await fetch(HS_SEARCH, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filterGroups, limit: 1 }),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 0;
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 400 * Math.pow(2, attempt));
    return hsCount(filterGroups, attempt + 1);
  }
  if (!res.ok) throw new Error(`HubSpot search ${res.status}`);
  const data: any = await res.json();
  return typeof data.total === 'number' ? data.total : 0;
}

// Run tasks with low concurrency + a gap between rounds to stay under the search
// rate limit (retries above absorb any occasional overshoot).
async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
    if (i + size < items.length) await sleep(300);
  }
}

const one = (f: Filter): Group[] => [{ filters: [f] }];
const has = (propertyName: string): Filter => ({ propertyName, operator: 'HAS_PROPERTY' });

const SOURCE_VALUES = [
  'Website', 'YachtWorld', 'Boat Trader', 'FB Paid Ads', 'Answer Connect', 'Boats.com',
  'Website Chat Bot', 'Email Blast', 'Phone Call', 'Yatco', 'Paid Traffic', 'Instagram',
  'Whatsapp Business', 'Walk In', 'AI Engine', 'Charters Landing Page', 'Event', 'Other',
];
const META_SOURCES = ['FB Paid Ads', 'Instagram'];
const ENGAGED_STATUSES = [
  'RP - (IN TOUCH W BROKER)', 'Qualified', 'Deal pending', 'Purchased with FYI',
  'Listed with FYI', 'Boat owner', 'Later Buyer', 'Later Seller',
];

// ---- Lead size buckets ------------------------------------------------------
// FYI's HubSpot has NO numeric length property — size lives only in free-text
// Meta/Jotform lead-ad answers ("Sea Ray, Sundancer 500, 50ft", "Viking 56’",
// "Princess 60"). So buckets are computed by pulling the newest 90 days of
// contacts, parsing a footage out of whichever size-ish text properties the
// portal actually has, and counting per created-date window. See
// (the forms don't ask budget).

// Interest fields first (the boat they want), then owned-boat / generic fields.
const SIZE_PROP_PRIORITY = [
  'boat_of_interest_make_model',
  'boat_make_model__length',
  'what_brand_of_vessel',
  'if_yes_please_provide_the_make_year_length_and_model',
  'if_yes_current_boat_length_make_model_year',
];
const SIZE_SAMPLE_CAP = 2000; // same cap as the leads feed — never page 71k contacts

interface SizeBuckets { total: number; under60: number; s60to89: number; s90plus: number; unknown: number }
const emptyBuckets = (): SizeBuckets => ({ total: 0, under60: 0, s60to89: 0, s90plus: 0, unknown: 0 });

/** Which contact properties exist in the portal, so we only request real ones. */
async function existingSizeProps(): Promise<string[]> {
  const res = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
    headers: { Authorization: `Bearer ${HS_TOKEN}` },
  });
  if (!res.ok) return [];
  const data: any = await res.json();
  const names = new Set<string>((data.results ?? []).map((p: any) => String(p.name)));
  const extras = [...names].filter(
    (n) => /length|size/i.test(n) && !SIZE_PROP_PRIORITY.includes(n)
      && n !== 'company_size' && n !== 'boat_length_of_interest' && n !== 'boat_size_checked_at'
      && !/^hs_|^ip_/.test(n)
  );
  return [
    // The numeric property always rides first when the portal has it.
    ...(names.has('boat_length_of_interest') ? ['boat_length_of_interest'] : []),
    ...SIZE_PROP_PRIORITY.filter((n) => names.has(n)),
    ...extras.slice(0, 5),
  ];
}

async function computeSizeBuckets(): Promise<{
  sampled: number; truncated: boolean;
  windows: { d30: SizeBuckets; d60: SizeBuckets; d90: SizeBuckets };
}> {
  const now = Date.now();
  const since90 = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const props = await existingSizeProps();
  // Numeric property written by website inquiries (exact listing length) and
  // the enrich-lead-sizes cron — trusted over any text parse. Requested only
  // when the portal actually has it (first deploys may predate its creation).
  const numericProp = 'boat_length_of_interest';
  const hasNumeric = props.includes(numericProp);
  const windows = { d30: emptyBuckets(), d60: emptyBuckets(), d90: emptyBuckets() };
  let sampled = 0;
  let truncated = false;
  let after: string | undefined;

  while (sampled < SIZE_SAMPLE_CAP) {
    const body: Record<string, unknown> = {
      filterGroups: [{ filters: [{ propertyName: 'createdate', operator: 'GTE', value: since90 }] }],
      properties: ['createdate', ...props],
      limit: 100,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    };
    if (after) body.after = after;

    let res: Response | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      res = await fetch(HS_SEARCH, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers.get('Retry-After')) || 0;
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 400 * Math.pow(2, attempt));
    }
    if (!res || !res.ok) throw new Error(`HubSpot size sample ${res?.status}`);
    const data: any = await res.json();

    for (const c of data.results ?? []) {
      const p = c.properties ?? {};
      const created = new Date(p.createdate || 0).getTime();
      const ageDays = (now - created) / (24 * 60 * 60 * 1000);
      let len: number | null = null;
      if (hasNumeric) {
        const direct = parseFloat(p[numericProp] ?? '');
        if (Number.isFinite(direct) && direct >= 20 && direct < 400) len = direct;
      }
      for (const name of props) {
        if (len != null) break;
        if (name === numericProp) continue;
        const v = (p[name] ?? '').trim();
        if (v) len = parseLengthFt(v);
      }
      for (const [key, days] of [['d30', 30], ['d60', 60], ['d90', 90]] as const) {
        if (ageDays > days) continue;
        const b = windows[key];
        b.total++;
        if (len == null) b.unknown++;
        else if (len <= 59) b.under60++;
        else if (len <= 89) b.s60to89++;
        else b.s90plus++;
      }
      sampled++;
    }

    after = data.paging?.next?.after;
    if (!after) break;
    if (sampled >= SIZE_SAMPLE_CAP) { truncated = true; break; }
    await sleep(300);
  }

  return { sampled, truncated, windows };
}

async function computeStats() {
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const createdSince: Filter = { propertyName: 'createdate', operator: 'GTE', value: since90 };

  const results: Record<string, number> = {};
  const tasks: { key: string; groups: Group[] }[] = [
    { key: 'total', groups: [{ filters: [] }] },
    { key: 'leadSourceKnown', groups: one(has('lead_source')) },
    // channel mix via HubSpot's always-populated Original Source
    { key: 'os_google', groups: one({ propertyName: 'hs_analytics_source', operator: 'EQ', value: 'PAID_SEARCH' }) },
    { key: 'os_meta', groups: one({ propertyName: 'hs_analytics_source', operator: 'EQ', value: 'PAID_SOCIAL' }) },
    { key: 'ls_meta', groups: one({ propertyName: 'lead_source', operator: 'IN', values: META_SOURCES }) },
    // funnel — all time. "Reached out" counts a logged Last Contacted date OR
    // any note on the record (2026-07-09: notes are outreach activity too).
    { key: 'reachedOut', groups: [
      { filters: [has('notes_last_contacted')] },
      { filters: [{ propertyName: 'num_notes', operator: 'GTE', value: '1' }] },
    ] },
    // "Responded" additionally counts note_reply_detected=true — set by the
    // classify-notes cron when a note indicates two-way communication
    // (voicemail-only notes stay false). See api/cron/classify-notes.ts.
    { key: 'responded', groups: [
      { filters: [{ propertyName: 'hs_lead_status', operator: 'IN', values: ENGAGED_STATUSES }] },
      { filters: [has('hs_sales_email_last_replied')] },
      { filters: [{ propertyName: 'note_reply_detected', operator: 'EQ', value: 'true' }] },
    ] },
    // funnel — last 90 days
    { key: 'total90', groups: [{ filters: [createdSince] }] },
    { key: 'reached90', groups: [
      { filters: [createdSince, has('notes_last_contacted')] },
      { filters: [createdSince, { propertyName: 'num_notes', operator: 'GTE', value: '1' }] },
    ] },
    { key: 'responded90', groups: [
      { filters: [createdSince, { propertyName: 'hs_lead_status', operator: 'IN', values: ENGAGED_STATUSES }] },
      { filters: [createdSince, has('hs_sales_email_last_replied')] },
      { filters: [createdSince, { propertyName: 'note_reply_detected', operator: 'EQ', value: 'true' }] },
    ] },
    // per-source breakdown
    ...SOURCE_VALUES.map((v) => ({ key: `src:${v}`, groups: one({ propertyName: 'lead_source', operator: 'EQ', value: v }) })),
  ];

  await pool(tasks, 3, async (t) => { results[t.key] = await hsCount(t.groups); });

  // Size buckets page the same rate-limited search API, so run them after the
  // counts rather than alongside. Best-effort: a failure here must not blank
  // the rest of the page.
  let sizes: Awaited<ReturnType<typeof computeSizeBuckets>> | null = null;
  try {
    sizes = await computeSizeBuckets();
  } catch { /* leave null — the card shows a friendly note */ }

  const sources = SOURCE_VALUES
    .map((name) => ({ name, count: results[`src:${name}`] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      contacts: results.total ?? 0,
      leadSourceKnown: results.leadSourceKnown ?? 0,
    },
    sources,
    channels: {
      // "as tagged" in the Lead Source field (what the brokers set)
      byLeadSource: {
        website: results['src:Website'] ?? 0,
        meta: results.ls_meta ?? 0,
        google: results['src:Paid Traffic'] ?? 0,
      },
      // auto-tracked Original Source (catches paid clicks the field misses)
      byOriginalSource: {
        google: results.os_google ?? 0,
        meta: results.os_meta ?? 0,
      },
    },
    funnel: {
      allTime: { total: results.total ?? 0, reachedOut: results.reachedOut ?? 0, responded: results.responded ?? 0 },
      last90: { total: results.total90 ?? 0, reachedOut: results.reached90 ?? 0, responded: results.responded90 ?? 0 },
    },
    sizes,
  };
}

async function kvGet(key: string): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch { return null; }
}

async function kvSet(key: string, value: any): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/set/${encodeURIComponent(key)}?EX=${CACHE_TTL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  } catch { /* cache is best-effort */ }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  // 1) Require a valid signed session.
  const cookie = req.headers?.cookie || '';
  const match = cookie.match(/fyi_session=([^;]+)/);
  if (!match) return fail(res, 'Not authenticated', 401);
  const session = verifySession(match[1]);
  if (!session) return fail(res, 'Invalid session', 401);

  // 2) Require an admin email domain.
  if (!isAdminEmail(session.email)) return fail(res, 'Forbidden — admins only', 403);

  if (!HS_TOKEN) return fail(res, 'HubSpot token not configured (HUBSPOT_ACCESS_TOKEN)', 500);

  try {
    const refresh = req.query?.refresh === '1' || req.query?.refresh === 'true';
    if (!refresh) {
      const cached = await kvGet(CACHE_KEY);
      if (cached) return ok(res, { ...cached, cached: true });
    }
    const stats = await computeStats();
    await kvSet(CACHE_KEY, stats);
    return ok(res, { ...stats, cached: false });
  } catch (err) {
    return fail(res, err);
  }
}
