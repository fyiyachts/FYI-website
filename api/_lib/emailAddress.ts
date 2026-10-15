// One definition of "a syntactically valid email address" for the whole API.
//
// Extracted from leadGuard.ts so the auth endpoint can share it. Before this,
// /api/auth/send-code checked only for the presence of an "@", handed anything
// that passed to nodemailer, and turned a typo into a 500: production logs on
// 2026-09-08 show three such failures in ten seconds, Gmail answering
// "553-5.1.3 ... not a valid RFC 5321 address" for an address with consecutive
// dots. That is a 400 the visitor can fix, not a server error.

/**
 * Deliberately stricter than RFC 5322: no quoted local parts, no bare-IP or
 * single-label domains. Every address a real customer types still passes.
 */
export const EMAIL_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

/**
 * True when `email` is a plausible, deliverable-looking address.
 *
 * The explicit `..` test catches consecutive dots, which the pattern's own
 * dot-separated structure already forbids but which is worth naming: it is the
 * exact shape that reached Gmail and came back a 553.
 */
export function isValidEmailAddress(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const value = email.trim().toLowerCase();
  if (!value || value.length > 254 || value.includes('..')) return false;
  return EMAIL_RE.test(value);
}
