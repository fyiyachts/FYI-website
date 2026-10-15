// Idempotency for the AI receptionist's HubSpot writes, backed by the Suite
// Supabase project (same SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY the portal
// uses). See the table comment on public.voice_call_contacts for the why.
//
// Short version: a phone call is written to HubSpot by two independent paths
// about a minute apart, and HubSpot's CRM search — the only way to look a
// contact up — is eventually consistent, so the second path could not see what
// the first had just created. This table is the read-after-write store that
// lets them converge.
//
// Every helper is a safe no-op when Supabase env vars are absent, so local dev
// and any misconfiguration degrade to the old behaviour rather than failing
// the call.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = 'voice_call_contacts';

export const voiceIdempotencyConfigured = (): boolean => !!SUPABASE_URL && !!SERVICE_ROLE_KEY;

const authHeaders = (): Record<string, string> => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

/** The HubSpot contact already recorded for this conversation, if any. */
export async function findRecordedContact(conversationId: string): Promise<string | null> {
  if (!voiceIdempotencyConfigured() || !conversationId) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?conversation_id=eq.${encodeURIComponent(conversationId)}&select=contact_id`,
      { headers: authHeaders() },
    );
    if (!res.ok) {
      console.error('[voice/idempotency] lookup failed:', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const rows = (await res.json()) as Array<{ contact_id?: string }>;
    return rows?.[0]?.contact_id || null;
  } catch (err) {
    // Never let the idempotency store block logging a call — worst case we
    // fall back to the old find-or-create behaviour.
    console.error('[voice/idempotency] lookup error:', err);
    return null;
  }
}

/**
 * Claim this conversation for `contactId`.
 *
 * Returns the contact id that actually owns the conversation. Normally that is
 * the one passed in; if another path claimed it first (a genuine race, as
 * opposed to the ordinary minute-apart sequence), the winner's id comes back
 * instead so the caller can defer to it. Returns null only when the store is
 * unavailable, which means "carry on unguarded".
 */
export async function claimConversation(
  conversationId: string,
  contactId: string,
  callerPhone?: string,
): Promise<string | null> {
  if (!voiceIdempotencyConfigured() || !conversationId) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      // ignore-duplicates: the conversation_id primary key makes this an atomic
      // claim — a conflicting insert is a no-op and comes back as an empty array.
      headers: { ...authHeaders(), Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify([{
        conversation_id: conversationId,
        contact_id: contactId,
        ...(callerPhone ? { caller_phone: callerPhone } : {}),
      }]),
    });
    if (!res.ok) {
      console.error('[voice/idempotency] claim failed:', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const rows = (await res.json()) as Array<{ contact_id?: string }>;
    if (rows?.length) return rows[0].contact_id || contactId; // we won the claim
    // Lost the race — read back whoever holds it.
    return (await findRecordedContact(conversationId)) || contactId;
  } catch (err) {
    console.error('[voice/idempotency] claim error:', err);
    return null;
  }
}
