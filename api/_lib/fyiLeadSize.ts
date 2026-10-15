import { hsRequest } from './fyiHubspotLeads.js';

/**
 * Boat-size capture for FYI leads (HubSpot portal 3826631).
 *
 * FYI's HubSpot has no native numeric length field — size historically lived
 * only in free-text lead-ad answers. Two custom contact properties fix that:
 *
 *   boat_length_of_interest — number (feet). Written with the EXACT length of
 *       the listing a website/portal lead inquired on, or a footage parsed
 *       from their free-text answers. The Internal Stats size buckets prefer
 *       this over text parsing.
 *   boat_size_checked_at    — datetime. Stamped by the enrich-lead-sizes cron
 *       so contacts it could not size aren't re-scanned every run.
 *
 * Property creation is attempted lazily (needs the private app to carry
 * crm.schemas.contacts.write); a scope failure logs loudly with the manual
 * fix instead of breaking the caller.
 */

export const LENGTH_PROP = 'boat_length_of_interest';
export const SIZE_CHECKED_PROP = 'boat_size_checked_at';

/**
 * Pull a length-in-feet out of free text. A number with an explicit foot
 * marker (55ft / 55' / 55 feet / 55-foot) always wins; otherwise fall back to
 * a bare 2-digit number in the 25–199 range (catches "Princess 60",
 * "Azimut 43") — which deliberately rejects model numbers like "Sundancer 500"
 * or "Cobia 237cc" and years. Returns null when nothing plausible is found.
 */
export function parseLengthFt(text: string): number | null {
  const unitRe = /(\d{2,3}(?:\.\d+)?)\s*(?:-?\s*(?:ft|foot|feet)\b|['’′])/gi;
  for (let m = unitRe.exec(text); m; m = unitRe.exec(text)) {
    const n = parseFloat(m[1]);
    if (n >= 20 && n < 400) return n;
  }
  const bareRe = /(?<![\d.])(\d{2,3})(?![\d.]|\s*(?:hp|cc|k\b))/gi;
  for (let m = bareRe.exec(text); m; m = bareRe.exec(text)) {
    const n = parseInt(m[1], 10);
    if (n >= 25 && n < 200) return n;
  }
  return null;
}

let propsEnsured = false;

/** Create the two custom properties if the portal doesn't have them yet. */
export async function ensureSizeProps(token: string): Promise<void> {
  if (propsEnsured) return;
  const defs = [
    {
      name: LENGTH_PROP,
      label: 'Boat Length of Interest (ft)',
      type: 'number',
      fieldType: 'number',
      groupName: 'contactinformation',
      description:
        'Feet of the boat this lead is shopping for — exact from a listing inquiry, or parsed from their form answer. Written by fyi-yacht-search.',
    },
    {
      name: SIZE_CHECKED_PROP,
      label: 'Boat Size Checked At',
      type: 'datetime',
      fieldType: 'date',
      groupName: 'contactinformation',
      description: 'When the enrich-lead-sizes cron last scanned this contact for a boat size.',
    },
  ];
  for (const def of defs) {
    const r = await hsRequest(token, 'POST', '/crm/v3/properties/contacts', def);
    // 409 = already exists; anything else non-ok is a real problem (usually a
    // missing crm.schemas.contacts.write scope) — log the manual fix.
    if (!r.ok && r.status !== 409) {
      console.error(
        `[fyiLeadSize] could not create contact property ${def.name} (${r.status}) — create it manually in HubSpot (Settings → Properties → Contact) as ${def.type}, internal name "${def.name}"`,
        r.json?.message ?? ''
      );
    }
  }
  propsEnsured = true;
}

/**
 * Stamp a contact's boat_length_of_interest by email, creating a minimal
 * contact when none exists yet (the CRM webhook that also creates the contact
 * is keyed on the same email, so both paths converge on one record).
 * Best-effort: returns false on any failure, never throws.
 */
export async function recordLeadSizeByEmail(
  token: string,
  email: string,
  lengthFt: number,
  extras: { firstname?: string; lead_source?: string } = {}
): Promise<boolean> {
  try {
    await ensureSizeProps(token);
    const properties: Record<string, string> = { [LENGTH_PROP]: String(Math.round(lengthFt)) };

    const existing = await hsRequest(
      token,
      'GET',
      `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`
    );
    if (existing.ok && existing.json?.id) {
      const r = await hsRequest(token, 'PATCH', `/crm/v3/objects/contacts/${existing.json.id}`, { properties });
      return r.ok;
    }

    const r = await hsRequest(token, 'POST', '/crm/v3/objects/contacts', {
      properties: {
        email,
        ...(extras.firstname ? { firstname: extras.firstname } : {}),
        ...(extras.lead_source ? { lead_source: extras.lead_source } : {}),
        lifecyclestage: 'lead',
        ...properties,
      },
    });
    if (r.ok) return true;
    // 409 = created concurrently (e.g. by the CRM webhook) — patch the id the
    // error names ("Contact already exists. Existing ID: 12345").
    const idMatch = /existing id:?\s*(\d+)/i.exec(r.json?.message ?? '');
    if (r.status === 409 && idMatch) {
      const p = await hsRequest(token, 'PATCH', `/crm/v3/objects/contacts/${idMatch[1]}`, { properties });
      return p.ok;
    }
    console.error(`[fyiLeadSize] contact upsert failed (${r.status})`, r.json?.message ?? '');
    return false;
  } catch (err) {
    console.error('[fyiLeadSize] recordLeadSizeByEmail error:', err);
    return false;
  }
}
