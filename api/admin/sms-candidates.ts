import { requireAdmin } from '../_lib/adminAuth.js';

// GET /api/admin/sms-candidates — builds a vetted SMS revival list from FYI
// HubSpot (portal 3826631): contacts with a mobile number AND some boat/interest
// detail, so the message can reference a specific vessel the way the July 2026
// campaign did (that specificity is what produced its 41% reply rate).
//
// Optionally carrier-verifies each number with Twilio Lookup and returns ONLY
// the ones that come back as mobile — HubSpot stores no line type, so
// `mobilephone` is just whatever a human typed.
//
// Auth: admin session cookie OR `x-ops-secret` (VOICE_WEBHOOK_SECRET).
// This one returns contact PII (name, number, boat interest) because it IS the
// send list — it is strictly gated and never cached.
//
// Query params:
//   limit    max contacts to return (default 500, hard cap 500)
//   months   only contacts created within N months (default 36)
//   verify   "1" to run Twilio Lookup (needs TWILIO_ACCOUNT_SID/AUTH_TOKEN)
//   exclude  comma-separated digits to suppress (already-texted / opted-out)
//
// Carrier verification needs TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN on THIS
// Vercel project (they also live on the `crm` project, but env vars are
// per-project and are only injected at build time — adding them requires a
// redeploy before `?verify=1` stops returning 503).

export const maxDuration = 300;

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const HS = 'https://api.hubapi.com';
// Accept the common alternate names too — a copied var is easy to mis-name,
// and a silent 503 gives no clue which project/environment it landed in.
const TW_SID = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID || process.env.TWILIO_FYI_ACCOUNT_SID || '';
const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN || process.env.TWILIO_FYI_AUTH_TOKEN || '';

// Boat/interest fields, in preference order for the message hook. Discovered
// names are matched against these first so the output is predictable.
const BOAT_HINTS = /boat|yacht|vessel|make|model|builder|brand|interest|budget|length/i;

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

const digits = (s: string): string => (s || '').replace(/[^\d]/g, '');
const e164 = (s: string): string | null => {
  const d = digits(s);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null; // international or junk — excluded rather than guessed at
};

