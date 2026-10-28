import { parseJsonBody, fail, ok, methodNotAllowed } from '../_lib/http.js';
import { getTransporter, isEmailConfigured, getSmtpUser } from '../_lib/email.js';
import { parseAttribution, attributionSummary } from '../_lib/attribution.js';
import { recordLeadSizeByEmail } from '../_lib/fyiLeadSize.js';
import { checkLead, clientIp } from '../_lib/leadGuard.js';
import { syncToFyiHubspot } from '../_lib/briannaLead.js';

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';

// Everything below is attacker-controlled text landing in an HTML email the
// sales desk opens. Escape it: the lead guard rejects link markup, but a
// broker's inbox should never be one clever payload away from rendering
// somebody else's HTML.
const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Lead sources a page may claim for itself; anything else is "Website". The
// ChatGPT Ads landing page (/lp/center-consoles) tags its leads so they can be
// counted. Each value must be an option of HubSpot's lead_source dropdown.
const PAGE_LEAD_SOURCES = new Set(['ChatGPT Ads']);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = parseJsonBody(req);
    const { yacht, attribution } = body;
    const leadSource: string = PAGE_LEAD_SOURCES.has(body.leadSource) ? body.leadSource : 'Website';
    if (!yacht?.title) return fail(res, 'Yacht info is required', 400);

    // Bot/spam screen. Runs before any delivery work so junk costs us nothing
    // downstream — no SMTP send, no HubSpot contact. See
    // api/_lib/leadGuard.ts for what each rule catches and why.
    const verdict = await checkLead(req, body);
    if (!verdict.ok) {
      console.warn(`[contact/broker] rejected (${verdict.reason}) ip=${clientIp(req)}`);
      // Honeypot and duplicate hits answer 200 with no delivery: a bot that
      // sees a 400 learns which field to fix, and a visitor who double-clicked
      // should still get the confirmation they expect.
      if (verdict.silent) return ok(res, { sent: true });
      return fail(res, verdict.error || 'Your message could not be submitted.', verdict.status);
    }
    const { name, email, phone, message } = verdict.clean;
    if (!message) return fail(res, 'Name, email, and message are required', 400);
    if (verdict.flags.length) {
      console.log(`[contact/broker] delivering flagged lead: ${verdict.flags.join('; ')}`);
    }

    const attr = parseAttribution(attribution);
    const attrLine = attributionSummary(attr);
    const yachtSpecs = [
      yacht.year && `Year: ${esc(yacht.year)}`,
      yacht.make && `Make: ${esc(yacht.make)}`,
      yacht.model && `Model: ${esc(yacht.model)}`,
      yacht.length && `Length: ${esc(yacht.length)}`,
      yacht.location && `Location: ${esc(yacht.location)}`,
    ].filter(Boolean).join('<br>');

    // The lead passed the guard but tripped one or more soft signals. Say so at
    // the top of the email rather than dropping it — the broker decides.
    const flagBanner = verdict.flags.length
      ? `<div style="background:#fff8e1;border-left:4px solid #D4AF37;padding:12px 16px;margin-bottom:20px;">
           <p style="color:#7a5c00;font-size:12px;margin:0;"><strong>Verify before calling.</strong> ${esc(verdict.flags.join(' · '))}</p>
         </div>`
      : '';

    const html = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
        ${flagBanner}
        <div style="border-bottom: 2px solid #D4AF37; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0A192F; font-size: 22px; margin: 0;">New Yacht Inquiry</h1>
          <p style="color: #666; font-size: 13px; margin-top: 4px;">via FYI Yachts Search Portal</p>
        </div>
        <div style="background: #f8f6f0; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="color: #0A192F; font-size: 18px; margin: 0 0 12px 0;">${esc(yacht.title)}</h2>
          <p style="color: #D4AF37; font-size: 20px; font-weight: bold; margin: 0 0 12px 0;">${esc(yacht.price || 'Price on Request')}</p>
          ${yachtSpecs ? `<p style="color: #555; font-size: 14px; line-height: 1.8; margin: 0;">${yachtSpecs}</p>` : ''}
        </div>
        <div style="margin-bottom: 24px;">
          <h3 style="color: #0A192F; font-size: 16px; margin: 0 0 12px 0;">Contact Information</h3>
          <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong>Name:</strong> ${esc(name)}<br>
            <strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a><br>
            ${phone ? `<strong>Phone:</strong> ${esc(phone)}<br>` : ''}
          </p>
        </div>
        <div style="margin-bottom: 24px;">
          <h3 style="color: #0A192F; font-size: 16px; margin: 0 0 12px 0;">Message</h3>
          <p style="color: #333; font-size: 14px; line-height: 1.6; background: #fafafa; padding: 16px; border-radius: 6px; margin: 0;">${esc(message).replace(/\n/g, '<br>')}</p>
        </div>
        ${attrLine ? `<p style="color: #888; font-size: 12px; margin: 0 0 16px 0;">${esc(attrLine)}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 11px; text-align: center;">&copy; ${new Date().getFullYear()} FYI Yachts</p>
      </div>
    `;

    // Email and HubSpot are independent channels: a lead survives as long as
    // at least one delivers.
    let emailOk = false;
    if (isEmailConfigured()) {
      try {
        await getTransporter().sendMail({
          from: `"FYI Yachts Portal" <${getSmtpUser()}>`,
          to: 'sales@fyiyachts.com',
          replyTo: email,
          subject: `${leadSource === 'Website' ? '' : `[${leadSource}] `}Inquiry: ${yacht.title} — ${yacht.price || 'Price on Request'}`,
          html,
        });
        emailOk = true;
      } catch (err) {
        console.error('[contact/broker] SMTP send failed:', err);
      }
    } else {
      console.error('[contact/broker] SMTP not configured — relying on HubSpot only');
    }

    // Upsert the contact into FYI HubSpot with the inquiry as a note.
    let hubspotOk = false;
    if (HS_TOKEN) {
      try {
        await syncToFyiHubspot(
          {
            name: String(name),
            email: String(email),
            phone: phone ? String(phone) : undefined,
            interest: `Inquiry: ${yacht.title}${yacht.price ? ` — ${yacht.price}` : ''}\n\n${message}`
              .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'),
            attribution: attr,
          },
          { leadSource, noteTitle: leadSource === 'Website' ? 'Website yacht inquiry' : `${leadSource} inquiry` },
        );
        hubspotOk = true;
      } catch (err) {
        console.error('[contact/broker] HubSpot sync failed:', err);
      }
    }

    // Stamp the EXACT length of the inquired listing onto the HubSpot contact
    // (boat_length_of_interest) — the Internal Stats size buckets read it.
    // Best-effort: never blocks or fails the visitor's submission.
    if (HS_TOKEN) {
      const lengthFt = parseFloat(String(yacht.length ?? '').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(lengthFt) && lengthFt >= 20 && lengthFt < 400) {
        await recordLeadSizeByEmail(HS_TOKEN, String(email), lengthFt, {
          firstname: String(name).split(/\s+/)[0],
          lead_source: leadSource,
        }).catch(() => {});
      }
    }

    if (!emailOk && !hubspotOk) return fail(res, 'Inquiry could not be delivered');
    if (!emailOk || !hubspotOk) {
      console.error(`[contact/broker] partial delivery: email=${emailOk} hubspot=${hubspotOk}`);
    }
    return ok(res, { sent: true });
  } catch (err) {
    console.error('[contact/broker] error:', err);
    return fail(res, err);
  }
}
