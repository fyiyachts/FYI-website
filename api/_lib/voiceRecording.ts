// Call recordings for the AI receptionist: uploads the conversation audio to
// HubSpot Files and puts a real Call engagement on the contact timeline, so a
// call shows up with a play button, duration and direction rather than as a
// plain note.
//
// ElevenLabs delivers audio (`post_call_audio`) and transcription
// (`post_call_transcription`) as two separate webhooks with NO guaranteed
// ordering, and only the transcription path creates the contact. So each side
// records what it has and the second one to arrive joins them:
//
//   audio first         -> upload, store URL, no contact yet, stop
//   transcription later -> claims the contact, sees the stored URL, creates Call
//
//   transcription first -> contact recorded in voice_call_contacts
//   audio later         -> upload, store URL, find contact, creates Call
//
// Both sides go through maybeCreateCallRecord(), which is idempotent on
// conversation_id, so exactly one Call engagement exists per conversation.

import { findRecordedContact } from './voiceIdempotency.js';
import { attachRecordingToNote } from './voiceHubspot.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const TABLE = 'voice_call_recordings';

// Vercel caps a serverless request body; a long call's base64 mp3 can exceed
// it. Skip loudly rather than throw — a missing recording must never cost us
// the call log itself.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const sbHeaders = (): Record<string, string> => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

const sbConfigured = (): boolean => !!SUPABASE_URL && !!SERVICE_ROLE_KEY;

interface RecordingRow {
  recording_url?: string | null;
  duration_ms?: number | null;
  call_created?: boolean | null;
  call_id?: string | null;
  transcript?: string | null;
  summary?: string | null;
}

/**
 * Render an ElevenLabs transcript as something a broker can actually read.
 *
 * The webhook gives turn objects; HubSpot's timeline renders plain text. Roles
 * become speaker labels ("Brianna" rather than "agent") because the person
 * reading this in the CRM has no idea what "agent" means.
 */
export function formatTranscript(turns: any[]): string {
  if (!Array.isArray(turns) || !turns.length) return '';
  const lines: string[] = [];
  for (const t of turns) {
    const text = String(t?.message ?? '').trim();
    if (!text) continue; // tool-call-only turns carry no speech
    const role = String(t?.role ?? '').toLowerCase();
    lines.push(`${role === 'user' ? 'Caller' : 'Brianna'}: ${text}`);
  }
  return lines.join('\n');
}

async function getRecording(conversationId: string): Promise<RecordingRow | null> {
  if (!sbConfigured()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?conversation_id=eq.${encodeURIComponent(conversationId)}` +
        `&select=recording_url,duration_ms,call_created,call_id,transcript,summary`,
      { headers: sbHeaders() },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as RecordingRow[];
    return rows?.[0] || null;
  } catch (err) {
    console.error('[voice/recording] lookup error:', err);
    return null;
  }
}

/** The hosted mp3 for this conversation, if the audio webhook has already run.
 *  Lets the transcription path put the link straight into the note it creates,
 *  covering the ordering where audio lands first. */
export async function getRecordingUrl(conversationId: string): Promise<string | undefined> {
  if (!conversationId) return undefined;
  return (await getRecording(conversationId))?.recording_url || undefined;
}

async function upsertRecording(conversationId: string, fields: Record<string, unknown>): Promise<void> {
  if (!sbConfigured()) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=conversation_id`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ conversation_id: conversationId, ...fields }]),
    });
    if (!res.ok) console.error('[voice/recording] upsert failed:', res.status, (await res.text()).slice(0, 200));
  } catch (err) {
    console.error('[voice/recording] upsert error:', err);
  }
}

/**
 * Pull the base64 audio out of a post_call_audio payload.
 *
 * The field name is not something we should bet the feature on, so accept the
 * plausible spellings and log the actual keys when none match — a single real
 * delivery then tells us exactly what to keep.
 */
export function extractAudioBase64(data: any): string | null {
  const candidates = [data?.full_audio, data?.audio, data?.audio_base64, data?.full_audio_base64];
  for (const c of candidates) if (typeof c === 'string' && c.length > 100) return c;
  console.warn('[voice/recording] no audio field found; payload keys:', Object.keys(data || {}).join(','));
  return null;
}

