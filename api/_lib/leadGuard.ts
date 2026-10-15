import { isValidEmailAddress } from './emailAddress.js';

// Spam/bot defenses for the public lead endpoints.
//
// Two entry points, sharing one core:
//   checkLead(req, input)       /api/contact/broker — name + email + message
//   checkSubscribe(req, input)  /api/alerts/subscribe — email only
//
// They face different threats and are tuned separately; see checkSubscribe for
// why the alerts endpoint counts DISTINCT emails per IP rather than requests.
//
// Why this exists: over the weekend of 2026-09-06 the sales desk was buried in
// submissions like `Name: e / Phone: e / Email: PtPFo61T`. A value with no `@`
// in it cannot come from the site's own forms — every one of them marks the
// field `required type="email"`, and the browser refuses to submit. So the junk
// was POSTed straight at `/api/contact/broker`, which until now accepted any
// body where name/email/message were merely non-empty strings.
//
// The layers below, cheapest first:
//   1. honeypot         — a field humans never see; filled => silently dropped
//   2. submit timing    — a form filled in under two seconds is not a person
//   3. field validation — real email syntax, a name that contains letters,
//                         no link payloads, no throwaway inboxes
//   4. rate limiting    — per IP and per email, so one script can't flood
//   5. duplicate window — the same message twice in ten minutes is one lead
//
// Design rule: this path is revenue. A rejected real buyer costs far more than
// an accepted bot, so only structurally impossible submissions are refused.
// Everything merely *suspicious* comes back as a flag that rides along to the
// sales desk, and the lead is still delivered.

export interface LeadGuardInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  /** Honeypot. Rendered off-screen and aria-hidden; only bots fill it. */
  company?: unknown;
  /** Epoch ms captured when the form first rendered (see utils/formGuard.ts). */
  formOpenedAt?: unknown;
}

export interface LeadGuardVerdict {
  /** True when the submission should be delivered. */
  ok: boolean;
  /** HTTP status to answer with when `ok` is false. */
  status: number;
  /** Visitor-facing text for a rejection. */
  error?: string;
  /** Log-facing reason — never shown to the submitter. */
  reason?: string;
  /**
   * Answer 200 without delivering. Used for the honeypot and for duplicates so
   * a bot cannot tell a filtered submission from an accepted one and start
   * probing for the rule it tripped.
   */
  silent?: boolean;
  /** Soft signals worth showing the sales desk on an otherwise valid lead. */
  flags: string[];
  /** Cleaned values to deliver in place of the raw ones. */
  clean: { name: string; email: string; phone: string | null; message: string };
}

/* ------------------------------------------------------------- constants */


// Throwaway inboxes. A buyer spending seven figures does not use these, and a
// broker cannot follow up to one. The rejection message tells a human how to
// get through, so a genuine privacy-minded visitor is not lost.
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', 'discard.email', 'dispostable.com', 'fakeinbox.com',
  'getnada.com', 'guerrillamail.com', 'guerrillamail.info', 'mailinator.com',
  'maildrop.cc', 'mailnesia.com', 'mohmal.com', 'sharklasers.com',
  'spam4.me', 'temp-mail.org', 'tempmail.com', 'tempmailo.com',
  'throwawaymail.com', 'trashmail.com', 'yopmail.com', 'yopmail.fr',
]);

// Our own hosts. Links to these in a message are normal ("I'm looking at this
// listing"); links anywhere else are the payload the spam exists to deliver.
const OWN_HOSTS = /(^|\/\/|\.)(?:fyiyachts\.com|boats\.com|yachtworld\.com|boattrader\.com)(\/|$|:)/i;

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const MARKUP_RE = /<\s*a\b|\[url[=\]]|\[link[=\]]|href\s*=/i;

// Tight multi-word phrases only. Single words like "marketing" or "loan" show
// up in legitimate yacht conversations; these strings do not.
const SPAM_PHRASES = [
  'search engine optimi', 'seo services', 'seo expert', 'backlink',
  'guest post', 'link building', 'increase your traffic', 'rank your website',
  'web design services', 'website redesign offer', 'digital marketing agency',
  'crypto investment', 'bitcoin investment', 'forex trading', 'binary option',
  'online casino', 'work from home opportunity', 'sexy girls', 'viagra', 'cialis',
];

