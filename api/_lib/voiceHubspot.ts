// Shared HubSpot write path for the phone receptionist (FYI portal 3826631).
// Used by two callers with the same semantics:
//   - api/voice/log-call.ts   — the in-call webhook tool (LLM-invoked)
//   - api/voice/post-call.ts  — the ElevenLabs post-call webhook (fires for
//     EVERY conversation, no LLM in the loop — the guaranteed record)
// Contact upsert is by email-else-phone and additive-only. The two paths are
// kept from duplicating each other by the conversation_id claim in
// voiceIdempotency.ts — NOT by the contact lookup, which cannot do that job:
// HubSpot's CRM search is eventually consistent, so the second path (about a
// minute behind the first) could not see the contact the first had just
// created. That produced duplicate contacts, notes, tasks and broker texts in
// production on 2026-08-12; see the table comment on voice_call_contacts.

import { findRecordedContact, claimConversation } from './voiceIdempotency.js';

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const HS_BASE = 'https://api.hubapi.com';
const NOTE_TO_CONTACT = 202; // HubSpot-defined association typeId: note → contact
const TASK_TO_CONTACT = 204; // HubSpot-defined association typeId: task → contact

export const hubspotConfigured = (): boolean => Boolean(HS_TOKEN);

async function hs(method: string, path: string, body?: unknown, attempt = 0): Promise<any> {
  const res = await fetch(`${HS_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    return hs(method, path, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`HubSpot ${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

export const e164 = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return raw.startsWith('+') ? raw : `+${digits}`;
};

/**
 * The formats a US number is realistically stored in.
 *
 * HubSpot does NOT normalize phone properties for search: `phone EQ` is an
 * exact string match, verified 2026-08-13 — a contact stored as
 * "+13307276939" is not returned by "3307276939", "(330) 727-6939" or
 * "330-727-6939". Nor is there a suffix match to lean on; CONTAINS_TOKEN only
 * supports a TRAILING wildcard, so the `*<national>` filter this function used
 * to carry never matched anything.
 *
 * That mattered a lot here: FYI's ~36k contacts-with-phone were typed by
 * humans in mixed formats, so matching only E.164 meant a known customer who
 * phoned in became a brand-new duplicate contact. Hence: enumerate.
 */
const phoneVariants = (phone: string): string[] => {
  const digits = phone.replace(/[^\d]/g, '');
  const n = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (n.length !== 10) return [phone]; // international/short — no reliable variants
  const [a, b, c] = [n.slice(0, 3), n.slice(3, 6), n.slice(6)];
  return [
    `+1${n}`, n, `1${n}`, `+1 ${n}`,
    `(${a}) ${b}-${c}`, `(${a})${b}-${c}`, `${a}-${b}-${c}`,
    `${a}.${b}.${c}`, `${a} ${b} ${c}`, `+1 (${a}) ${b}-${c}`,
  ];
};

async function findContact(email?: string, phone?: string): Promise<string | null> {
  if (email) {
    const r = await hs('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['email'], limit: 1,
    });
    if (r.total > 0) return r.results[0].id;
  }
  if (phone) {
    // HubSpot caps a search at 5 filterGroups, so walk the variants in chunks
    // of 5 per property and stop at the first hit. Only runs on a cache miss.
    for (const prop of ['phone', 'mobilephone']) {
      const variants = phoneVariants(phone);
      for (let i = 0; i < variants.length; i += 5) {
        const r = await hs('POST', '/crm/v3/objects/contacts/search', {
          filterGroups: variants.slice(i, i + 5).map((v) => ({
            filters: [{ propertyName: prop, operator: 'EQ', value: v }],
          })),
          properties: ['phone'], limit: 1,
        });
        if (r.total > 0) return r.results[0].id;
      }
    }
  }
  return null;
}

// lead_source is an enum in the FYI portal; if the configured value isn't in
// the enum the whole write 400s, so retry once without it.
async function createContact(props: Record<string, string>): Promise<string> {
  try {
    return (await hs('POST', '/crm/v3/objects/contacts', { properties: props })).id;
  } catch (err) {
    if (props.lead_source && /lead_source|INVALID_OPTION|not one of the allowed options/i.test(String(err))) {
      const { lead_source: _drop, ...rest } = props;
      return (await hs('POST', '/crm/v3/objects/contacts', { properties: rest })).id;
    }
    throw err;
  }
}

export interface VoiceCallRecord {
  callerName: string;
  callerPhone: string;      // any format; normalized to E.164
  callerEmail?: string;
  summary: string;          // plain text
  inquiryType?: string;
  requestedBroker?: string;
  spanishCaller?: boolean;
  followUpRequired?: boolean;
  conversationId?: string;  // ElevenLabs conversation id, used as a dedupe marker
  transferAttempts?: TransferAttempt[]; // what the transfer tool did, when known
  noteTitle?: string;       // defaults to "AI receptionist call"
  recordingUrl?: string;    // hosted mp3, when the audio webhook already landed
}

/** The existing note for this conversation, if the in-call tool or an earlier
 *  webhook delivery already logged it. Returns the note's id and body so the
 *  later path can APPEND the transfer outcome to it rather than filing a second
 *  note about the same call — one phone call should read as one timeline entry. */
async function findCallNote(
  contactId: string,
  conversationId: string,
): Promise<{ id: string; body: string } | null> {
  try {
    const r = await hs('POST', '/crm/v3/objects/notes/search', {
      filterGroups: [{ filters: [
        { propertyName: 'associations.contact', operator: 'EQ', value: contactId },
        { propertyName: 'hs_note_body', operator: 'CONTAINS_TOKEN', value: conversationId },
      ] }],
      properties: ['hs_note_body'],
      limit: 1,
    });
    if (!r.total) return null;
    return { id: r.results[0].id, body: r.results[0].properties?.hs_note_body || '' };
  } catch {
    return null; // search quirks must never block logging
  }
}

/** The play link, as it appears at the top of the note. A note renders HTML, so
 *  unlike the Call body this can be a real anchor rather than a bare URL. */
const recordingLink = (url: string): string =>
  `▶ <a href="${url}">Play recording</a><br><br>`;

/** Put the recording link on the call's NOTE.
 *
 * The note is what a broker actually reads — it is the entry that carries the
 * summary, the transfer outcome and the callback context, and it sits above the
 * Call in the timeline. The audio arrives on its own webhook, usually after the
 * note already exists, so the link has to be added afterwards.
 *
 * Searches by conversation id alone (no contact filter): the audio delivery may
 * not know which contact the transcription path landed on, and the id is unique.
 * No-ops when the link is already there, so a webhook redelivery cannot stack
 * duplicates.
 */
export async function attachRecordingToNote(conversationId: string, recordingUrl: string): Promise<boolean> {
  if (!conversationId || !recordingUrl || !HS_TOKEN) return false;
  try {
    const r = await hs('POST', '/crm/v3/objects/notes/search', {
      filterGroups: [{ filters: [
        { propertyName: 'hs_note_body', operator: 'CONTAINS_TOKEN', value: conversationId },
      ] }],
      properties: ['hs_note_body'],
      limit: 1,
    });
    if (!r.total) return false; // note not written yet — recordVoiceCall will include it
    const note = r.results[0];
    const body: string = note.properties?.hs_note_body || '';
    if (body.includes(recordingUrl)) return true;
    await hs('PATCH', `/crm/v3/objects/notes/${note.id}`, {
      properties: { hs_note_body: (recordingLink(recordingUrl) + body).slice(0, 60000) },
    });
    return true;
  } catch (err) {
    console.error('[voice] note recording link failed:', err);
    return false; // the Call still carries the link; never fail the call log over this
  }
}

/** Upsert contact + note (+ task when owed). Returns the contact id and
 *  whether the note was skipped as an already-logged duplicate. */
export async function recordVoiceCall(rec: VoiceCallRecord): Promise<{ contactId: string; duplicate: boolean }> {
  const phone = e164(rec.callerPhone);
  const email = rec.callerEmail?.trim().toLowerCase() || undefined;
  const [firstname, ...rest] = rec.callerName.trim().split(/\s+/);
  const lastname = rest.join(' ');

  // Idempotency, first line: has this conversation already been written by the
  // other path? This has to come BEFORE the contact lookup, because the lookup
  // is exactly what cannot be trusted here — HubSpot's search index lags object
  // creation by seconds to minutes, and the two write paths are about a minute
  // apart, so the second one reliably failed to see the first one's contact and
  // created a duplicate (plus a duplicate note, task and broker text).
  // Fill in blanks on an existing contact without ever overwriting what is
  // already there. Runs on the deduped path too: the in-call tool often logs
  // before the caller has given a name ("Unknown Caller"), and the post-call
  // webhook arrives later with the name and email the transcript yielded — so
  // bailing out early on a duplicate would throw that away.
  const enrich = async (id: string): Promise<void> => {
    const existing = await hs('GET', `/crm/v3/objects/contacts/${id}?properties=email,phone,firstname,lastname`);
    const p = existing.properties || {};
    const patch: Record<string, string> = {};
    if (!p.phone) patch.phone = phone;
    if (!p.email && email) patch.email = email;
    // "Unknown Caller" is a placeholder, not a name — let a real one replace it.
    const placeholder = /^unknown( caller)?$/i.test(`${p.firstname || ''} ${p.lastname || ''}`.trim());
    if ((!p.firstname || placeholder) && firstname && !/^unknown$/i.test(firstname)) patch.firstname = firstname;
    if ((!p.lastname || placeholder) && lastname && !/^caller$/i.test(lastname)) patch.lastname = lastname;
    if (Object.keys(patch).length) await hs('PATCH', `/crm/v3/objects/contacts/${id}`, { properties: patch });
  };

  if (rec.conversationId) {
    const recorded = await findRecordedContact(rec.conversationId);
    if (recorded) {
      await enrich(recorded).catch((err) => console.error('[voice] enrich on duplicate failed:', err));
      return { contactId: recorded, duplicate: true };
    }
  }

  let contactId = await findContact(email, phone);
  if (contactId) {
    await enrich(contactId);
  } else {
    contactId = await createContact({
      firstname,
      ...(lastname ? { lastname } : {}),
      phone,
      ...(email ? { email } : {}),
      ...(rec.spanishCaller ? { language_preference: 'SPANISH CALLER' } : {}),
      lead_source: 'Phone Call',
      lifecyclestage: 'lead',
    });
  }

  // Claim the conversation before anything with side effects runs. In the
  // ordinary case the two paths are a minute apart and the check above already
  // caught it; this closes the genuine simultaneous race, and hands back the
  // winner's contact so we defer rather than double-write.
  if (rec.conversationId) {
    const owner = await claimConversation(rec.conversationId, contactId, phone);
    if (owner && owner !== contactId) return { contactId: owner, duplicate: true };
  }

  // Second line of defence, and the only one when Supabase is unreachable:
  // notes carry the conversation id. Weaker than the claim above because it
  // depends on the same lagging search index, but it costs one call and covers
  // the case where the idempotency store is down.
  const transfer = renderTransfer(rec.transferAttempts, phone);

  // One note per call. The in-call tool files it BEFORE transferring, so it
  // cannot know the outcome; when the post-call webhook arrives with that
  // outcome we append it to the same note instead of filing a second one.
  const existing = rec.conversationId ? await findCallNote(contactId, rec.conversationId) : null;
  if (existing) {
    if (transfer.html && !existing.body.includes(TRANSFER_MARKER)) {
      await hs('PATCH', `/crm/v3/objects/notes/${existing.id}`, {
        properties: { hs_note_body: (existing.body + transfer.html).slice(0, 60000) },
      });
      if (transfer.flagged) await openCallbackTask(contactId, rec, phone, transfer.lines);
    }
    return { contactId, duplicate: true };
  }

  const esc = (s: string) => s.replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const noteBody =
    // Above the title: the audio is the first thing a broker reaches for, and
    // burying it under the summary is what made it unfindable in the first place.
    (rec.recordingUrl ? recordingLink(rec.recordingUrl) : '') +
    `<strong>${rec.spanishCaller ? 'SPANISH CALLER — ' : ''}${rec.noteTitle || 'AI receptionist call'}</strong><br>` +
    esc(rec.summary) +
    (rec.inquiryType ? `<br><br><em>Inquiry type:</em> ${esc(rec.inquiryType)}` : '') +
    (rec.requestedBroker ? `<br><em>Requested:</em> ${esc(rec.requestedBroker)}` : '') +
    transfer.html +
    (rec.conversationId ? `<br><em>Call ref:</em> ${esc(rec.conversationId)}` : '');
  await hs('POST', '/crm/v3/objects/notes', {
    properties: { hs_note_body: noteBody.slice(0, 60000), hs_timestamp: Date.now().toString() },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_CONTACT }] }],
  });
  if (transfer.flagged) await openCallbackTask(contactId, rec, phone, transfer.lines);

  if (rec.followUpRequired) {
    const due = new Date();
    due.setDate(due.getDate() + (due.getDay() >= 5 ? 8 - due.getDay() : 1)); // next business day
    due.setHours(15, 0, 0, 0);
    await hs('POST', '/crm/v3/objects/tasks', {
      properties: {
        hs_task_subject: `Return call: ${rec.callerName}${rec.requestedBroker ? ` (asked for ${rec.requestedBroker})` : ''}`.slice(0, 200),
        hs_task_body: `${rec.spanishCaller ? 'SPANISH CALLER — ' : ''}${rec.summary}`.slice(0, 2000),
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: 'HIGH',
        hs_timestamp: due.getTime().toString(),
      },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: TASK_TO_CONTACT }] }],
    });
  }

  return { contactId, duplicate: false };
}

