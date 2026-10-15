import { hsRequest } from '../_lib/fyiHubspotLeads.js';
import { fetchFleet, type FleetBoat } from '../_lib/fyiFleet.js';
import {
  LENGTH_PROP, SIZE_CHECKED_PROP, ensureSizeProps, parseLengthFt,
} from '../_lib/fyiLeadSize.js';

// Lead-size enrichment cron (hourly, vercel.json). Finds recent contacts with
// no boat_length_of_interest and tries to size them from what's already on the
// record, in order of trust:
//
//   1. Fleet match — portal leads (YachtWorld / Boat Trader / Boats.com /
//      Yatco) and many notes reference a specific FYI listing by make/model.
//      Matching the text against the BoatsGroup fleet gives the listing's
//      EXACT LengthOverall — this also handles model numbers that aren't
//      footage ("Sundancer 500" → the 50-footer it actually is).
//   2. Footage parse — the same free-text parser the Internal Stats size
//      buckets use (unit-marked numbers win; bare 25–199 fallback).
//
// Sized or not, the contact gets boat_size_checked_at stamped so it isn't
// re-scanned every run. The Internal Stats size card prefers the numeric
// property over its own text parsing.

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
export const maxDuration = 60;

// Contacts per run (backlog drains at this rate) and how far back to look.
const RUN_CAP = 100;
const WINDOW_DAYS = 90;
const NOTES_PER_CONTACT = 10;

// Free-text properties worth scanning, most intentional first.
const TEXT_PROPS = [
  'boat_of_interest_make_model',
  'boat_make_model__length',
  'what_brand_of_vessel',
  'vessel_make',
  'if_yes_please_provide_the_make_year_length_and_model',
  'if_yes_current_boat_length_make_model_year',
];

const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Exact length via fleet match: the text names one of our listings' make AND
 * model. Ambiguity rule — if matches disagree on footage (beyond rounding),
 * trust nothing and let the footage parser have a go instead.
 */
export function fleetMatchLength(text: string, fleet: FleetBoat[]): number | null {
  const t = text.toLowerCase();
  const lengths = new Set<number>();
  for (const b of fleet) {
    if (!b.make || !b.model || !b.lengthFt) continue;
    const make = b.make.toLowerCase();
    const model = b.model.toLowerCase();
    if (make.length < 3 || model.length < 2) continue;
    if (t.includes(make) && t.includes(model)) lengths.add(Math.round(b.lengthFt));
  }
  if (lengths.size === 1) return [...lengths][0];
  return null;
}

async function searchUnsizedContacts(limit: number): Promise<Array<{ id: string; text: string }>> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const out: Array<{ id: string; text: string }> = [];
  let after: string | undefined;
  while (out.length < limit) {
    const body: Record<string, unknown> = {
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: since },
          { propertyName: LENGTH_PROP, operator: 'NOT_HAS_PROPERTY' },
          { propertyName: SIZE_CHECKED_PROP, operator: 'NOT_HAS_PROPERTY' },
        ],
      }],
      properties: TEXT_PROPS,
      limit: Math.min(100, limit - out.length),
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    };
    if (after) body.after = after;
    const r = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/contacts/search', body);
    if (!r.ok) throw new Error(`contacts search failed (${r.status})`);
    for (const c of r.json?.results ?? []) {
      const p = c.properties ?? {};
      const text = TEXT_PROPS.map((n) => (p[n] ?? '').trim()).filter(Boolean).join(' | ');
      out.push({ id: String(c.id), text });
    }
    after = r.json?.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

/** contactId → concatenated note bodies (only fetched when props yield nothing). */
async function fetchNotesText(contactIds: string[]): Promise<Map<string, string>> {
  const byContact = new Map<string, string>();
  if (contactIds.length === 0) return byContact;
  for (const ids of chunk(contactIds, 100)) {
    const assoc = await hsRequest(HS_TOKEN, 'POST', '/crm/v4/associations/contact/notes/batch/read', {
      inputs: ids.map((id) => ({ id })),
    });
    if (!assoc.ok) throw new Error(`associations read failed (${assoc.status})`);
    const noteIdsByContact = new Map<string, string[]>();
    for (const row of assoc.json?.results ?? []) {
      const from = row?.from?.id?.toString();
      if (!from) continue;
      const noteIds = (row?.to ?? [])
        .map((t: any) => t?.toObjectId?.toString() ?? t?.id?.toString())
        .filter(Boolean);
      noteIdsByContact.set(from, noteIds.slice(0, NOTES_PER_CONTACT));
    }
    const allNoteIds = [...new Set([...noteIdsByContact.values()].flat())];
    const bodyById = new Map<string, string>();
    for (const noteChunk of chunk(allNoteIds, 100)) {
      const notes = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/notes/batch/read', {
        properties: ['hs_note_body'],
        inputs: noteChunk.map((id) => ({ id })),
      });
      if (!notes.ok) throw new Error(`notes read failed (${notes.status})`);
      for (const n of notes.json?.results ?? []) {
        bodyById.set(n.id?.toString(), stripHtml(n.properties?.hs_note_body ?? ''));
      }
    }
    for (const [cid, noteIds] of noteIdsByContact) {
      byContact.set(cid, noteIds.map((nid) => bodyById.get(nid) ?? '').join(' | '));
    }
  }
  return byContact;
}

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!HS_TOKEN) return res.status(500).json({ error: 'HubSpot token not configured' });

  try {
    await ensureSizeProps(HS_TOKEN);
    const contacts = await searchUnsizedContacts(RUN_CAP);
    if (contacts.length === 0) return res.status(200).json({ scanned: 0, sized: 0 });

    let fleet: FleetBoat[] = [];
    try {
      fleet = await fetchFleet();
    } catch (err) {
      console.error('[enrich-lead-sizes] fleet unavailable, footage-parse only:', err);
    }

    const sizeOf = (text: string): number | null =>
      text ? fleetMatchLength(text, fleet) ?? parseLengthFt(text) : null;

    const sized = new Map<string, number>();
    const needNotes: string[] = [];
    for (const c of contacts) {
      const len = sizeOf(c.text);
      if (len != null) sized.set(c.id, len);
      else needNotes.push(c.id);
    }
    const notesText = await fetchNotesText(needNotes);
    for (const id of needNotes) {
      const len = sizeOf(notesText.get(id) ?? '');
      if (len != null) sized.set(id, len);
    }

    const nowMs = Date.now().toString();
    for (const ids of chunk(contacts.map((c) => c.id), 100)) {
      const upd = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/contacts/batch/update', {
        inputs: ids.map((id) => ({
          id,
          properties: {
            [SIZE_CHECKED_PROP]: nowMs,
            ...(sized.has(id) ? { [LENGTH_PROP]: String(sized.get(id)) } : {}),
          },
        })),
      });
      if (!upd.ok) throw new Error(`contacts update failed (${upd.status})`);
    }

    console.log(`[enrich-lead-sizes] scanned=${contacts.length} sized=${sized.size} (fleet=${fleet.length} boats)`);
    return res.status(200).json({ scanned: contacts.length, sized: sized.size });
  } catch (err: any) {
    console.error('[enrich-lead-sizes] error:', err);
    return res.status(500).json({ error: err?.message || 'enrich failed' });
  }
}
