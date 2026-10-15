import { hsRequest } from '../_lib/fyiHubspotLeads.js';

// Notes classifier cron (every 15 min, vercel.json). Scans FYI HubSpot
// contacts that have notes and stamps two custom properties:
//
//   note_reply_detected  — true when any note on the contact indicates
//                          TWO-WAY communication. Per the team's rule
//                          (2026-07-09): a note counts as engagement unless
//                          it is clearly one-way — "left voicemail",
//                          "no answer", "sent text/email (no reply)" etc.
//   notes_classified_at  — when this contact's notes were last scanned;
//                          contacts with newer note activity get re-scanned.
//
// The Internal Stats "Responded / engaged" metric (api/admin/stats.ts) and
// its drill-down (api/admin/drill.ts) count note_reply_detected=true as
// engaged. Keep the one-way patterns here tuned as the desk's note-taking
// vocabulary evolves.

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
export const maxDuration = 60;

// How many contacts one run may classify (backfill drains at this rate).
const RUN_CAP = 300;
// Re-scan contacts whose notes changed within this window (catches edits/new
// notes on already-classified contacts).
const RESCAN_HOURS = 48;
// At most this many notes per contact are read (newest not guaranteed —
// HubSpot association order — but any qualifying note flips the flag).
const NOTES_PER_CONTACT = 25;

/**
 * One-way markers — outreach that got no response. A note matching these
 * (and nothing conversational) does NOT count as engagement.
 */
const ONE_WAY =
  /\b(left (a |another )?(voice ?-?mail|vm|message|msg)|voice ?-?mail|lvm|l\.v\.m|no answer|didn'?t answer|did ?n[o']t pick ?up|no pick ?up|went (straight )?to (vm|voice ?mail)|mailbox (is )?full|no resp(onse)?|no reply|not responsive|unresponsive|never (answered|responded|replied)|sent (a |an )?(text|sms|email|e-mail|message|msg|brochure|info)|emailed (him|her|them|info|details)|texted (him|her|them)|left word|wrong n[uo]mber|disconnected|line busy|busy signal|no vm set ?up)\b/i;

/**
 * Conversational markers — clear evidence the contact replied or a live
 * conversation happened. Overrides ONE_WAY when both appear ("left VM
 * yesterday, spoke with him today").
 */
const TWO_WAY =
  /\b(spoke (to|with)?|talk(ed)? (to|with)|had a (call|chat|conversation)|on the phone with|he (said|says|wants|asked|told)|she (said|says|wants|asked|told)|they (said|say|want|asked|told)|client (said|says|wants|asked|confirmed)|owner (said|says|wants)|buyer (said|says|wants)|replied|responded|answered|picked up|called (me )?back|call(ed)? back|texted (me )?back|wrote back|emailed (me )?back|got back to (me|us)|heard back|met with|meeting (with|set|scheduled|booked)|met (him|her|them)|showed (him|her|them|the)|showing (set|scheduled|booked)|sea ?trial|survey (set|scheduled|booked)|discussed|told me|asked (me|about|for|if)|interested in|wants to (see|buy|sell|come|schedule|talk)|scheduled (a )?|confirmed|offer (made|accepted|submitted)|under contract|negotiating)\b/i;

const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');

/** Does this note body indicate two-way communication? */
export function noteIndicatesReply(body: string): boolean {
  const text = stripHtml(body).trim();
  if (!text) return false;
  if (TWO_WAY.test(text)) return true;   // explicit conversation wins
  if (ONE_WAY.test(text)) return false;  // voicemail / unanswered outreach
  // No markers either way: a substantive note generally records contact with
  // the person, so it counts — per the rule "any communication counts; just
  // left voicemail does not".
  return true;
}

type Filter = { propertyName: string; operator: string; value?: string };

