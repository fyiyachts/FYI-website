import { parseJsonBody, fail, ok } from '../_lib/http.js';
import { verifySession } from '../_lib/authVerify.js';
import { verifyUnsubscribeToken } from '../_lib/unsubscribeToken.js';

// POST/GET /api/alerts/unsubscribe — remove a market-alert subscription.
//
// This endpoint used to take an address and nothing else, so anyone could
// unsubscribe anyone. It now requires one of two proofs:
//
//   1. a signed token from a link we mailed to that address, or
//   2. a valid session cookie, and then only for the signed-in user's OWN
//      address — the path the app's "turn off alerts" control uses.
//
// GET renders a confirmation page rather than acting. Mail clients and
// security scanners routinely prefetch links in email, and a GET that
// unsubscribed on sight would quietly drop people off the list; the button on
// that page POSTs. (For RFC 8058 one-click headers, POST the same URL with the
// token — that path is honored below and needs no page.)

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

async function kvDel(key: string): Promise<void> {
  await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** The address this request is allowed to act on, or null. */
function authorize(req: any, token: unknown): string | null {
  const fromToken = verifyUnsubscribeToken(token);
  if (fromToken) return fromToken.email;

  // Session fallback: a signed-in visitor may unsubscribe themselves. The
  // address comes from the verified session, never from the request body, so
  // a session cannot be used to unsubscribe somebody else.
  const cookie = String(req?.headers?.cookie || '');
  const match = cookie.match(/fyi_session=([^;]+)/);
  if (!match) return null;
  return verifySession(match[1])?.email?.toLowerCase() || null;
}

function confirmPage(email: string, token: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Unsubscribe — FYI Yachts</title>
<style>
  body{margin:0;background:#eceae4;font-family:Georgia,serif;color:#0A192F;
       display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;max-width:460px;padding:40px;text-align:center;
        box-shadow:0 1px 3px rgba(0,0,0,.08)}
  h1{font-size:20px;margin:0 0 12px;font-weight:400}
  p{font-size:14px;line-height:1.7;color:#4a5568;margin:0 0 24px}
  .email{font-weight:700;color:#0A192F}
  button{background:#0A192F;color:#fff;border:0;padding:14px 32px;font-size:11px;
         font-weight:700;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}
  button:hover{background:#1b3a5f}
  a{display:inline-block;margin-top:18px;font-size:12px;color:#8a93a0}
</style></head><body>
<div class="card">
  <h1>Stop market alerts?</h1>
  <p>We'll stop sending new-listing and price-drop alerts to
     <span class="email">${esc(email)}</span>.</p>
  <form method="POST" action="/api/alerts/unsubscribe">
    <input type="hidden" name="token" value="${esc(token)}" />
    <button type="submit">Unsubscribe</button>
  </form>
  <a href="https://fyiyachts.com">Never mind — back to FYI Yachts</a>
</div></body></html>`;
}

/**
 * The token, from wherever this request carries it: the query string (the
 * emailed link), a JSON body (the app), or a urlencoded body (the confirmation
 * page's plain <form>, which posts urlencoded — parseJsonBody yields nothing
 * for that, so it is parsed explicitly here).
 */
function tokenFromRequest(req: any): unknown {
  const fromQuery = req?.query?.token;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;

  const raw = req?.body;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)?.token ?? new URLSearchParams(raw).get('token') ?? undefined;
    } catch {
      return new URLSearchParams(raw).get('token') ?? undefined;
    }
  }
  return parseJsonBody(req)?.token;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!KV_URL || !KV_TOKEN) return fail(res, 'KV not configured');

  try {
    const token = tokenFromRequest(req);

    const email = authorize(req, token);
    if (!email) {
      // Same answer for a missing, forged and expired token: nothing here
      // should help someone work out which addresses are on the list.
      //
      // Answered directly rather than through fail(): that helper infers the
      // status from the message text, and any wording containing "invalid"
      // gets rewritten to 400. An authorization refusal is a 403.
      res.status(403).json({ error: 'This unsubscribe link is invalid or has expired.' });
      return;
    }

    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex');
      // The page embeds the token — never let a shared cache hold it.
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(confirmPage(email, typeof token === 'string' ? token : ''));
      return;
    }

    await kvDel(`alert:user:${email}`);
    console.log('[alerts/unsubscribe] removed a subscription');
    return ok(res, { unsubscribed: true });
  } catch (err) {
    return fail(res, err);
  }
}
