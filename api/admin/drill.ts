import { fail, ok, methodNotAllowed } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { listLeads } from '../_lib/fyiHubspotLeads.js';

// GET /api/admin/drill?metric=<key>[&value=…][&limit=…]   (admins only)
//
// Drill-down behind the Internal Stats / FYI Dashboard KPI chips: returns the
// newest contacts matching the SAME HubSpot filter that produced the chip's
// count, so clicking "Reached out (all-time) — 14,309" shows who those people
// actually are. Keep the filter definitions in lockstep with
// api/admin/stats.ts (the counts) or the drill list won't match the number.

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
export const maxDuration = 60;

// Mirror of api/admin/stats.ts ENGAGED_STATUSES — keep in sync.
const ENGAGED_STATUSES = [
  'RP - (IN TOUCH W BROKER)', 'Qualified', 'Deal pending', 'Purchased with FYI',
  'Listed with FYI', 'Boat owner', 'Later Buyer', 'Later Seller',
];

type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };
const has = (p: string): Filter => ({ propertyName: p, operator: 'HAS_PROPERTY' });
const notHas = (p: string): Filter => ({ propertyName: p, operator: 'NOT_HAS_PROPERTY' });
const since90 = (): Filter => ({
  propertyName: 'createdate',
  operator: 'GTE',
  value: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
});

/** metric key → HubSpot filterGroups (groups are OR'd, filters AND'd). */
function metricGroups(metric: string, value: string): Array<{ filters: Filter[] }> | null {
  switch (metric) {
    case 'total':        return [{ filters: [] }];
    case 'tagged':       return [{ filters: [has('lead_source')] }];
    case 'untagged':     return [{ filters: [notHas('lead_source')] }];
    // Reached out = a logged Last Contacted date OR any note on the record.
    case 'reachedOut':   return [
      { filters: [has('notes_last_contacted')] },
      { filters: [{ propertyName: 'num_notes', operator: 'GTE', value: '1' }] },
    ];
    case 'notReached':   return [
      { filters: [notHas('notes_last_contacted'), { propertyName: 'num_notes', operator: 'LT', value: '1' }] },
      { filters: [notHas('notes_last_contacted'), notHas('num_notes')] },
    ];
    // Responded also counts note_reply_detected=true (classify-notes cron).
    case 'responded':    return [
      { filters: [{ propertyName: 'hs_lead_status', operator: 'IN', values: ENGAGED_STATUSES }] },
      { filters: [has('hs_sales_email_last_replied')] },
      { filters: [{ propertyName: 'note_reply_detected', operator: 'EQ', value: 'true' }] },
    ];
    case 'total90':      return [{ filters: [since90()] }];
    case 'reached90':    return [
      { filters: [since90(), has('notes_last_contacted')] },
      { filters: [since90(), { propertyName: 'num_notes', operator: 'GTE', value: '1' }] },
    ];
    case 'notReached90': return [
      { filters: [since90(), notHas('notes_last_contacted'), { propertyName: 'num_notes', operator: 'LT', value: '1' }] },
      { filters: [since90(), notHas('notes_last_contacted'), notHas('num_notes')] },
    ];
    case 'responded90':  return [
      { filters: [since90(), { propertyName: 'hs_lead_status', operator: 'IN', values: ENGAGED_STATUSES }] },
      { filters: [since90(), has('hs_sales_email_last_replied')] },
      { filters: [since90(), { propertyName: 'note_reply_detected', operator: 'EQ', value: 'true' }] },
    ];
    case 'source':
      if (!value) return null;
      return [{ filters: [{ propertyName: 'lead_source', operator: 'EQ', value }] }];
    // Meta spans two Lead Source values — mirrors META_SOURCES in stats.ts.
    case 'metaAds':
      return [{ filters: [{ propertyName: 'lead_source', operator: 'IN', values: ['FB Paid Ads', 'Instagram'] }] }];
    // Auto-tracked Original Traffic Source — catches the paid clicks that the
    // hand-set Lead Source field misses (mirrors os_google/os_meta in stats.ts).
    case 'osGoogle':
      return [{ filters: [{ propertyName: 'hs_analytics_source', operator: 'EQ', value: 'PAID_SEARCH' }] }];
    case 'osMeta':
      return [{ filters: [{ propertyName: 'hs_analytics_source', operator: 'EQ', value: 'PAID_SOCIAL' }] }];
    default:
      return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (!requireAdmin(req, res)) return;
  if (!HS_TOKEN) return fail(res, 'HubSpot token not configured (HUBSPOT_ACCESS_TOKEN)', 500);

  const metric = (req.query?.metric ?? '').toString().trim();
  const value = (req.query?.value ?? '').toString().trim();
  const groups = metricGroups(metric, value);
  if (!groups) return fail(res, `Unknown drill metric: ${metric}`, 400);

  const limit = Math.min(200, Math.max(1, parseInt(req.query?.limit as string, 10) || 100));

  try {
    const result = await listLeads(HS_TOKEN, { filterGroups: groups, limit });
    return ok(res, { metric, value: value || null, ...result });
  } catch (err) {
    console.error('[admin/drill] error:', err);
    return fail(res, err);
  }
}