/** Upload an mp3 to HubSpot Files and return its hosted URL. */
async function uploadToHubSpotFiles(audio: Buffer, conversationId: string): Promise<string | null> {
  // PUBLIC_NOT_INDEXABLE: HubSpot's inline player fetches the URL unauthenticated,
  // so a private file will not play. The filename carries the conversation id,
  // which is long and random, and the file is excluded from search indexing —
  // but anyone holding the URL can play the call. Flagged deliberately.
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/mpeg' }), `${conversationId}.mp3`);
  form.append('folderPath', '/ai-receptionist-calls');
  form.append('options', JSON.stringify({
    access: 'PUBLIC_NOT_INDEXABLE',
    overwrite: true,
    duplicateValidationStrategy: 'NONE',
    duplicateValidationScope: 'ENTIRE_PORTAL',
  }));

  const res = await fetch('https://api.hubapi.com/files/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${HS_TOKEN}` }, // no Content-Type: fetch sets the multipart boundary
    body: form,
  });
  if (!res.ok) {
    console.error('[voice/recording] file upload failed:', res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const j: any = await res.json();
  return j?.url || j?.friendlyUrl || null;
}

/** Create the HubSpot Call engagement, associated to the contact. */
async function createCallEngagement(opts: {
  contactId: string;
  conversationId: string;
  recordingUrl: string | null;
  durationMs?: number | null;
  callerPhone?: string;
  summary?: string;
  transcript?: string;
}): Promise<string | null> {
  const { contactId, conversationId, recordingUrl, durationMs, callerPhone, summary, transcript } = opts;
  // Summary first so the timeline preview is useful, then the verbatim call.
  // 60k keeps well inside HubSpot's property ceiling while covering a call far
  // longer than anything this line takes.
  const body = [
    // First line, because it is the thing a broker most often wants. HubSpot
    // only renders its inline audio player for calls ingested through its own
    // calling integrations — on an API-created Call, hs_call_recording_url is
    // stored but never shown. So the link has to live in the body to be usable.
    recordingUrl ? `▶ Recording: ${recordingUrl}\n\n` : '',
    summary || 'Inbound call handled by the AI receptionist.',
    transcript ? `\n\n--- Transcript ---\n${transcript}` : '',
    `\n\nCall ref: ${conversationId}`,
  ].join('').slice(0, 60000);
  try {
    const created = await fetch('https://api.hubapi.com/crm/v3/objects/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          hs_timestamp: Date.now().toString(),
          hs_call_title: 'AI receptionist call',
          hs_call_body: body,
          hs_call_direction: 'INBOUND',
          hs_call_status: 'COMPLETED',
          ...(recordingUrl ? { hs_call_recording_url: recordingUrl } : {}),
          ...(durationMs ? { hs_call_duration: String(durationMs) } : {}),
          ...(callerPhone ? { hs_call_from_number: callerPhone } : {}),
        },
      }),
    });
    if (!created.ok) {
      console.error('[voice/recording] call create failed:', created.status, (await created.text()).slice(0, 300));
      return null;
    }
    const callId = (await created.json())?.id;

    // v4 "default" association: uses the standard call->contact type without
    // hardcoding its numeric id.
    const assoc = await fetch(
      `https://api.hubapi.com/crm/v4/objects/calls/${callId}/associations/default/contacts/${contactId}`,
      { method: 'PUT', headers: { Authorization: `Bearer ${HS_TOKEN}` } },
    );
    if (!assoc.ok) {
      // The call exists but floats unattached — worth knowing, not worth failing.
      console.error('[voice/recording] call association failed:', assoc.status, (await assoc.text()).slice(0, 200));
    }
    console.log('[voice/recording]', conversationId, '→ call', callId, 'on contact', contactId);
    return callId || null;
  } catch (err) {
    console.error('[voice/recording] call create error:', err);
    return null;
  }
}

/** Attach a recording to a Call engagement that already exists. Sets the
 *  property AND prepends the link to the body, since the property alone is not
 *  rendered on an API-created Call. */
async function attachRecordingToCall(callId: string, recordingUrl: string): Promise<boolean> {
  let existingBody = '';
  try {
    const cur = await fetch(
      `https://api.hubapi.com/crm/v3/objects/calls/${callId}?properties=hs_call_body`,
      { headers: { Authorization: `Bearer ${HS_TOKEN}` } },
    );
    if (cur.ok) existingBody = (await cur.json())?.properties?.hs_call_body || '';
  } catch { /* fall through: worst case the body keeps its original text */ }

  const alreadyLinked = existingBody.includes(recordingUrl);
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/calls/${callId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: {
      hs_call_recording_url: recordingUrl,
      ...(alreadyLinked ? {} : {
        hs_call_body: `▶ Recording: ${recordingUrl}\n\n${existingBody}`.slice(0, 60000),
      }),
    } }),
  });
  if (!res.ok) {
    console.error('[voice/recording] attach failed:', res.status, (await res.text()).slice(0, 200));
    return false;
  }
  return true;
}