const VOWELS = /[aeiouyàáâäãåèéêëìíîïòóôöõùúûüæø]/i;

/** Fastest a human has ever filled a name/email/message form. */
const MIN_FILL_MS = 2_000;
/** Beyond this the timestamp is a stale tab, not evidence — ignore it. */
const MAX_FILL_MS = 12 * 60 * 60 * 1000;

const LEAD_RATE_RULES = [
  { key: 'ip10m', windowSec: 600, max: 4, scope: 'ip' as const },
  { key: 'ip24h', windowSec: 86_400, max: 15, scope: 'ip' as const },
  { key: 'em24h', windowSec: 86_400, max: 6, scope: 'email' as const },
];

// Deliberately looser than the lead rules. A signed-in visitor's saved-boat
// sync (services/alertService.ts) re-POSTs this endpoint every time their
// saved list changes, so six boats saved in a row is six calls carrying the
// SAME email — a tight per-request budget would break the feature for the
// people it is meant to serve. The sharp control is DISTINCT_EMAILS_PER_IP.
const SUBSCRIBE_RATE_RULES = [
  { key: 'sub-ip10m', windowSec: 600, max: 30, scope: 'ip' as const },
  { key: 'sub-ip24h', windowSec: 86_400, max: 120, scope: 'ip' as const },
  { key: 'sub-em24h', windowSec: 86_400, max: 40, scope: 'email' as const },
];

/**
 * How many *different* addresses one IP may subscribe in a day.
 *
 * This is the real defense on the alerts endpoint: bulk-subscribing harvested
 * addresses poisons the KV store, Supabase and FYI's HubSpot contacts, and
 * signs real people up without consent, which costs us sending reputation.
 * Per-email limits do nothing against it — every request carries a new address.
 *
 * Set high on purpose. Carrier-grade NAT can put many real visitors behind one
 * address, and a wrongly blocked subscriber is a lost customer; a poisoning run
 * is hundreds or thousands of addresses, nowhere near this line.
 */
const DISTINCT_EMAILS_PER_IP = 25;

/** Bounds on the arrays the subscribe endpoint writes verbatim into a KV value. */
const MAX_SAVED_ITEMS = 200;
const MAX_BRANDS = 50;

const DUPLICATE_WINDOW_SEC = 600;

/* ------------------------------------------------------------- counters */

// Vercel functions are per-instance, so an in-memory counter only sees a slice
// of the traffic. Upstash KV (already configured for the alerts endpoints) is
// used when present so the limit holds across instances; the map is the
// fallback. Either way a counter failure fails OPEN — losing a real lead to a
// KV outage would be worse than the spam this blocks.
const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

const memHits = new Map<string, number[]>();

function memCount(key: string, windowSec: number): number {
  const now = Date.now();
  const cutoff = now - windowSec * 1000;
  const list = (memHits.get(key) || []).filter((t) => t > cutoff);
  list.push(now);
  memHits.set(key, list);
  if (memHits.size > 5000) memHits.clear();
  return list.length;
}

/** INCR + first-write EXPIRE. Returns the new count, or null if KV is unusable. */
async function kvCount(key: string, windowSec: number): Promise<number | null> {
  if (!KV_URL || !KV_TOKEN) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(windowSec), 'NX']]),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const out = await res.json();
    const n = Number(out?.[0]?.result);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function bump(key: string, windowSec: number): Promise<number> {
  const viaKv = await kvCount(`leadguard:${key}`, windowSec);
  return viaKv ?? memCount(key, windowSec);
}

/* --------------------------------------------------------------- helpers */

/** Caller IP as Vercel reports it (leftmost hop in X-Forwarded-For). */
export function clientIp(req: any): string {
  const raw = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || '';
  return String(raw).split(',')[0].trim() || 'unknown';
}

/** Single-line fields: collapse all whitespace, including newlines. */
function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

/**
 * The message body keeps its line breaks — a buyer listing their requirements
 * one per line should reach the broker that way — but runs of blank lines and
 * horizontal whitespace are flattened.
 */
