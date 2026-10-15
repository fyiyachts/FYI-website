import { parseJsonBody, fail, ok, methodNotAllowed } from '../_lib/http.js';
import { verifySession } from '../_lib/authVerify.js';
import { saveRecipientProfile } from '../_lib/supabaseUsers.js';

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

async function kvSet(key: string, value: any): Promise<void> {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
}

async function kvGet(key: string): Promise<any> {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result;
}

function profileKey(email: string): string {
  return `profile:${email.toLowerCase()}`;
}

export default async function handler(req: any, res: any) {
  if (!KV_URL || !KV_TOKEN) return fail(res, 'KV not configured');

  // Authenticate via session cookie
  const cookie = req.headers?.cookie || '';
  const sessionMatch = cookie.match(/fyi_session=([^;]+)/);
  if (!sessionMatch) return fail(res, 'Not authenticated', 401);
  const session = verifySession(sessionMatch[1]);
  if (!session) return fail(res, 'Invalid session', 401);

  const key = profileKey(session.email);

  if (req.method === 'GET') {
    const profile = await kvGet(key);
    return ok(res, { profile: profile || null });
  }

  if (req.method === 'POST') {
    const { name, phone, profileImage } = parseJsonBody(req);
    const profile = {
      name: name || '',
      phone: phone || '',
      profileImage: profileImage || '',
      updatedAt: Date.now(),
    };
    await kvSet(key, profile);
    // Mirror profile details into Supabase (Market Alert Recipients).
    try { await saveRecipientProfile(session.email, profile.name, profile.phone); }
    catch (err) { console.error('Supabase saveRecipientProfile failed:', err); }
    return ok(res, { saved: true });
  }

  return methodNotAllowed(res);
}
