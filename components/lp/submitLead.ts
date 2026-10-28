// Lead submission for the ChatGPT Ads center console landing page.
//
// Goes through /api/contact/broker, the site's lead endpoint: it emails
// sales@ ("[ChatGPT Ads] Inquiry: …") and upserts the HubSpot contact with
// lead_source "ChatGPT Ads". Every step answer, the boat asked about and the
// ad's UTMs are written into the message, which lands as the note on the
// contact's activity — no custom HubSpot properties or form to maintain
// (client, 2026-10-28). Routing to sales@ stays with HubSpot; no owner is set.

import { getAttribution } from '../../utils/attribution';
import { track, trackAdsConversion } from '../../utils/analytics';
import { identifyVisitor } from '../../utils/hubspotTracking';
import { LP_CONTEXT, LP_PATH } from './ccContent';

/** Must match an option of FYI HubSpot's lead_source dropdown. */
export const LEAD_SOURCE = 'ChatGPT Ads';

export interface ListingOfInterest {
  id: string;
  title: string;
  price: string;
  year?: number | undefined;
  make?: string | undefined;
  model?: string | undefined;
  lengthFt?: number | undefined;
  location?: string | undefined;
}

export interface CcLead {
  /** quick: the hero / pop-up contact form. details: the optional step form. */
  kind: 'quick' | 'details';
  name: string;
  email: string;
  phone: string;
  size?: string;
  budget?: string;
  use?: string;
  owns?: string;
  currentBoat?: string;
  message?: string;
  listing?: ListingOfInterest | null | undefined;
}

// Always the canonical host: the lead guard lets fyiyachts.com links through,
// and a preview or localhost URL is no use to a broker anyway.
const listingLine = (l: ListingOfInterest): string =>
  `${l.title}${l.price ? ` — ${l.price}` : ''} — https://fyiyachts.com/listing/${l.id}`;

/** The note a broker reads: one line per answer. */
function composeMessage(lead: CcLead): string {
  const a = getAttribution();
  const utm = (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const)
    .filter((k) => a[k])
    .map((k) => `${k}=${a[k]}`)
    .join(' ');
  const form = lead.kind === 'quick' ? 'contact form' : 'match questions';
  return [
    `${LP_CONTEXT} lead — ${form} (lead source: ${LEAD_SOURCE}, page ${LP_PATH})`,
    lead.size && `Size: ${lead.size}`,
    lead.budget && `Budget: ${lead.budget}`,
    lead.use && `Primary use: ${lead.use}`,
    lead.owns && `Owns a boat: ${lead.owns}${lead.currentBoat ? ` — ${lead.currentBoat}` : ''}`,
    lead.listing && `Listing of interest: ${listingLine(lead.listing)}`,
    utm && `UTM: ${utm}`,
    lead.message && `\nMessage: ${lead.message}`,
  ].filter(Boolean).join('\n');
}

/**
 * OpenAI Ads lead conversion.
 * TODO(openai-pixel): not wired. When the OpenAI Ads pixel is set up, set
 * VITE_OPENAI_PIXEL_ID, paste OpenAI's base snippet (Ads Manager → data
 * source) into this page, and fire its lead event here. Until then leads from
 * this page are identified by lead_source "ChatGPT Ads" and their UTMs.
 */
function trackOpenAiLead(): void {
  if (!import.meta.env.VITE_OPENAI_PIXEL_ID) return;
  // TODO(openai-pixel): fire OpenAI's lead event here.
}

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

/** Phone-link clicks, as their own event (placement: header, form, cta-band…). */
export function trackPhoneClick(placement: string): void {
  track('phone_click', { context: LP_CONTEXT, placement, page_path: LP_PATH });
}

const CONVERTED_KEY = 'fyi_lp_cc_converted';

/**
 * True for the visit's first lead. A visitor who sends the quick form and then
 * the step form is one conversion, not two, in GA4 and the ad platforms.
 */
function firstLeadThisVisit(): boolean {
  try {
    if (sessionStorage.getItem(CONVERTED_KEY)) return false;
    sessionStorage.setItem(CONVERTED_KEY, '1');
  } catch { /* storage unavailable: count it */ }
  return true;
}

/** Every conversion tag, once per visit; follow-up details get their own event. */
function fireConversions(lead: CcLead): void {
  if (firstLeadThisVisit()) {
    track('generate_lead', { context: LP_CONTEXT, page_path: LP_PATH, lead_source: LEAD_SOURCE, form: lead.kind });
    trackAdsConversion(LP_CONTEXT);
    // Meta Lead — fires when a Meta pixel is on the page (none is today).
    try { window.fbq?.('track', 'Lead'); } catch { /* noop */ }
    trackOpenAiLead();
  } else {
    track('lp_lead_details', { context: LP_CONTEXT, form: lead.kind });
  }
  identifyVisitor(lead.email);
}

/** Submit a lead; ok once it has landed somewhere a broker will see it. */
export async function submitCcLead(
  lead: CcLead,
  guard: { company: string; formOpenedAt: number },
): Promise<{ ok: boolean; error?: string }> {
  const l = lead.listing;
  try {
    const res = await fetch('/api/contact/broker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yacht: l
          ? { title: l.title, price: l.price, year: l.year, make: l.make, model: l.model, length: l.lengthFt ? `${l.lengthFt} ft` : undefined, location: l.location }
          : { title: LP_CONTEXT },
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        message: composeMessage(lead),
        attribution: getAttribution(),
        leadSource: LEAD_SOURCE,
        ...guard,
      }),
    });
    if (res.ok) {
      fireConversions(lead);
      return { ok: true };
    }
    // A 4xx says what to fix ("Please enter a valid email address"); a 5xx
    // message is no use to a visitor, so they get the generic line instead.
    const detail = res.status < 500 ? await res.json().catch(() => null) : null;
    return { ok: false, error: typeof detail?.error === 'string' ? detail.error : undefined };
  } catch {
    return { ok: false };
  }
}
