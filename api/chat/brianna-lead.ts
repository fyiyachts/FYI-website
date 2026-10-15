import { parseJsonBody } from '../_lib/http.js';
import { deliverChatLead } from '../_lib/briannaLead.js';
import { parseAttribution } from '../_lib/attribution.js';

// POST /api/chat/brianna-lead — submit target for the mini contact form the
// Brianna widget renders in-chat (see the show_contact_form tool in
// api/chat/brianna.ts). Delivers through the same three channels as the
// conversational capture_lead path (FYI HubSpot + sales-desk email + CRM
// site-inquiry webhook → broker SMS), so form leads and chat-typed leads are
// indistinguishable downstream.
//
// Public like the chat endpoint; defenses: per-IP rate limit, field length
// caps, a honeypot field ("company") that bots fill and humans never see.

export const maxDuration = 30;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = String(req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'Please wait a moment before trying again.' });

  const body = parseJsonBody(req);

  // Honeypot: real visitors never see this field. Pretend success so bots
  // don't learn they were filtered.
  if (typeof body?.company === 'string' && body.company.trim()) {
    return res.status(200).json({ ok: true });
  }

  const name = String(body?.name || '').trim().slice(0, 200);
  const email = String(body?.email || '').trim().slice(0, 200);
  const phone = String(body?.phone || '').trim().slice(0, 60);
  const interest = String(body?.interest || '').trim().slice(0, 600);
  const brands = Array.isArray(body?.brands)
    ? body.brands.map((b: unknown) => String(b).trim()).filter(Boolean).slice(0, 20)
    : undefined;
  const budget = body?.budget ? String(body.budget).trim().slice(0, 100) : undefined;

  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

  try {
    const result = await deliverChatLead({
      name,
      email,
      phone: phone || undefined,
      interest: interest || 'Contact request from the Brianna chat form.',
      brands,
      budget,
      attribution: parseAttribution(body?.attribution),
    });
    return res.status(200).json({ ok: true, hubspot: Boolean(result.hubspotContactId) });
  } catch (err) {
    console.error('[chat/brianna-lead] delivery failed:', err);
    return res.status(502).json({
      error: 'We could not submit your details just now — please email sales@fyiyachts.com or call (305) 854-6020.',
    });
  }
}
