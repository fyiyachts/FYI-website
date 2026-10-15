import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  recordVoiceCall, hubspotConfigured, e164, type TransferAttempt,
} from '../_lib/voiceHubspot.js';
import {
  handleCallAudio, maybeCreateCallRecord, storeCallTranscript, formatTranscript, getRecordingUrl,
} from '../_lib/voiceRecording.js';

// POST /api/voice/post-call — ElevenLabs post-call webhook receiver: the
// GUARANTEED HubSpot record for every phone conversation. Unlike the in-call
// log_fyi_call tool (which depends on the model remembering to call it, and
// which a connected transfer can preempt), this fires server-side after every
// conversation ends, carrying the transcript summary and the agent's
// data-collection results. Dedupe: notes carry the conversation_id, and
// recordVoiceCall skips the note/task when one already exists for this call.
//
// Auth: ElevenLabs HMAC signature — header `elevenlabs-signature` of the form
// "t=<unix>,v0=<hex hmac_sha256(secret, `${t}.${rawBody}`)>". Secret lives in
// ELEVENLABS_POSTCALL_SECRET (fails closed when unset).

export const maxDuration = 30;
export const config = { api: { bodyParser: false } };

const readRaw = (req: any): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: any) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

function validSignature(header: string, rawBody: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=', 2) as [string, string]));
  const t = parts['t'];
  const v0 = parts['v0'];
  if (!t || !v0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 30 * 60) return false; // 30-min replay window
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v0.replace(/^v0=/, ''), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

const dc = (results: any, key: string): string | undefined => {
  const v = results?.[key]?.value;
  return v === null || v === undefined || v === '' ? undefined : String(v);
};

/** Pull every transfer_to_number attempt (and its result) out of the transcript. */
function extractTransfers(transcript: any[], requestedBroker?: string): TransferAttempt[] {
  const out: TransferAttempt[] = [];
  for (const turn of transcript || []) {
    for (const call of turn?.tool_calls || []) {
      if ((call.tool_name || call.name) !== 'transfer_to_number') continue;
      let destination = '';
      try {
        const p = JSON.parse(call.params_as_json || '{}');
        destination = String(p.transfer_number || p.phone_number || p.sip_uri || '');
      } catch { /* keep destination empty */ }
      out.push({ destination, who: requestedBroker, errored: false });
    }
    for (const r of turn?.tool_results || []) {
      if ((r.tool_name || r.name) !== 'transfer_to_number') continue;
      const raw = String(r.result_value || '');
      const failed = r.is_error === true || /"result_type"\s*:\s*"[^"]*error/i.test(raw);
      const last = out[out.length - 1];
      if (last && !last.errored && failed) {
        last.errored = true;
        last.errorText = (raw.match(/"(?:error|reason)"\s*:\s*"([^"]{0,120})/)?.[1] || '').trim() || undefined;
      }
    }
  }
  return out;
}

/**
 * True when the transcript proves the caller never actually said anything —
 * the agent spoke, and every caller turn is silence.
 *
 * ElevenLabs renders a detected-but-silent caller turn as "..." and still runs
 * its analysis over the call. That analysis has been returning
 * `follow_up_required: true` on calls with no content at all, which defeats the
 * spam/hangup filter below (it only skips when follow-up is false). Four such
 * dead-air calls landed in HubSpot as "Unknown Caller" contacts carrying a HIGH
 * return-call task in the ten days to 2026-08-25, alongside a recorded
 * robocall. Nobody can action a callback to someone who never spoke.
 *
 * Deliberately conservative — a missing, empty, or agent-less transcript
 * returns false. We must never drop a real lead because the payload arrived in
 * a shape we did not expect; the cost of a junk contact is far lower than the
 * cost of a silently discarded buyer.
 */
