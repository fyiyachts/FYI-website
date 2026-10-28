// Lead submission for the ChatGPT Ads center console landing page.
//
// Primary path: the HubSpot form "ChatGPT Ads – Center Console" (portal
// 3826631) through the Forms API v3, so the lead lands with lead_source
// "ChatGPT Ads", the step answers and the ad's UTMs on the contact, and the
// HubSpot workflow routes it to sales@ (no owner is set here).
//
// Fallback: /api/contact/broker — the site's existing lead endpoint, which
// emails sales@ and syncs the contact to HubSpot. Used while
// VITE_HUBSPOT_CC_FORM_GUID is unset and whenever the HubSpot submit fails,
// so no lead is ever dropped. The answers and UTMs ride in its message body.

import { getAttribution } from '../../utils/attribution';
import { track, trackAdsConversion } from '../../utils/analytics';
import { identifyVisitor } from '../../utils/hubspotTracking';
import { LP_CONTEXT, LP_PATH } from './ccContent';

const PORTAL = '3826631';
const FORM_GUID = (import.meta.env.VITE_HUBSPOT_CC_FORM_GUID ?? '').trim();
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
  size: string;
  budget: string;
  use: string;
  owns: string;
  currentBoat: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  listing?: ListingOfInterest | null | undefined;
}

/** "Jane van der Berg" → ["Jane", "van der Berg"]; one word → lastname empty. */
export function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  return [parts[0] ?? '', parts.slice(1).join(' ')];
}

const listingLine = (l: ListingOfInterest | null | undefined): string =>
  l ? `${l.title}${l.price ? ` — ${l.price}` : ''} — ${window.location.origin}/listing/${l.id}` : '';

function hutk(): string | undefined {
  const m = /(?:^|;\s*)hubspotutk=([^;]+)/.exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : undefined;
}

async function submitToHubspot(lead: CcLead): Promise<boolean> {
  if (!FORM_GUID) return false;
  const a = getAttribution();
  const [firstname, lastname] = splitName(lead.name);
  const props: Record<string, string | undefined> = {
    firstname,
    lastname,
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    cc_size_range: lead.size,
    cc_budget_range: lead.budget,
    cc_primary_use: lead.use,
    owns_boat: lead.owns,
    current_boat_details: lead.currentBoat,
    listing_of_interest: listingLine(lead.listing),
    lead_source: LEAD_SOURCE,
    utm_source: a.utm_source,
    utm_medium: a.utm_medium,
    utm_campaign: a.utm_campaign,
    utm_content: a.utm_content,
  };
  const context: Record<string, string> = {
    pageUri: window.location.href.slice(0, 1000),
    pageName: document.title || 'Center Console Boats for Sale',
  };
  const tk = hutk();
  if (tk) context.hutk = tk;
  try {
    const res = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL}/${FORM_GUID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: Object.entries(props)
          .filter(([, v]) => v)
          .map(([name, value]) => ({ objectTypeId: '0-1', name, value })),
        context,
      }),
    });
    if (!res.ok) console.warn('[lp] HubSpot submit failed', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    console.warn('[lp] HubSpot submit failed', err);
    return false;
  }
}

async function submitToBroker(lead: CcLead, guard: { company: string; formOpenedAt: number }): Promise<{ ok: boolean; error?: string }> {
  const a = getAttribution();
  const l = lead.listing;
  const lines = [
    `${LP_CONTEXT} lead (lead source: ${LEAD_SOURCE})`,
    `Size: ${lead.size}`,
    `Budget: ${lead.budget}`,
    `Primary use: ${lead.use}`,
    `Owns a boat: ${lead.owns}${lead.currentBoat ? ` — ${lead.currentBoat}` : ''}`,
    l && `Listing of interest: ${listingLine(l)}`,
    `UTM: ${['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((k) => `${k}=${a[k as keyof typeof a] ?? ''}`).join(' ')}`,
    lead.message && `\nMessage: ${lead.message}`,
  ].filter(Boolean);
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
        message: lines.join('\n'),
        attribution: a,
        leadSource: LEAD_SOURCE,
        ...guard,
      }),
    });
    if (res.ok) return { ok: true };
    // A 4xx says what to fix ("Please enter a valid email address"); a 5xx
    // message is no use to a visitor, so they get the generic line instead.
    const detail = res.status < 500 ? await res.json().catch(() => null) : null;
    return { ok: false, error: typeof detail?.error === 'string' ? detail.error : undefined };
  } catch {
    return { ok: false };
  }
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

/** Every conversion tag, once per successful lead. */
function fireConversions(email: string, via: string): void {
  track('generate_lead', { context: LP_CONTEXT, page_path: LP_PATH, lead_source: LEAD_SOURCE, method: via });
  trackAdsConversion(LP_CONTEXT);
  // Meta Lead — fires when a Meta pixel is on the page (none is today).
  try { window.fbq?.('track', 'Lead'); } catch { /* noop */ }
  trackOpenAiLead();
  identifyVisitor(email);
}

/** Submit a lead; true once it has landed somewhere a broker will see it. */
export async function submitCcLead(
  lead: CcLead,
  guard: { company: string; formOpenedAt: number },
): Promise<{ ok: boolean; error?: string }> {
  // A filled honeypot goes to the site endpoint, whose lead guard drops it
  // quietly; HubSpot's form endpoint has no such screen.
  if (!guard.company && await submitToHubspot(lead)) {
    fireConversions(lead.email, 'hubspot');
    return { ok: true };
  }
  const fallback = await submitToBroker(lead, guard);
  if (fallback.ok) fireConversions(lead.email, 'broker');
  return fallback;
}