// ---- Transfer outcome ------------------------------------------------------
// Written by the post-call webhook, which is the only place that can see what
// the transfer tool actually did. IMPORTANT LIMITATION, recorded here because
// it drives how these notes are worded: on a `sip_refer` transfer our platform
// hands the call to the carrier and the carrier closes our dialog immediately.
// A carrier that accepts the handoff and then drops the caller (observed on
// 2026-08-11 for one destination) is INDISTINGUISHABLE on our side from a
// carrier that connects them. So a transfer is recorded as ATTEMPTED, never as
// "connected" — and when the destination is known-flaky, or the caller was
// somehow transferred to their own number, the note says so loudly and a
// callback task is opened so nobody is silently lost.

/** Destinations known to accept a transfer and then drop the caller. Empty by
 *  default — set VOICE_FLAKY_DESTINATIONS (comma-separated digits) when a
 *  destination is actually confirmed broken. It briefly listed 13053320116
 *  (Ricardo Llorente) on 2026-08-11; that turned out NOT to be a carrier fault
 *  — the transfers were reaching his cell and he was declining them, which
 *  looks identical to a drop from the caller's side. Confirm a destination is
 *  broken with the person who owns the phone before listing it here. */
const FLAKY = (process.env.VOICE_FLAKY_DESTINATIONS ?? '')
  .split(',').map((s) => s.replace(/[^\d]/g, '')).filter(Boolean);

