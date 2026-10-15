import { parseJsonBody } from '../_lib/http.js';
import { recordVoiceCall, hubspotConfigured } from '../_lib/voiceHubspot.js';

// POST /api/voice/log-call — the ElevenLabs phone receptionist's in-call
// write path into FYI HubSpot (portal 3826631). Invoked by the agent BEFORE
// transferring (a connected REFER transfer cuts the line instantly) or at the
// end of untransferred calls. The post-call webhook (api/voice/post-call.ts)
// is the guaranteed backstop; shared logic lives in api/_lib/voiceHubspot.ts
// and dedupes by conversation_id so the two paths write one note, not two.
//
// Auth: requires the shared secret header the ElevenLabs webhook tool sends.
// Fails closed if VOICE_WEBHOOK_SECRET isn't configured.

export const maxDuration = 30;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const secret = (process.env.VOICE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    res.status(503).json({ error: 'voice logging not configured' });
    return;
  }
  if (String(req.headers['x-voice-secret'] || '') !== secret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!hubspotConfigured()) {
    res.status(503).json({ error: 'HubSpot not configured' });
    return;
  }

  const body = await parseJsonBody(req);
  const name = String(body?.caller_name || '').trim();
  const phone = String(body?.caller_phone || '').trim();
  const summary = String(body?.summary || '').trim();
  if (!name || !phone || !summary) {
    res.status(400).json({ error: 'caller_name, caller_phone, and summary are required' });
    return;
  }

  try {
    const { contactId, duplicate } = await recordVoiceCall({
      callerName: name,
      callerPhone: phone,
      callerEmail: String(body?.caller_email || '').trim() || undefined,
      summary,
      inquiryType: String(body?.inquiry_type || '').trim() || undefined,
      requestedBroker: String(body?.requested_broker || '').trim() || undefined,
      spanishCaller: body?.spanish_caller === true || body?.spanish_caller === 'true',
      followUpRequired: body?.follow_up_required === true || body?.follow_up_required === 'true',
      conversationId: String(body?.conversation_id || '').trim() || undefined,
    });
    res.status(200).json({ ok: true, contact_id: contactId, duplicate });
  } catch (err) {
    console.error('[voice/log-call] failed:', err);
    res.status(502).json({ ok: false, error: 'CRM write failed — tell the caller their message was taken and flag for manual follow-up' });
  }
}