export function callerNeverSpoke(transcript: any[]): boolean {
  if (!Array.isArray(transcript) || !transcript.length) return false;
  // Any letter or digit in any script counts as speech, so "..." and bare
  // punctuation do not, but "Hi", "Sí" and "你好" all do.
  const spoke = (turn: any): boolean => /[\p{L}\p{N}]/u.test(String(turn?.message ?? ''));
  let agentSpoke = false;
  for (const turn of transcript) {
    if (String(turn?.role ?? '').toLowerCase() === 'user') {
      if (spoke(turn)) return false;
    } else if (spoke(turn)) {
      agentSpoke = true;
    }
  }
  return agentSpoke;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const secret = (process.env.ELEVENLABS_POSTCALL_SECRET || '').trim();
  if (!secret) {
    res.status(503).json({ error: 'post-call webhook not configured' });
    return;
  }
  const raw = await readRaw(req);
  const sig = String(req.headers['elevenlabs-signature'] || '');
  if (!sig || !validSignature(sig, raw, secret)) {
    res.status(401).json({ error: 'bad signature' });
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: 'invalid JSON' });
    return;
  }
  if (payload?.type === 'post_call_audio') {
    // A separate delivery from the transcription, with no guaranteed ordering.
    // handleCallAudio uploads the recording and creates the HubSpot Call
    // engagement once both halves exist. Always ack: a failed recording must
    // never cost us the call log itself.
    try {
      const r = await handleCallAudio(payload.data || {});
      res.status(200).json({ ok: true, ...r });
    } catch (err) {
      console.error('[voice/post-call] audio handling failed:', err);
      res.status(200).json({ ok: false, error: 'audio handling failed — check function logs' });
    }
    return;
  }
  if (payload?.type !== 'post_call_transcription') {
    res.status(200).json({ ok: true, skipped: payload?.type || 'unknown event' }); // ack, ignore
    return;
  }
  if (!hubspotConfigured()) {
    res.status(503).json({ error: 'HubSpot not configured' });
    return;
  }

  const data = payload.data || {};
  const analysis = data.analysis || {};
  const results = analysis.data_collection_results || {};
  const phoneMeta = data.metadata?.phone_call || {};

  // The trunk's caller ID beats whatever the caller dictated aloud.
  const callerIdRaw: string = phoneMeta.external_number || dc(results, 'client_phone_number') || '';
  const name = dc(results, 'client_name') || 'Unknown Caller';
  const summary: string =
    analysis.transcript_summary?.trim() ||
    'AI receptionist call — no summary generated. See ElevenLabs conversation history.';

  if (!callerIdRaw) {
    // Nothing to key a contact on (e.g. anonymous caller ID) — ack so
    // ElevenLabs doesn't retry/disable, but say what happened.
    console.warn('[voice/post-call] no caller number for', data.conversation_id);
    res.status(200).json({ ok: false, skipped: 'no caller number' });
    return;
  }

  // Dead air is not a lead, whatever the analysis concluded. Checked ahead of
  // the spam/hangup filter below because that one trusts follow_up_required,
  // and the model sets it on calls where nobody said a word. The transcript is
  // still stored first: these calls stay diagnosable in voice_call_recordings
  // even though no HubSpot contact, note, call or task is created for them.
  if (callerNeverSpoke(data.transcript)) {
    await storeCallTranscript(data.conversation_id, formatTranscript(data.transcript), summary)
      .catch((err) => console.error('[voice/post-call] transcript store failed:', err));
    console.warn('[voice/post-call] caller never spoke, skipping', data.conversation_id);
    res.status(200).json({ ok: true, skipped: 'caller never spoke — dead air' });
    return;
  }

  // Spam robocalls shouldn't become CRM leads: skip when the analysis
  // collected no name AND no follow-up is owed AND nobody was requested.
  const followUp = dc(results, 'follow_up_required') === 'true' || results?.follow_up_required?.value === true;
  const requested = dc(results, 'requested_broker');
  if (name === 'Unknown Caller' && !followUp && !requested) {
    res.status(200).json({ ok: true, skipped: 'no identity collected — likely spam/hangup' });
    return;
  }

  try {
    // When the audio delivery beat us here, the note can carry the play link
    // from the moment it is written; otherwise handleCallAudio patches it in.
    const recordingUrl = await getRecordingUrl(data.conversation_id).catch(() => undefined);

    const { contactId, duplicate } = await recordVoiceCall({
      callerName: name,
      ...(recordingUrl ? { recordingUrl } : {}),
      callerPhone: e164(callerIdRaw),
      callerEmail: dc(results, 'client_email'),
      summary:
        summary +
        (dc(results, 'yacht_interest') ? `\nYacht interest: ${dc(results, 'yacht_interest')}` : ''),
      inquiryType: dc(results, 'inquiry_type'),
      requestedBroker: requested,
      spanishCaller: /SPANISH CALLER/i.test(summary) || analysis.transcript_summary_language === 'es',
      followUpRequired: followUp,
      conversationId: data.conversation_id,
      noteTitle: 'AI receptionist call (auto record)',
      // Folded into the single call note. The in-call tool logs before the
      // transfer and so never knows the outcome; when it got there first,
      // recordVoiceCall appends this to that same note rather than filing a
      // second one about the same call.
      transferAttempts: extractTransfers(data.transcript, requested),
    });
    // Keep the verbatim transcript where the Call engagement can reach it. The
    // audio delivery carries no transcript, so if it is the one that ends up
    // creating the Call, this is the only place the text can come from.
    const transcriptText = formatTranscript(data.transcript);
    await storeCallTranscript(data.conversation_id, transcriptText, summary)
      .catch((err) => console.error('[voice/post-call] transcript store failed:', err));

    // If the audio webhook already landed, this is the half it was waiting on:
    // attach the recording as a Call engagement now that a contact exists.
    // No-ops when the audio hasn't arrived — that delivery will do it instead.
    const recorded = await maybeCreateCallRecord(data.conversation_id, {
      contactId,
      callerPhone: e164(callerIdRaw),
      summary,
      transcript: transcriptText,
    }).catch((err) => {
      console.error('[voice/post-call] call record failed:', err);
      return false;
    });

    console.log('[voice/post-call]', data.conversation_id, '→ contact', contactId,
      duplicate ? '(already logged)' : '', recorded ? '[CALL RECORD]' : '');
    res.status(200).json({ ok: true, contact_id: contactId, duplicate, call_record: recorded });
  } catch (err) {
    console.error('[voice/post-call] failed:', err);
    // 200 regardless: ElevenLabs disables webhooks that keep failing, and a
    // disabled webhook silently kills ALL call logging — the one outcome this
    // endpoint exists to prevent.
    res.status(200).json({ ok: false, error: 'CRM write failed — check function logs' });
  }
}