function multiline(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** Gmail-style normalization so `a.b+tag@gmail.com` shares a counter with `ab@gmail.com`. */
function normalizeEmail(email: string): string {
  const [local, domain = ''] = email.toLowerCase().split('@');
  const bare = local.split('+')[0];
  const isGoogle = domain === 'gmail.com' || domain === 'googlemail.com';
  return `${isGoogle ? bare.replace(/\./g, '') : bare}@${domain}`;
}

function externalLinks(text: string): string[] {
  return (text.match(URL_RE) || []).filter((u) => !OWN_HOSTS.test(u));
}

/** A short djb2 digest — used only to recognize a repeat of the same body. */
function digest(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* --------------------------------------------------- shared screens */

/** Shape common to both guards' verdicts. */
interface GuardDecision {
  ok: boolean;
  status: number;
  error?: string;
  reason?: string;
  silent?: boolean;
  flags: string[];
}

/** Honeypot: real visitors never see this field, so any value is a bot. */
function honeypotFilled(input: { company?: unknown }): boolean {
  return typeof input.company === 'string' && input.company.trim().length > 0;
}

/**
 * Submit timing. Returns a rejection reason, a flag, or neither.
 * A negative elapsed means a skewed client clock, not a bot — ignored.
 */
function screenTiming(raw: unknown): { reject?: string; flag?: string } {
  const openedAt = Number(raw);
  if (!Number.isFinite(openedAt) || openedAt <= 0) {
    // Every first-party form sends this. Its absence means the POST did not
    // come from our JS — on its own only a hint (a cached bundle mid-deploy
    // also lacks it), so flag rather than refuse.
    return { flag: 'no form timing' };
  }
  const elapsed = Date.now() - openedAt;
  if (elapsed >= 0 && elapsed < MIN_FILL_MS) return { reject: `submitted in ${elapsed}ms` };
  if (elapsed > MAX_FILL_MS) return { flag: 'stale form' };
  return {};
}

/** Email syntax + throwaway-inbox screen. Returns a rejection or nothing. */
function screenEmail(email: string): { reason: string; error: string } | null {
  if (!isValidEmailAddress(email)) {
    return {
      reason: `invalid email ${JSON.stringify(email.slice(0, 60))}`,
      error: 'Please enter a valid email address.',
    };
  }
  const domain = email.split('@')[1] || '';
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      reason: `disposable domain ${domain}`,
      error: 'Please use a permanent email address so we can reach you.',
    };
  }
  return null;
}

/**
 * Origin screen. Browsers attach Origin to every cross-site POST and to
 * same-site JSON POSTs, so a mismatched one is somebody else's page posting
 * at us. An absent one only flags — non-browser clients omit it.
 */
function screenOrigin(req: any): { reject?: string; flag?: string } {
  const origin = String(req?.headers?.origin || '');
  if (!origin) return { flag: 'no origin header' };
  const allowed = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:fyiyachts\.com|vercel\.app|localhost(?::\d+)?)$/i;
  return allowed.test(origin) ? {} : { reject: `foreign origin ${origin.slice(0, 100)}` };
}

