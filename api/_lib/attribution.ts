// Server-side handling of the web attribution captured by utils/attribution.ts
// and sent along with every lead submission. Three jobs:
//   - sanitize the client-supplied object (public endpoints — trust nothing),
//   - decide the lead_source tag ("Paid Traffic" / "FB Paid Ads") so paid leads
//     stop hiding under "Website" in FYI's HubSpot,
//   - render the human-readable summary appended to notes/emails/CRM messages.
//
// Only HubSpot-native contact properties (hs_google_click_id,
// hs_facebook_click_id) are written as structured fields — they exist in every
// portal. UTM detail travels in the note/message text so nothing depends on
// custom properties being created in FYI's portal first.

export interface LeadAttribution {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  msclkid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  first_seen?: string;
}

const FIELDS: Array<keyof LeadAttribution> = [
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'referrer', 'landing_page', 'first_seen',
];

/** Sanitize whatever the client sent into a bounded, string-only object. */
export function parseAttribution(raw: unknown): LeadAttribution {
  const out: LeadAttribution = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of FIELDS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  return out;
}

export function isPaidGoogle(a: LeadAttribution): boolean {
  if (a.gclid || a.gbraid || a.wbraid) return true;
  const src = (a.utm_source || '').toLowerCase();
  const med = (a.utm_medium || '').toLowerCase();
  return src.includes('google') && /cpc|ppc|paid/.test(med);
}

export function isPaidMeta(a: LeadAttribution): boolean {
  if (a.fbclid) return true;
  const src = (a.utm_source || '').toLowerCase();
  const med = (a.utm_medium || '').toLowerCase();
  return /facebook|instagram|meta|fb|ig/.test(src) && /cpc|ppc|paid|social/.test(med);
}

/**
 * The lead_source value a NEW contact should get. Paid attribution wins over
 * the channel default ("Website", "Website Chat Bot", …) because the channel
 * is visible elsewhere while the paid origin is otherwise lost — this is the
 * fix for Google Ads leads all landing in HubSpot tagged "Website".
 * Values must exist in FYI's lead_source enumeration.
 */
export function leadSourceFor(a: LeadAttribution, channelDefault: string): string {
  if (isPaidGoogle(a)) return 'Paid Traffic';
  if (isPaidMeta(a)) return 'FB Paid Ads';
  return channelDefault;
}

/** HubSpot-native contact properties for ad click ids. Safe in any portal. */
export function attributionContactProps(a: LeadAttribution): Record<string, string> {
  const props: Record<string, string> = {};
  if (a.gclid) props.hs_google_click_id = a.gclid;
  if (a.fbclid) props.hs_facebook_click_id = a.fbclid;
  return props;
}

/** One plain-text line for CRM messages/emails; empty string when nothing to say. */
export function attributionSummary(a: LeadAttribution): string {
  const bits: string[] = [];
  if (isPaidGoogle(a)) bits.push('Google Ads click');
  else if (isPaidMeta(a)) bits.push('Meta ads click');
  if (a.utm_source) bits.push(`source=${a.utm_source}`);
  if (a.utm_medium) bits.push(`medium=${a.utm_medium}`);
  if (a.utm_campaign) bits.push(`campaign=${a.utm_campaign}`);
  if (a.utm_term) bits.push(`term=${a.utm_term}`);
  if (a.gclid) bits.push(`gclid=${a.gclid}`);
  if (a.fbclid) bits.push(`fbclid=${a.fbclid}`);
  if (a.referrer) bits.push(`referrer=${a.referrer}`);
  if (a.landing_page) bits.push(`landed=${a.landing_page}`);
  if (a.first_seen) bits.push(`first seen ${a.first_seen.slice(0, 10)}`);
  return bits.length ? `Web attribution: ${bits.join(' · ')}` : '';
}
