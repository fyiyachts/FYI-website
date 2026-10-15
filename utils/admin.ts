// Admin gate for FYI internal-only surfaces (e.g. the Internal Stats page).
//
// Access is an explicit allowlist, NOT the whole company domain:
//   - a fixed set of named FYI staff, plus
//   - every user at an ADMIN_EMAIL_DOMAINS domain (none by default).
// Add/remove people by editing ADMIN_EMAILS or ADMIN_EMAIL_DOMAINS. Keep this in
// sync with the mirror in api/admin/stats.ts (the server enforces the same gate).

export const ADMIN_EMAILS = [
  'salvarez@fyiyachts.com',
  'alejandra@fyiyachts.com',
  'navarro@fyiyachts.com',
  'joelgomes@fyiyachts.com',
];

// Whole-domain admins (all users at these domains).
export const ADMIN_EMAIL_DOMAINS: string[] = [];

/** True when the email is an allowlisted admin or belongs to an admin domain. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (ADMIN_EMAILS.includes(e)) return true;
  const domain = e.split('@')[1];
  return !!domain && ADMIN_EMAIL_DOMAINS.includes(domain);
}