/**
 * Create the Call engagement if both halves are now available. Safe to call
 * from either webhook, any number of times: it no-ops unless there is a
 * recording, a contact, and no Call already made for this conversation.
 */
export async function maybeCreateCallRecord(
  conversationId: string,
  opts: { contactId?: string; callerPhone?: string; summary?: string; transcript?: string } = {},
): Promise<boolean> {
  if (!conversationId || !HS_TOKEN) return false;
  const row = await getRecording(conversationId);
  if (!row || row.call_created) return false;
  // Audio is an enrichment, not a prerequisite: a call with a transcript and no
  // recording still belongs on the timeline as a Call. Requiring the recording
  // meant that when the audio webhook was switched off, transcripts piled up in
  // this table and no Call record was ever created (observed 2026-08-13).
  if (!row.recording_url && !row.transcript && !opts.transcript) return false;

  const contactId = opts.contactId || (await findRecordedContact(conversationId));
  if (!contactId) return false; // the other webhook hasn't created the contact yet

  const callId = await createCallEngagement({
    contactId,
    conversationId,
    recordingUrl: row.recording_url || null,
    durationMs: row.duration_ms,
    callerPhone: opts.callerPhone,
    summary: opts.summary || row.summary || undefined,
    transcript: opts.transcript || row.transcript || undefined,
  });
  if (callId) await upsertRecording(conversationId, { call_created: true, call_id: callId });
  return Boolean(callId);
}

/**
 * Stash what only the transcription webhook has, so the Call engagement carries
 * it no matter which delivery ends up creating the record. Called before the
 * audio may even have arrived.
 */
export async function storeCallTranscript(
  conversationId: string,
  transcript: string,
  summary?: string,
): Promise<void> {
  if (!conversationId || (!transcript && !summary)) return;
  await upsertRecording(conversationId, {
    ...(transcript ? { transcript: transcript.slice(0, 100000) } : {}),
    ...(summary ? { summary: summary.slice(0, 10000) } : {}),
  });
}

/** Handle a post_call_audio delivery: upload, store, and attach if we can. */
export async function handleCallAudio(data: any): Promise<{ stored: boolean; called: boolean }> {
  const conversationId = String(data?.conversation_id || '').trim();
  if (!conversationId) return { stored: false, called: false };
  if (!HS_TOKEN) {
    console.warn('[voice/recording] HubSpot not configured; audio dropped for', conversationId);
    return { stored: false, called: false };
  }

  const existing = await getRecording(conversationId);
  if (existing?.recording_url) {
    // Redelivery — don't upload the same audio twice, but the contact may have
    // shown up since, so still try to attach.
    await attachRecordingToNote(conversationId, existing.recording_url);
    const called = await maybeCreateCallRecord(conversationId);
    return { stored: true, called };
  }

  const b64 = extractAudioBase64(data);
  if (!b64) return { stored: false, called: false };
  const audio = Buffer.from(b64, 'base64');
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    console.warn('[voice/recording] audio too large, skipping:', conversationId, audio.byteLength);
    return { stored: false, called: false };
  }

  const url = await uploadToHubSpotFiles(audio, conversationId);
  if (!url) return { stored: false, called: false };

  const durationMs = Number(data?.call_duration_secs) ? Number(data.call_duration_secs) * 1000 : null;
  await upsertRecording(conversationId, { recording_url: url, ...(durationMs ? { duration_ms: durationMs } : {}) });

  // Put the link on the note as well as the Call. The note is the entry brokers
  // read; it is normally written by the transcription webhook a minute before
  // this one arrives, so the link has to be patched in after the fact.
  await attachRecordingToNote(conversationId, url);

  // The Call may already exist, created from the transcript before the audio
  // arrived; in that case attach the recording to it rather than making another.
  if (existing?.call_created && existing.call_id) {
    const ok = await attachRecordingToCall(existing.call_id, url);
    return { stored: true, called: ok };
  }

  const called = await maybeCreateCallRecord(conversationId);
  return { stored: true, called };
}
