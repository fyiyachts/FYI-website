import { fail, ok, methodNotAllowed, parseJsonBody } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { hsRequest } from '../_lib/fyiHubspotLeads.js';
import { getTransporter, isEmailConfigured, getSmtpUser } from '../_lib/email.js';

// POST /api/admin/nudge-lead  { contactId }   (admins only)
//
// The per-lead "Nudge owner" button on the admin FYI Leads page — the FYI
// port of valhalla-yacht-sales' /api/portal/nudge-lead-owner. For a lead
// that's gone stale (no activity in 12h+), pings its HubSpot contact owner
// two ways:
//   1. a HubSpot TASK assigned to the owner, associated to the contact
//      (in-app notification + a to-do in their queue), and
//   2. a direct email via the portal's Gmail SMTP, independent of the
//      owner's HubSpot notification preferences.

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
const PORTAL_ID = '3826631';
const TASK_TO_CONTACT = 204; // HubSpot-defined task→contact association type
export const maxDuration = 30;

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 3_600_000);
}

const esc = (s: string): string =>
  s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireAdmin(req, res)) return;
  if (!HS_TOKEN) return fail(res, 'HubSpot token not configured (HUBSPOT_ACCESS_TOKEN)', 500);

  const { contactId: rawId } = parseJsonBody(req);
  const contactId = (rawId ?? '').toString().trim();
  if (!contactId) return fail(res, 'contactId is required', 400);

  try {
    const contact = await hsRequest(
      HS_TOKEN,
      'GET',
      `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=firstname,lastname,email,phone,hubspot_owner_id,createdate,hs_last_activity_date,boat_of_interest_make_model`
    );
    if (!contact.ok) return fail(res, 'Lead not found', 404);

    const p = contact.json?.properties ?? {};
    const ownerId = (p.hubspot_owner_id ?? '').trim();
    if (!ownerId) return fail(res, 'This lead has no owner to notify — assign it first.', 400);

    const leadName =
      [p.firstname, p.lastname].filter(Boolean).join(' ').trim() || p.email || 'this lead';
    // Staleness clock: time since the last logged activity, else since creation.
    const hours = hoursSince(p.hs_last_activity_date) ?? hoursSince(p.createdate) ?? 0;
    const isUrgent = hours >= 24;
    const contactUrl = `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-1/${contactId}`;

    const owner = await hsRequest(HS_TOKEN, 'GET', `/crm/v3/owners/${encodeURIComponent(ownerId)}`);
    const ownerEmail: string | null = owner.ok ? owner.json?.email ?? null : null;
    const ownerFirst: string = (owner.ok && owner.json?.firstName?.trim()) || 'there';

    const detailLines = [
      `Lead: ${leadName}`,
      p.email ? `Email: ${p.email}` : '',
      p.phone ? `Phone: ${p.phone}` : '',
      p.boat_of_interest_make_model ? `Interested in: ${p.boat_of_interest_make_model}` : '',
      `No activity in ~${hours}h.`,
    ].filter(Boolean);

    // 1) HubSpot task — in-app notification + a to-do in the owner's queue.
    let taskCreated = false;
    try {
      const r = await hsRequest(HS_TOKEN, 'POST', '/crm/v3/objects/tasks', {
        properties: {
          hs_task_subject: `Follow up: ${leadName} — no activity in ${hours}h`,
          hs_task_body: `${detailLines.join('\n')}\n\nReach out and log the contact so this clears.`,
          hs_task_status: 'NOT_STARTED',
          hs_task_priority: isUrgent ? 'HIGH' : 'MEDIUM',
          hs_task_type: 'TODO',
          hs_timestamp: new Date().toISOString(),
          hubspot_owner_id: ownerId,
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: TASK_TO_CONTACT },
            ],
          },
        ],
      });
      taskCreated = r.ok;
    } catch {
      taskCreated = false;
    }

    // 2) Direct email — independent of HubSpot notification preferences.
    let emailSent = false;
    if (ownerEmail && isEmailConfigured()) {
      try {
        const html = [
          `<p>Hi ${esc(ownerFirst)},</p>`,
          `<p>One of your leads has had <strong>no activity in about ${hours} hours</strong>${isUrgent ? ' and may be going cold' : ''}:</p>`,
          '<ul>',
          ...detailLines.slice(0, -1).map((l) => `<li>${esc(l)}</li>`),
          '</ul>',
          `<p><a href="${contactUrl}">Open ${esc(leadName)} in HubSpot →</a></p>`,
          '<p>A task has also been added to your HubSpot queue.</p>',
        ].join('');
        await getTransporter().sendMail({
          from: `"FYI Yachts Portal" <${getSmtpUser()}>`,
          to: ownerEmail,
          subject: `${isUrgent ? '⏰ ' : ''}Lead needs follow-up: ${leadName}`,
          html,
        });
        emailSent = true;
      } catch (err) {
        console.error('[admin/nudge-lead] owner email failed:', err);
      }
    }

    if (!taskCreated && !emailSent) {
      return fail(res, 'Could not notify the owner (task and email both failed).', 502);
    }
    return ok(res, { nudged: true, ownerEmail, hoursStale: hours, taskCreated, emailSent });
  } catch (err) {
    console.error('[admin/nudge-lead] error:', err);
    return fail(res, err);
  }
}
