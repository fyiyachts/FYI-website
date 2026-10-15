import { createSign } from 'node:crypto';

// Google service-account auth, shared by every route that talks to a Google
// API (Search Console, GA4, Indexing). The key lives only in Vercel env vars —
// it is never bundled, logged, or sent to the client.
//
// GOOGLE_SERVICE_ACCOUNT_JSON was copied onto this project 2026-08-18. The env
// var name isn't standardized across our projects, so several are accepted;
// raw JSON and base64-encoded JSON both work.

const ENV_CANDIDATES = [
  'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_SERVICE_ACCOUNT',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON', 'GSC_SERVICE_ACCOUNT_KEY', 'GSC_SERVICE_ACCOUNT',
  'SEARCH_CONSOLE_KEY', 'SEARCH_CONSOLE_SERVICE_ACCOUNT',
];

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  [k: string]: unknown;
}

/** Read/write Search Console — required to SUBMIT sitemaps, not just read them. */
export const SCOPE_WEBMASTERS = 'https://www.googleapis.com/auth/webmasters';
/** Read-only Search Console — enough for Search Analytics and URL Inspection. */
export const SCOPE_WEBMASTERS_READONLY = 'https://www.googleapis.com/auth/webmasters.readonly';
export const SCOPE_ANALYTICS_READONLY = 'https://www.googleapis.com/auth/analytics.readonly';

function safeB64(s: string): string | null {
  try { return Buffer.from(s, 'base64').toString('utf8'); } catch { return null; }
}

export function loadServiceAccount(): { creds: ServiceAccount; envName: string } | { error: string } {
  for (const name of ENV_CANDIDATES) {
    const raw = process.env[name];
    if (!raw) continue;
    for (const text of [raw, safeB64(raw)]) {
      if (!text) continue;
      try {
        const creds = JSON.parse(text);
        if (creds.client_email && creds.private_key) return { creds, envName: name };
      } catch { /* try next decoding/name */ }
    }
  }
  return { error: `No Google service-account key found. Expected one of: ${ENV_CANDIDATES.join(', ')}` };
}

const b64url = (b: Buffer | string): string =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Service-account JWT → OAuth access token (no SDK needed — googleapis is
 * ~50MB of bundle for what is two signed base64 blobs and a POST).
 *
 * Pass every scope the caller needs in one token: Google returns a token
 * scoped to exactly what was asked for, and a request outside those scopes
 * 403s with "Request had insufficient authentication scopes".
 */
export async function getAccessToken(creds: ServiceAccount, scopes: string[]): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(creds.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const data: any = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`token exchange failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.access_token;
}

/** Authenticated Google API call. GET when `body` is omitted, otherwise `method`. */
export async function gFetch(
  token: string,
  url: string,
  body?: unknown,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
): Promise<any> {
  const verb = method || (body === undefined ? 'GET' : 'POST');
  const res = await fetch(url, {
    method: verb,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Sitemap PUT/DELETE answer 204 with an empty body — .json() would throw.
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : {};
  if (!res.ok) {
    const host = url.split('//')[1]?.split('/')[0] ?? url;
    throw new Error(`${host} ${res.status}: ${String(data.error?.message || data.raw || JSON.stringify(data)).slice(0, 300)}`);
  }
  return data;
}

/**
 * Search Console properties this service account can see, FYI ones first.
 * A domain property (`sc-domain:`) is preferred wherever one exists — it
 * aggregates www/non-www and http/https, so it is the only property that
 * sees the whole site.
 */
export async function listSites(token: string): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
  const sites = await gFetch(token, 'https://searchconsole.googleapis.com/webmasters/v3/sites');
  return (sites.siteEntry || []) as Array<{ siteUrl: string; permissionLevel: string }>;
}

export function pickSite(
  entries: Array<{ siteUrl: string; permissionLevel: string }>,
  host = 'fyiyachts.com',
): { siteUrl: string; permissionLevel: string } | null {
  const mine = entries.filter((s) => s.siteUrl.includes(host));
  if (!mine.length) return null;
  return mine.find((s) => s.siteUrl.startsWith('sc-domain:')) || mine[0];
}
