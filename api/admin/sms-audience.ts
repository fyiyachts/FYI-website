import { requireAdmin } from '../_lib/adminAuth.js';

// GET /api/admin/sms-audience — sizes FYI's textable audience in HubSpot
// (portal 3826631) for SMS revival campaigns. Counting happens here so the
// HubSpot token never leaves the server; the response is aggregate counts
// only — no contact records, no PII.
//
// Auth: an admin session cookie (normal dashboard use) OR the ops secret
// header `x-ops-secret` (VOICE_WEBHOOK_SECRET), so a maintenance script can
// call it without minting a session.
//
// A note on what these numbers can and cannot tell you: HubSpot stores no
// line-type data, so "mobile-capable" is NOT knowable from the CRM alone —
// `mobilephone` is only as good as whoever typed it. Treat the phone counts
// as an upper bound and run a carrier lookup on the chosen slice before
// sending, or landlines will eat the send budget and depress deliverability.

export const maxDuration = 60;

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const HS = 'https://api.hubapi.com';

async function hs(path: string, body?: unknown, attempt = 0): Promise<any> {
  const res = await fetch(`${HS}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
    return hs(path, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`HubSpot ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Contact count for a filter set — search with limit 1 and read `total`. */
async function countContacts(filters: any[][]): Promise<number> {
  const r = await hs('/crm/v3/objects/contacts/search', {
    filterGroups: filters.map((f) => ({ filters: f })),
    properties: ['hs_object_id'],
    limit: 1,
  });
  return r.total ?? 0;
}

const monthsAgo = (n: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
};

export default async function handler(req: any, res: any) {
  const ops = (process.env.VOICE_WEBHOOK_SECRET || '').trim();
  const viaSecret = ops && String(req.headers['x-ops-secret'] || '') === ops;
  if (!viaSecret && !requireAdmin(req, res)) return;
  if (!HS_TOKEN) {
    res.status(503).json({ error: 'HubSpot not configured' });
    return;
  }

  try {
    const PHONE_KNOWN = [{ propertyName: 'phone', operator: 'HAS_PROPERTY' }];
    const MOBILE_KNOWN = [{ propertyName: 'mobilephone', operator: 'HAS_PROPERTY' }];

    // Which opt-out / subscription properties actually exist in this portal —
    // names vary by portal and by how SMS was set up, so discover rather than guess.
    const props = await hs('/crm/v3/properties/contacts');
    const optOutProps: string[] = (props.results || [])
      .map((p: any) => p.name)
      .filter((n: string) => /opt.?out|unsubscrib|sms|do_not|marketable/i.test(n));

    const [
      total, withPhone, withMobile,
      phoneCreated12, phoneCreated24, phoneActive12,
      phoneLeadStatus, phoneCustomer,
    ] = await Promise.all([
      countContacts([[]]),
      countContacts([PHONE_KNOWN]),
      countContacts([MOBILE_KNOWN]),
      countContacts([[...PHONE_KNOWN, { propertyName: 'createdate', operator: 'GTE', value: monthsAgo(12) }]]),
      countContacts([[...PHONE_KNOWN, { propertyName: 'createdate', operator: 'GTE', value: monthsAgo(24) }]]),
      countContacts([[...PHONE_KNOWN, { propertyName: 'lastmodifieddate', operator: 'GTE', value: monthsAgo(12) }]]),
      countContacts([[...PHONE_KNOWN, { propertyName: 'hs_lead_status', operator: 'HAS_PROPERTY' }]]),
      countContacts([[...PHONE_KNOWN, { propertyName: 'lifecyclestage', operator: 'EQ', value: 'customer' }]]),
    ]);

    // Opt-out counts for whichever properties exist (booleans only — a
    // string-valued property would need its own EQ value and is skipped).
    // `?props=a,b,c` counts specific ones; `?has=a,b` counts HAS_PROPERTY
    // instead of =true, which is how you size prior-send history
    // (hs_last_sms_send_date, sakari_sms_sent_qty) rather than opt-out flags.
    const wanted = String(req.query?.props || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const hasProps = String(req.query?.has || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const optOuts: Record<string, number> = {};
    for (const name of (wanted.length ? wanted : optOutProps.slice(0, 8))) {
      try {
        optOuts[name] = await countContacts([[{ propertyName: name, operator: 'EQ', value: 'true' }]]);
      } catch { /* property isn't boolean-searchable — skip */ }
    }
    const known: Record<string, number> = {};
    for (const name of hasProps.slice(0, 10)) {
      try {
        known[name] = await countContacts([[{ propertyName: name, operator: 'HAS_PROPERTY' }]]);
      } catch { /* unknown property — skip */ }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      portal: '3826631',
      generated_at: new Date().toISOString(),
      totals: { all_contacts: total, with_phone: withPhone, with_mobilephone: withMobile },
      recency: {
        phone_created_last_12m: phoneCreated12,
        phone_created_last_24m: phoneCreated24,
        phone_touched_last_12m: phoneActive12,
      },
      quality: { phone_with_lead_status: phoneLeadStatus, phone_customers: phoneCustomer },
      opt_out_properties_found: optOutProps,
      opt_out_counts: optOuts,
      property_known_counts: known,
      caveat:
        'HubSpot has no line-type data: "with_phone"/"with_mobilephone" are upper bounds, not mobile-capable counts. Run a carrier lookup on the selected slice before sending.',
    });
  } catch (err) {
    console.error('[admin/sms-audience] failed:', err);
    res.status(502).json({ error: 'HubSpot query failed', detail: String(err).slice(0, 300) });
  }
}