/** Run a rate-rule table. Returns the first rule breached, or null. */
async function screenRates(
  rules: Array<{ key: string; windowSec: number; max: number; scope: 'ip' | 'email' }>,
  ip: string,
  emailKey: string,
): Promise<{ reason: string } | null> {
  for (const rule of rules) {
    const subject = rule.scope === 'ip' ? ip : emailKey;
    if (subject === 'unknown') continue;
    const count = await bump(`${rule.key}:${subject}`, rule.windowSec);
    if (count > rule.max) {
      return { reason: `rate limit ${rule.key} (${count}/${rule.max}) for ${subject}` };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ main */

/**
 * Decide whether a public lead submission is deliverable.
 *
 * Never throws: any internal failure resolves to a delivering verdict, because
 * dropping a real inquiry is the more expensive mistake.
 */
export async function checkLead(req: any, input: LeadGuardInput): Promise<LeadGuardVerdict> {
  const name = str(input.name, 200);
  const email = str(input.email, 200).toLowerCase();
  const phoneRaw = str(input.phone, 60);
  const message = multiline(input.message, 5000);
  const flags: string[] = [];

  const deliver = (): LeadGuardVerdict => ({
    ok: true,
    status: 200,
    flags,
    clean: { name, email, phone: phoneRaw || null, message },
  });
  const drop = (reason: string, error: string, status = 400): LeadGuardVerdict => ({
    ok: false, status, error, reason, flags,
    clean: { name, email, phone: phoneRaw || null, message },
  });
  const silentDrop = (reason: string): LeadGuardVerdict => ({
    ok: false, status: 200, silent: true, reason, flags,
    clean: { name, email, phone: phoneRaw || null, message },
  });

  try {
    /* 1. honeypot ------------------------------------------------------- */
    if (honeypotFilled(input)) return silentDrop('honeypot filled');

    /* 2. submit timing -------------------------------------------------- */
    const timing = screenTiming(input.formOpenedAt);
    if (timing.reject) return silentDrop(timing.reject);
    if (timing.flag) flags.push(timing.flag);

    /* 3. field validation ----------------------------------------------- */
    if (!name || !email) return drop('missing name/email', 'Please enter your name and email address.');

    const badEmail = screenEmail(email);
    if (badEmail) return drop(badEmail.reason, badEmail.error);

    const letters = (name.match(/\p{L}/gu) || []).length;
    if (letters < 2) {
      return drop(`name has ${letters} letters`, 'Please enter your full name.');
    }
    if (name.includes('@') || URL_RE.test(name) || MARKUP_RE.test(name)) {
      URL_RE.lastIndex = 0;
      return drop('link/address in name', 'Please enter your name as plain text.');
    }
    URL_RE.lastIndex = 0;

    // One token, long, and vowel-free reads as a random string — but real
    // surnames do this too, so it only flags.
    if (!name.includes(' ') && name.length >= 6 && !VOWELS.test(name)) flags.push('name looks random');
    if (!name.includes(' ')) flags.push('single-word name');

    const haystack = `${message} ${phoneRaw}`.toLowerCase();
    const phrase = SPAM_PHRASES.find((p) => haystack.includes(p));
    if (phrase) return drop(`spam phrase ${JSON.stringify(phrase)}`, 'Your message could not be submitted.');

    const links = externalLinks(message);
    if (links.length >= 2 || MARKUP_RE.test(message)) {
      return drop(`${links.length} external link(s) in message`, 'Please submit your inquiry without links.');
    }
    if (links.length === 1) flags.push('external link in message');

    /* phone: never worth refusing a lead over — clean it instead */
    const phoneDigits = phoneRaw.replace(/\D/g, '');
    let phone: string | null = phoneRaw || null;
    if (phoneRaw && phoneDigits.length < 7) {
      flags.push(`unusable phone ${JSON.stringify(phoneRaw.slice(0, 20))} dropped`);
      phone = null;
    }

    /* 4. origin --------------------------------------------------------- */
    const origin = screenOrigin(req);
    if (origin.reject) return drop(origin.reject, 'Your message could not be submitted.', 403);
    if (origin.flag) flags.push(origin.flag);

    /* 5. rate limits ---------------------------------------------------- */
    const ip = clientIp(req);
    const emailKey = normalizeEmail(email);
    const rated = await screenRates(LEAD_RATE_RULES, ip, emailKey);
    if (rated) {
      return drop(
        rated.reason,
        'You have submitted several inquiries already — a broker will be in touch shortly. For anything urgent, call (305) 854-6020.',
        429,
      );
    }

    /* 6. duplicate window ------------------------------------------------ */
    const dupCount = await bump(`dup:${digest(`${emailKey}|${name}|${message}`)}`, DUPLICATE_WINDOW_SEC);
    if (dupCount > 1) return silentDrop('duplicate submission within 10 minutes');

    return { ok: true, status: 200, flags, clean: { name, email, phone, message } };
  } catch (err) {
    // Fail open. A bug in this file must never cost the business a lead.
    console.error('[leadGuard] check failed open:', err);
    return deliver();
  }
}

/* ------------------------------------------------- alerts subscription */

export interface SubscribeGuardInput {
  email?: unknown;
  brands?: unknown;
  savedBoats?: unknown;
  savedSearches?: unknown;
  company?: unknown;
  formOpenedAt?: unknown;
}

export interface SubscribeGuardVerdict extends GuardDecision {
  clean: {
    email: string;
    brands: string[];
    savedBoats: unknown[];
    savedSearches: unknown[];
  };
}

/** Bound a client-supplied array before it is written verbatim into KV. */
function boundedArray(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

/**
 * Decide whether a market-alert subscription is legitimate.
 *
 * The threat here is not a wasted broker call — it is bulk subscription of
 * harvested addresses. Every accepted request writes a KV row, a Supabase row
 * and a HubSpot contact, and signs a real person up for mail they never asked
 * for, which costs FYI sending reputation. So the controls differ from the
 * lead form's:
 *
 *   - DISTINCT emails per IP per day is the sharp limit. Per-email budgets are
 *     useless against poisoning, where every request carries a new address.
 *   - Per-request budgets are loose, because a signed-in visitor's saved-boat
 *     sync legitimately re-POSTs the same address many times a day.
 *   - No name/message/spam-phrase screens: there are no such fields.
 *
 * Never throws; any internal failure resolves to accepting, for the same
 * reason checkLead does.
 */
export async function checkSubscribe(
  req: any,
  input: SubscribeGuardInput,
): Promise<SubscribeGuardVerdict> {
  const email = str(input.email, 200).toLowerCase();
  const flags: string[] = [];
  const clean = {
    email,
    brands: boundedArray(input.brands, MAX_BRANDS).filter(
      (b): b is string => typeof b === 'string' && b.trim().length > 0,
    ).map((b) => b.trim().slice(0, 120)),
    savedBoats: boundedArray(input.savedBoats, MAX_SAVED_ITEMS),
    savedSearches: boundedArray(input.savedSearches, MAX_SAVED_ITEMS),
  };

  const drop = (reason: string, error: string, status = 400): SubscribeGuardVerdict =>
    ({ ok: false, status, error, reason, flags, clean });
  const silentDrop = (reason: string): SubscribeGuardVerdict =>
    ({ ok: false, status: 200, silent: true, reason, flags, clean });

  try {
    if (honeypotFilled(input)) return silentDrop('honeypot filled');

    const timing = screenTiming(input.formOpenedAt);
    if (timing.reject) return silentDrop(timing.reject);
    // The saved-boat sync is not a form and has no timestamp to send, so a
    // missing one is normal on this endpoint and not worth flagging.

    if (!email) return drop('missing email', 'Please enter your email address.');
    const badEmail = screenEmail(email);
    if (badEmail) return drop(badEmail.reason, badEmail.error);

    const origin = screenOrigin(req);
    if (origin.reject) return drop(origin.reject, 'Subscription could not be completed.', 403);
    if (origin.flag) flags.push(origin.flag);

    const ip = clientIp(req);
    const emailKey = normalizeEmail(email);

    const rated = await screenRates(SUBSCRIBE_RATE_RULES, ip, emailKey);
    if (rated) {
      return drop(rated.reason, 'Too many requests — please try again shortly.', 429);
    }

    /* distinct addresses per IP — the actual anti-poisoning control */
    if (ip !== 'unknown') {
      // The (ip, email) pair is counted first. A count of 1 means this IP has
      // not used this address today, so it is a NEW address and only then does
      // the per-IP distinct tally move. Re-subscribing the same address all day
      // never advances it.
      const pairSeen = await bump(`sub-pair:${ip}:${digest(emailKey)}`, 86_400);
      if (pairSeen === 1) {
        const distinct = await bump(`sub-distinct:${ip}`, 86_400);
        if (distinct > DISTINCT_EMAILS_PER_IP) {
          return drop(
            `distinct-email limit (${distinct}/${DISTINCT_EMAILS_PER_IP}) for ${ip}`,
            'Too many requests — please try again shortly.',
            429,
          );
        }
      }
    }

    return { ok: true, status: 200, flags, clean };
  } catch (err) {
    // Fail open, as checkLead does: a bug here must not cost a subscriber.
    console.error('[leadGuard] checkSubscribe failed open:', err);
    return { ok: true, status: 200, flags, clean };
  }
}
