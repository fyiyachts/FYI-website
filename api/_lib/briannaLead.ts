import { getTransporter, isEmailConfigured, getSmtpUser } from './email.js';
import {
  type LeadAttribution, attributionContactProps, attributionSummary, leadSourceFor,
} from './attribution.js';

// Lead capture for the Brianna chatbot, two channels:
//   1. DIRECT write to FYI HubSpot — contact upsert by email with lead_source
//      "Website Chat Bot" + a note holding the visitor's ask.
//   2. SMTP notification to the sales desk.

export interface ChatLead {
  name: string;
  email: string;
  phone?: string;
  interest: string;      // what they're looking for / selling, in Brianna's words
  transcript?: string;   // recent conversation turns for broker context
  brands?: string[];     // builders they showed interest in (e.g. from the quiz)
  budget?: string;       // budget/price range, human-readable
  attribution?: LeadAttribution; // sanitized web attribution (ads/UTMs/referrer)
}

async function emailSalesDesk(lead: ChatLead): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[brianna/lead] SMTP not configured — email skipped');
    return;
  }
  const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <div style="border-bottom: 2px solid #D4AF37; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="color: #0A192F; font-size: 22px; margin: 0;">New Lead from Brianna</h1>
        <p style="color: #666; font-size: 13px; margin-top: 4px;">via the FYI Yachts website chatbot</p>
      </div>
      <div style="margin-bottom: 24px;">
        <p style="color: #333; font-size: 14px; line-height: 1.8; margin: 0;">
          <strong>Name:</strong> ${esc(lead.name)}<br>
          <strong>Email:</strong> <a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a><br>
          ${lead.phone ? `<strong>Phone:</strong> ${esc(lead.phone)}<br>` : ''}
        </p>
      </div>
      <div style="margin-bottom: 24px;">
        <h3 style="color: #0A192F; font-size: 16px; margin: 0 0 12px 0;">What they're interested in</h3>
        <p style="color: #333; font-size: 14px; line-height: 1.6; background: #f8f6f0; padding: 16px; border-radius: 6px; margin: 0;">${esc(lead.interest)}</p>
      </div>
      ${lead.transcript ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #0A192F; font-size: 16px; margin: 0 0 12px 0;">Conversation excerpt</h3>
        <pre style="color: #555; font-size: 12px; line-height: 1.5; background: #fafafa; padding: 16px; border-radius: 6px; margin: 0; white-space: pre-wrap;">${esc(lead.transcript)}</pre>
      </div>` : ''}
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 11px; text-align: center;">&copy; ${new Date().getFullYear()} FYI Yachts</p>
    </div>
  `;
  await getTransporter().sendMail({
    from: `"Brianna — FYI Yachts" <${getSmtpUser()}>`,
    to: 'sales@fyiyachts.com',
    replyTo: lead.email,
    subject: `Chatbot lead: ${lead.name} — ${lead.interest.slice(0, 80)}`,
    html,
  });
}

// ---- Direct FYI HubSpot sync -----------------------------------------------
// Same token the admin stats/leads endpoints use.
const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const HS_BASE = 'https://api.hubapi.com';
const LEAD_SOURCE = 'Website Chat Bot'; // existing lead_source enum value in FYI HubSpot
const NOTE_TO_CONTACT = 202; // HubSpot-defined association typeId: note → contact

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

/**
 * Upsert the visitor as an FYI HubSpot contact and attach their ask as a note.
 * New contacts get lead_source "Website Chat Bot" so the normal FYI intake
 * workflows (broker notification, owner routing) treat them as website leads.
 * Existing contacts are enriched additively — nothing is overwritten.
 */
