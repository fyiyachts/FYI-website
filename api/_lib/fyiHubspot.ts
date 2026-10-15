// Syncs FYI market-alert subscribers into the FYI Yacht Search HubSpot portal
// (portalId 3826631) so that
// each subscriber:
//   - enriches their existing contact, or is created as a new one (keyed on email),
//   - is flagged as a marketing subscriber and added to the "Market Alert
//     Recipients" static list, and
//   - lands in the relevant per-brand segments,
// all WITHOUT entering the broker lead pipeline (no owner, no hs_lead_status, and
// written via the Contacts API rather than a form submission).
//
// ─────────────────────────────────────────────────────────────────────────────
// SAFETY / SEQUENCING — read before enabling (setting FYI_HUBSPOT_PAT):
//   The "Internal Lead Notifications FYI Team" workflow (v4 flow 1684956248)
//   enrolls on *any* new contact with an email/phone and pings Ralph + Joel at
//   creation. It MUST first be given an enrollment exclusion for
//   `market_alert_subscriber = true` (edit via automation/v4/flows, GET-verify,
//   re-enable). Also confirm the "24hrs Unassigned Lead" workflow (flow 49987230)
//   won't nudge on these unowned contacts. Only then set FYI_HUBSPOT_PAT.
//
// This module is a safe no-op until FYI_HUBSPOT_PAT is present, so shipping it
// disabled cannot notify anyone.
// ─────────────────────────────────────────────────────────────────────────────

const FYI_PAT = process.env.FYI_HUBSPOT_PAT || '';
const HS = 'https://api.hubapi.com';

// Boolean contact property that marks a market-alert subscriber. Drives both the
// notification-workflow exclusion guard and reporting. Create in FYI if absent.
const SUBSCRIBER_PROPERTY = process.env.FYI_HUBSPOT_SUBSCRIBER_PROPERTY || 'market_alert_subscriber';
// Multi-checkbox contact property the per-brand active lists key on. Confirm the
// exact internal name against portal 3826631 before enabling (brands are skipped,
// not guessed, if this is left unset in a stricter deployment).
const BRAND_PROPERTY = process.env.FYI_HUBSPOT_BRAND_PROPERTY || 'boat_brands_interested';
// ILS id of the "Market Alert Recipients" static list. Optional — membership add
// is skipped when unset. Confirm/create in FYI.
const SUBSCRIBER_LIST_ID = process.env.FYI_HUBSPOT_SUBSCRIBER_LIST_ID || '';

export function isFyiHubspotConfigured(): boolean {
  return Boolean(FYI_PAT);
}

async function hsFetch(path: string, init: any = {}): Promise<Response> {
  return fetch(`${HS}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${FYI_PAT}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

// HubSpot multi-checkbox values are ";"-separated. Union new brands with whatever
// the contact already has so enrichment never clobbers prior selections.
function unionCheckbox(existing: string | undefined | null, additions: string[]): string {
  const set = new Set<string>();
  for (const v of (existing || '').split(';')) { if (v.trim()) set.add(v.trim()); }
  for (const v of additions) { if (v.trim()) set.add(v.trim()); }
  return [...set].join(';');
}

// Look up a contact by email. Returns { id, brands } or null if not found.
async function findContact(email: string): Promise<{ id: string; brands: string } | null> {
  const res = await hsFetch(
    `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email&properties=${encodeURIComponent(BRAND_PROPERTY)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HubSpot get contact failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json();
  return { id: data.id, brands: data.properties?.[BRAND_PROPERTY] || '' };
}

async function addToSubscriberList(contactId: string): Promise<void> {
  if (!SUBSCRIBER_LIST_ID) return;
  const res = await hsFetch(`/crm/v3/lists/${SUBSCRIBER_LIST_ID}/memberships/add`, {
    method: 'PUT',
    body: JSON.stringify([contactId]),
  });
  if (!res.ok) throw new Error(`HubSpot list add failed: ${res.status} ${await res.text()}`);
}

/**
 * Enrich-or-create the market-alert subscriber in FYI HubSpot.
 *
 * - Existing contact: writes ONLY the subscriber flag + a union of brand
 *   interests. Never touches hubspot_owner_id, lifecyclestage, or hs_lead_status
 *   (preserve-owner / never-steal — a sales lead stays a sales lead).
 * - New contact: created as lifecyclestage=subscriber with NO owner and NO lead
 *   status, so the broker pipeline (Callingly, unassigned-lead nudges) has
 *   nothing to grab.
 *
 * Inert unless FYI_HUBSPOT_PAT is configured.
 */
export async function syncMarketAlertContact(
  email: string,
  boatBrands: string[],
  clickProps: Record<string, string> = {},
): Promise<void> {
  if (!isFyiHubspotConfigured()) return; // guard first, enable second — see header
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await findContact(normalizedEmail);

  if (existing) {
    // Additive enrichment only — leave owner / lifecycle / lead status
    // untouched. Ad click ids (native HubSpot props) are safe to stamp.
    const properties: Record<string, string> = { [SUBSCRIBER_PROPERTY]: 'true', ...clickProps };
    if (boatBrands.length > 0) {
      properties[BRAND_PROPERTY] = unionCheckbox(existing.brands, boatBrands);
    }
    const res = await hsFetch(`/crm/v3/objects/contacts/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) throw new Error(`HubSpot patch contact failed: ${res.status} ${await res.text()}`);
    await addToSubscriberList(existing.id);
    return;
  }

  // New contact — subscriber, unowned, no lead status.
  const properties: Record<string, string> = {
    email: normalizedEmail,
    [SUBSCRIBER_PROPERTY]: 'true',
    lifecyclestage: 'subscriber',
    ...clickProps,
  };
  if (boatBrands.length > 0) properties[BRAND_PROPERTY] = boatBrands.join(';');
  const res = await hsFetch(`/crm/v3/objects/contacts`, {
    method: 'POST',
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(`HubSpot create contact failed: ${res.status} ${await res.text()}`);
  const created: any = await res.json();
  await addToSubscriberList(created.id);
}
