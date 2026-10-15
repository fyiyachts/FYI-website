import crypto from 'node:crypto';

// Signed unsubscribe tokens for the market-alert list.
//
// Why: /api/alerts/unsubscribe used to delete a subscription given nothing but
// an address, so anyone who knew (or guessed) a customer's email could take
// them off the list. That is an authorization gap, not a spam problem — a rate
// limit would only have slowed it down — so the endpoint now requires proof
// that the request came from someone holding a link WE sent to that address.
//
// Token shape mirrors the session tokens in authVerify.ts, so there is one
// format to reason about in this codebase: base64url(JSON payload) + "." +
// hex HMAC-SHA256 of that payload.

/**
 * Signing key.
 *
 * Prefers a dedicated ALERTS_UNSUBSCRIBE_SECRET, but falls back to a value
 * DERIVED from AUTH_SECRET rather than to nothing. An unset env var that
 * silently disables a feature has cost this project real debugging time before
 * (see the CRM webhook notes in api/contact/broker.ts), and here the failure
 * would be worse than silent: unsubscribe links in already-delivered mail
 * would stop working, which is a compliance problem, not just a bug.
 *
 * The derivation is domain-separated, so an unsubscribe token can never be
 * replayed as a session token and vice versa, even though both keys trace back
 * to AUTH_SECRET.
 *
 * Trade-off worth knowing: on the derived path, rotating AUTH_SECRET
 * invalidates every outstanding unsubscribe link. Set the dedicated variable
 * to decouple them.
 */
function signingKey(): string {
  const dedicated = (process.env.ALERTS_UNSUBSCRIBE_SECRET || '').trim();
  if (dedicated) return dedicated;
  const base = (process.env.AUTH_SECRET || '').trim();
  if (!base) return '';
  return crypto.createHmac('sha256', base).update('fyi-alerts-unsubscribe-v1').digest('hex');
}

/** Unsubscribe links outlive the mail they ride in; two years is deliberate. */
const DEFAULT_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const hmac = (key: string, payload: string): string =>
  crypto.createHmac('sha256', key).update(payload).digest('hex');

/**
 * Mint a token for an address. Returns '' when no key is configured, so a
 * caller building an email can detect the misconfiguration instead of sending
 * a link that will never verify.
 */
export function signUnsubscribeToken(email: string, ttlMs = DEFAULT_TTL_MS): string {
  const key = signingKey();
  if (!key) {
    console.error(
      '[unsubscribeToken] cannot sign: neither ALERTS_UNSUBSCRIBE_SECRET nor AUTH_SECRET is set',
    );
    return '';
  }
  const payload = Buffer.from(
    JSON.stringify({ email: email.trim().toLowerCase(), exp: Date.now() + ttlMs }),
  ).toString('base64url');
  return `${payload}.${hmac(key, payload)}`;
}

/** The address a token authorizes, or null if it is absent, forged or expired. */
export function verifyUnsubscribeToken(token: unknown): { email: string } | null {
  const key = signingKey();
  if (!key || typeof token !== 'string' || !token) return null;

  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;

  const expected = hmac(key, payload);
  // Constant-time: a length check first, because timingSafeEqual throws on
  // mismatched buffers. Both sides are fixed-length hex, so comparing lengths
  // leaks nothing.
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) return null;
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return { email };
  } catch {
    return null;
  }
}

/**
 * The link to put in an alert email. Point mail at this; the GET renders a
 * confirmation page and the button on it POSTs, so a mail client prefetching
 * the URL cannot unsubscribe anyone by accident.
 */
export function unsubscribeUrl(email: string, origin = 'https://fyiyachts.com'): string {
  const token = signUnsubscribeToken(email);
  return token ? `${origin}/api/alerts/unsubscribe?token=${encodeURIComponent(token)}` : '';
}