export interface TransferAttempt {
  destination: string;  // digits or sip URI as sent
  who?: string;         // team member name, when the agent named one
  errored: boolean;     // the tool itself returned an error
  errorText?: string;
}

/** Marks a note as already carrying the transfer outcome, so a redelivery of
 *  the same webhook cannot append it twice. */
const TRANSFER_MARKER = 'TRANSFERNOTE';

/** Render the transfer outcome as a section of the call note. Returns the HTML
 *  to append, the plain lines (for a task body), and whether a human needs to
 *  chase the caller. */
function renderTransfer(
  attempts: TransferAttempt[] | undefined,
  callerPhone: string,
): { html: string; lines: string[]; flagged: boolean } {
  if (!attempts?.length) return { html: '', lines: [], flagged: false };

  const callerDigits = callerPhone.replace(/[^\d]/g, '');
  const lines: string[] = [];
  let flagged = false;
  for (const a of attempts) {
    const digits = a.destination.replace(/[^\d]/g, '');
    const label = `${a.who ? `${a.who} — ` : ''}${a.destination}`;
    if (a.errored) {
      flagged = true;
      lines.push(`❌ TRANSFER FAILED → ${label}${a.errorText ? ` (${a.errorText})` : ''} — the caller was NOT connected. Call them back.`);
    } else if (digits && digits === callerDigits) {
      flagged = true;
      lines.push(`⚠️ TRANSFER DROPPED → ${label} — this is the caller's own number, so the call could not connect. Call them back.`);
    } else if (FLAKY.includes(digits)) {
      flagged = true;
      lines.push(`⚠️ TRANSFER LIKELY DROPPED → ${label} — this destination is on the known-broken list. Assume the caller did NOT get through and call them back.`);
    } else {
      lines.push(`↪️ Transfer attempted → ${label}. Handed to the carrier; our platform cannot confirm the caller was connected.`);
    }
  }
  const html =
    `<br><br><strong>Transfer outcome</strong><br>` +
    lines.map((l) => l.replace(/</g, '&lt;')).join('<br>') +
    `<br><em>${TRANSFER_MARKER}</em>`;
  return { html, lines, flagged };
}

/** A dropped caller is time-critical, so this task is due immediately. */
async function openCallbackTask(
  contactId: string,
  rec: VoiceCallRecord,
  phone: string,
  lines: string[],
): Promise<void> {
  await hs('POST', '/crm/v3/objects/tasks', {
    properties: {
      hs_task_subject: `URGENT — call back ${rec.callerName}: AI transfer did not connect`.slice(0, 200),
      hs_task_body: `${lines.join('\n')}\n\nCaller: ${phone}\nCall ref: ${rec.conversationId ?? '—'}`.slice(0, 2000),
      hs_task_status: 'NOT_STARTED',
      hs_task_priority: 'HIGH',
      hs_timestamp: Date.now().toString(),
    },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: TASK_TO_CONTACT }] }],
  }).catch((err) => console.error('[voice] callback task failed:', err));
}