export async function syncToFyiHubspot(
  lead: ChatLead,
  opts: { leadSource?: string; noteTitle?: string } = {},
): Promise<string> {
  const [firstname, ...rest] = lead.name.trim().split(/\s+/);
  const lastname = rest.join(' ');

  // Paid-ad attribution beats the channel tag: a Google Ads visitor who
  // converts through the chat is a Google Ads lead, not a "Website Chat Bot"
  // lead — this is the fix for paid leads hiding under website sources.
  const attr = lead.attribution || {};
  const leadSource = leadSourceFor(attr, opts.leadSource || LEAD_SOURCE);
  const clickProps = attributionContactProps(attr);

  // Structured interest — written to the fields the Email Health category
  // lists are mined from, so quiz/chat leads auto-tag and grow those lists.
  const brandsStr = lead.brands && lead.brands.length ? [...new Set(lead.brands)].join(', ').slice(0, 250) : '';

  const search = await hs('POST', '/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
    properties: ['email', 'lead_source', 'phone', 'firstname', 'lastname', 'boat_brands_interested', 'budget'],
    limit: 1,
  });

  let contactId: string;
  if (search.total > 0) {
    const existing = search.results[0];
    contactId = existing.id;
    // Additive enrichment: only fill fields the contact doesn't already have.
    const p = existing.properties || {};
    const patch: Record<string, string> = { ...clickProps };
    if (!p.lead_source) patch.lead_source = leadSource;
    if (!p.phone && lead.phone) patch.phone = lead.phone;
    if (!p.firstname && firstname) patch.firstname = firstname;
    if (!p.lastname && lastname) patch.lastname = lastname;
    if (!p.boat_brands_interested && brandsStr) patch.boat_brands_interested = brandsStr;
    if (!p.budget && lead.budget) patch.budget = lead.budget.slice(0, 100);
    if (Object.keys(patch).length) {
      await hs('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties: patch });
    }
  } else {
    const created = await hs('POST', '/crm/v3/objects/contacts', {
      properties: {
        email: lead.email,
        firstname,
        ...(lastname ? { lastname } : {}),
        ...(lead.phone ? { phone: lead.phone } : {}),
        ...(brandsStr ? { boat_brands_interested: brandsStr } : {}),
        ...(lead.budget ? { budget: lead.budget.slice(0, 100) } : {}),
        ...clickProps,
        lead_source: leadSource,
        lifecyclestage: 'lead',
      },
    });
    contactId = created.id;
  }

  // The visitor's ask, as a note on the record (feeds the notes-based
  // reached-out/engaged reporting too).
  const attrLine = attributionSummary(attr);
  const noteBody =
    `<strong>${opts.noteTitle || 'Brianna chatbot lead'}</strong><br>${lead.interest}` +
    (attrLine ? `<br><br><em>${attrLine}</em>` : '') +
    (lead.transcript ? `<br><br><em>Conversation excerpt:</em><br>${lead.transcript.replace(/\n/g, '<br>')}` : '');
  await hs('POST', '/crm/v3/objects/notes', {
    properties: { hs_note_body: noteBody.slice(0, 4000), hs_timestamp: Date.now().toString() },
    associations: [{
      to: { id: contactId },
      types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_CONTACT }],
    }],
  });

  return contactId;
}

/** Deliver the lead everywhere it needs to go. Throws only if EVERY channel failed. */
export async function deliverChatLead(
  lead: ChatLead
): Promise<{ emailed: boolean; hubspotContactId: string | null }> {
  // 1) FYI HubSpot — the channel of record.
  let hubspotContactId: string | null = null;
  if (HS_TOKEN) {
    try {
      hubspotContactId = await syncToFyiHubspot(lead);
      console.log('[brianna/lead] HubSpot contact:', hubspotContactId);
    } catch (err) {
      console.error('[brianna/lead] HubSpot sync failed:', err);
    }
  } else {
    console.warn('[brianna/lead] HUBSPOT_ACCESS_TOKEN not set — HubSpot sync skipped');
  }

  // 2) Sales-desk email.
  let emailed = false;
  try {
    await emailSalesDesk(lead);
    emailed = isEmailConfigured();
  } catch (err) {
    console.error('[brianna/lead] email failed:', err);
  }

  if (!hubspotContactId && !emailed) {
    throw new Error('No lead delivery channel configured');
  }
  return { emailed, hubspotContactId };
}