/** Twilio Lookup v2 line-type intelligence. Returns 'mobile' | 'landline' | ... | null. */
async function lookupLineType(phone: string): Promise<string | null> {
  const auth = Buffer.from(`${TW_SID}:${TW_TOKEN}`).toString('base64');
  const res = await fetch(
    `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) return null;
  const j: any = await res.json();
  return j?.line_type_intelligence?.type ?? null;
}

export default async function handler(req: any, res: any) {
  const ops = (process.env.VOICE_WEBHOOK_SECRET || '').trim();
  const viaSecret = ops && String(req.headers['x-ops-secret'] || '') === ops;
  if (!viaSecret && !requireAdmin(req, res)) return;
  if (!HS_TOKEN) {
    res.status(503).json({ error: 'HubSpot not configured' });
    return;
  }

  const limit = Math.min(Number(req.query?.limit) || 500, 500);
  const months = Number(req.query?.months) || 36;
  const verify = String(req.query?.verify || '') === '1';
  // Default ON: only contacts with no logged outreach of any kind.
  const freshOnly = String(req.query?.never_contacted ?? '1') !== '0';
  const excluded = new Set(
    String(req.query?.exclude || '').split(',').map((s: string) => digits(s)).filter(Boolean),
  );

  try {
    // Which boat/interest properties this portal actually has.
    const props = await hs('/crm/v3/properties/contacts');
    const boatProps: string[] = (props.results || [])
      .filter((p: any) => BOAT_HINTS.test(p.name) || BOAT_HINTS.test(p.label || ''))
      .filter((p: any) => !/^hs_|^hubspot|optout|marketable|sakari/i.test(p.name))
      .map((p: any) => p.name)
      .slice(0, 12);

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    // One search per boat property (HubSpot ORs filterGroups, ANDs within a
    // group): mobile known AND recent AND this boat field known.
    const wanted = ['firstname', 'lastname', 'mobilephone', 'phone', 'createdate', 'hs_lead_status', 'notes_last_contacted', 'hubspot_owner_id', ...boatProps];
    const seen = new Map<string, any>();
    for (const bp of boatProps) {
      if (seen.size >= limit * 3) break; // plenty to filter down from
      let after: string | undefined;
      for (let page = 0; page < 4; page++) {
        const r = await hs('/crm/v3/objects/contacts/search', {
          filterGroups: [{ filters: [
            { propertyName: 'mobilephone', operator: 'HAS_PROPERTY' },
            { propertyName: bp, operator: 'HAS_PROPERTY' },
            { propertyName: 'createdate', operator: 'GTE', value: since.toISOString() },
            // "No record of us reaching out": HubSpot stamps notes_last_contacted
            // on any logged call/email/meeting/note, so its absence is the
            // closest thing the CRM has to "never touched by a human".
            ...(freshOnly ? [{ propertyName: 'notes_last_contacted', operator: 'NOT_HAS_PROPERTY' }] : []),
          ] }],
          sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
          properties: wanted,
          limit: 100,
          ...(after ? { after } : {}),
        });
        for (const c of r.results || []) if (!seen.has(c.id)) seen.set(c.id, c);
        after = r.paging?.next?.after;
        if (!after) break;
      }
    }

    // Shape, normalize, suppress.
    const rows = [...seen.values()]
      .map((c: any) => {
        const p = c.properties || {};
        const phone = e164(p.mobilephone || '') || e164(p.phone || '');
        const boat: Record<string, string> = {};
        for (const bp of boatProps) if (p[bp]) boat[bp] = String(p[bp]).slice(0, 120);
        return {
          contact_id: c.id,
          first_name: p.firstname || '',
          last_name: p.lastname || '',
          phone,
          created: (p.createdate || '').slice(0, 10),
          lead_status: p.hs_lead_status || '',
          last_contacted: p.notes_last_contacted || null,
          has_owner: Boolean(p.hubspot_owner_id),
          boat_info: boat,
        };
      })
      .filter((r) => r.phone && Object.keys(r.boat_info).length > 0 && !excluded.has(digits(r.phone)));

    // Newest first, dedupe by number (one text per human).
    rows.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    const byNumber = new Map<string, any>();
    for (const r of rows) if (!byNumber.has(r.phone!)) byNumber.set(r.phone!, r);
    let candidates = [...byNumber.values()];

    const summary: Record<string, unknown> = {
      boat_properties_used: boatProps,
      matched_contacts: seen.size,
      after_filters: candidates.length,
      excluded_supplied: excluded.size,
      never_contacted_only: freshOnly,
    };

    if (verify) {
      if (!TW_SID || !TW_TOKEN) {
        // Key NAMES only — never values — so a misplaced/misnamed var is
        // diagnosable without exposing a credential.
        res.status(503).json({
          error: 'Twilio not configured on this project (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)',
          twilio_env_keys_visible: Object.keys(process.env).filter((k) => /twilio/i.test(k)).sort(),
          summary,
        });
        return;
      }
      const verified: any[] = [];
      const rejected: Record<string, number> = {};
      for (const c of candidates) {
        if (verified.length >= limit) break;
        const type = await lookupLineType(c.phone);
        if (type === 'mobile') verified.push({ ...c, line_type: type });
        else rejected[type || 'lookup_failed'] = (rejected[type || 'lookup_failed'] || 0) + 1;
      }
      summary.twilio_checked = verified.length + Object.values(rejected).reduce((a, b) => a + b, 0);
      summary.rejected_by_line_type = rejected;
      candidates = verified;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      portal: '3826631',
      generated_at: new Date().toISOString(),
      verified_mobile: verify,
      returned: Math.min(candidates.length, limit),
      summary,
      candidates: candidates.slice(0, limit),
    });
  } catch (err) {
    console.error('[admin/sms-candidates] failed:', err);
    res.status(502).json({ error: 'candidate build failed', detail: String(err).slice(0, 300) });
  }
}
