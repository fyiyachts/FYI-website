import { verifySession } from './authVerify.js';

// Server-side admin gate shared by every /api/admin/* route. Mirrors
// utils/admin.ts (the client-side gate) — keep the two lists in sync.
// api/admin/stats.ts predates this helper and still inlines the same check.

const ADMIN_EMAILS = [
  'salvarez@fyiyachts.com',
  'alejandra@fyiyachts.com',
  'navarro@fyiyachts.com',
  'joelgomes@fyiyachts.com',
];
const ADMIN_EMAIL_DOMAINS: string[] = [];

export const isAdminEmail = (email: string | undefined | null): boolean => {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (ADMIN_EMAILS.includes(e)) return true;
  const domain = e.split('@')[1];
  return !!domain && ADMIN_EMAIL_DOMAINS.includes(domain);
};

/**
 * Validates the fyi_session cookie and the admin allowlist in one step.
 * Returns the session email on success; otherwise writes the 401/403
 * response itself and returns null (caller just returns).
 */
export function requireAdmin(req: any, res: any): string | null {
  const cookie = req.headers?.cookie || '';
  const match = cookie.match(/fyi_session=([^;]+)/);
  if (!match) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  const session = verifySession(match[1]);
  if (!session) {
    res.status(401).json({ error: 'Invalid session' });
    return null;
  }
  if (!isAdminEmail(session.email)) {
    res.status(403).json({ error: 'Forbidden — admins only' });
    return null;
  }
  return session.email;
}