async function searchContactIds(filters: Filter[], limit: number): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  while (ids.length < limit) {
    const body: Record<string, unknown> = {
      filterGroups: [{ filters }],
      properties: ['createdate'],
      limit: Math.min(100, limit - ids.length),
      sorts: [{ propertyName: 'notes_last_updated', direction: 'DESCENDING' }],
    };
    if (after) body.after = after;
    const r = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/contacts/search', body);
    if (!r.ok) throw new Error(`contacts search failed (${r.status})`);
    for (const c of r.json?.results ?? []) ids.push(c.id);
    after = r.json?.paging?.next?.after;
    if (!after) break;
  }
  return ids;
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function classifyContacts(contactIds: string[]): Promise<{ engaged: number; notEngaged: number }> {
  let engaged = 0;
  let notEngaged = 0;
  const nowIso = new Date().toISOString();

  for (const ids of chunk(contactIds, 100)) {
    // contact → note ids
    const assoc = await hsRequest(HS_TOKEN, 'POST', '/crm/v4/associations/contact/notes/batch/read', {
      inputs: ids.map((id) => ({ id })),
    });
    if (!assoc.ok) throw new Error(`associations read failed (${assoc.status})`);
    const notesByContact = new Map<string, string[]>();
    for (const row of assoc.json?.results ?? []) {
      const from = row?.from?.id?.toString();
      if (!from) continue;
      const noteIds = (row?.to ?? []).map((t: any) => t?.toObjectId?.toString() ?? t?.id?.toString()).filter(Boolean);
      notesByContact.set(from, noteIds.slice(0, NOTES_PER_CONTACT));
    }

    // note bodies
    const allNoteIds = [...new Set([...notesByContact.values()].flat())];
    const bodyById = new Map<string, string>();
    for (const noteChunk of chunk(allNoteIds, 100)) {
      const notes = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/notes/batch/read', {
        properties: ['hs_note_body'],
        inputs: noteChunk.map((id) => ({ id })),
      });
      if (!notes.ok) throw new Error(`notes read failed (${notes.status})`);
      for (const n of notes.json?.results ?? []) {
        bodyById.set(n.id?.toString(), n.properties?.hs_note_body ?? '');
      }
    }

    // classify + stamp
    const updates = ids.map((id) => {
      const noteIds = notesByContact.get(id) ?? [];
      const isEngaged = noteIds.some((nid) => noteIndicatesReply(bodyById.get(nid) ?? ''));
      if (isEngaged) engaged++;
      else notEngaged++;
      return {
        id,
        properties: {
          note_reply_detected: isEngaged ? 'true' : 'false',
          notes_classified_at: nowIso,
        },
      };
    });
    const upd = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/contacts/batch/update', { inputs: updates });
    if (!upd.ok) throw new Error(`contacts update failed (${upd.status})`);
  }

  return { engaged, notEngaged };
}

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!HS_TOKEN) return res.status(500).json({ error: 'HubSpot token not configured' });

  try {
    // Pass 1 — backfill: contacts with notes that were never classified.
    const backlog = await searchContactIds(
      [
        { propertyName: 'num_notes', operator: 'GTE', value: '1' },
        { propertyName: 'notes_classified_at', operator: 'NOT_HAS_PROPERTY' },
      ],
      RUN_CAP
    );

    // Pass 2 — refresh: recent note activity on already-classified contacts
    // (skip any still-false negatives get a second look as notes arrive).
    const rescanSince = new Date(Date.now() - RESCAN_HOURS * 3600_000).toISOString();
    const recent = backlog.length >= RUN_CAP ? [] : await searchContactIds(
      [
        { propertyName: 'num_notes', operator: 'GTE', value: '1' },
        { propertyName: 'notes_last_updated', operator: 'GTE', value: rescanSince },
        { propertyName: 'note_reply_detected', operator: 'EQ', value: 'false' },
      ],
      Math.max(0, RUN_CAP - backlog.length)
    );

    const targets = [...new Set([...backlog, ...recent])];
    if (targets.length === 0) {
      return res.status(200).json({ classified: 0, engaged: 0, notEngaged: 0, backlogDrained: true });
    }

    const { engaged, notEngaged } = await classifyContacts(targets);
    console.log(
      `[classify-notes] classified=${targets.length} engaged=${engaged} notEngaged=${notEngaged} (backfill=${backlog.length}, rescan=${recent.length})`
    );
    return res.status(200).json({ classified: targets.length, engaged, notEngaged });
  } catch (err: any) {
    console.error('[classify-notes] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
