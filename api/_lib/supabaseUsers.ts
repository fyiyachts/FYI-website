// Persists FYI yacht-search portal users to Supabase (the `market_alert_recipients`
// table), which is the source for the HubSpot "Market Alert Recipients" list.
//
// All writes happen server-side with the service role key, so they bypass RLS.
// If Supabase env vars are absent (e.g. local dev), every helper is a safe no-op.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isConfigured = (): boolean => !!SUPABASE_URL && !!SERVICE_ROLE_KEY;

const authHeaders = (): Record<string, string> => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

// Records a successful login: inserts the recipient or increments their login_count.
export async function recordPortalLogin(email: string): Promise<void> {
  if (!isConfigured()) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_portal_login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ p_email: normalizeEmail(email) }),
  });
  if (!res.ok) throw new Error(`record_portal_login failed: ${res.status} ${await res.text()}`);
}

// Upserts recipient fields, keying on the unique email. On conflict, only the
// supplied columns are updated (login stats are left untouched).
async function upsertRecipient(fields: { email: string } & Record<string, unknown>): Promise<void> {
  if (!isConfigured()) return;
  const payload = [{ ...fields, email: normalizeEmail(fields.email) }];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/market_alert_recipients?on_conflict=email`, {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`upsert market_alert_recipients failed: ${res.status} ${await res.text()}`);
}

// Flags a recipient as subscribed to market alerts, and records the boat brands
// they're interested in (source for FYI HubSpot brand segmentation). Brands are
// only written when present, so a bare re-subscribe never wipes prior interest.
export async function markAlertsSubscribed(email: string, boatBrands: string[] = []): Promise<void> {
  const fields: { email: string } & Record<string, unknown> = { email, alerts_subscribed: true };
  if (boatBrands.length > 0) fields.boat_brands = boatBrands;
  await upsertRecipient(fields);
}

// Stamps the moment a market-alert digest was successfully emailed to a recipient,
// giving the team an auditable record of who received alerts and when.
export async function recordAlertSent(email: string): Promise<void> {
  await upsertRecipient({ email, last_alert_sent_at: new Date().toISOString() });
}

// Stores profile details (name / phone) supplied by the logged-in user.
export async function saveRecipientProfile(email: string, name: string, phone: string): Promise<void> {
  const fields: { email: string } & Record<string, unknown> = { email };
  if (name) fields.name = name;
  if (phone) fields.phone = phone;
  // Nothing beyond the key to write -> skip the round trip.
  if (!('name' in fields) && !('phone' in fields)) return;
  await upsertRecipient(fields);
}
