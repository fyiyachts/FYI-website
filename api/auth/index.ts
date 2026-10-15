import crypto from 'node:crypto';
import { getTransporter, isEmailConfigured, getSmtpUser } from '../_lib/email.js';
import { verifySession } from '../_lib/authVerify.js';
import { recordPortalLogin } from '../_lib/supabaseUsers.js';
import { isValidEmailAddress } from '../_lib/emailAddress.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'fyi-default-secret-change-me';
const CODE_EXPIRY_MS = 15 * 60 * 1000;
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

const hmacSign = (payload: string): string => {
  return crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
};

const generateCode = (): string => crypto.randomInt(100000, 999999).toString();

interface ChallengePayload { email: string; code: string; exp: number; }

const createChallenge = (email: string, code: string): string => {
  const payload: ChallengePayload = { email: email.toLowerCase(), code, exp: Date.now() + CODE_EXPIRY_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${hmacSign(data)}`;
};

// Magic-link token: same HMAC scheme as the code challenge, but verified by
// clicking the link in the email instead of typing the code (the magic
// link function + FYI's 2026-07 ask for link-based portal access). The
// `kind` tag keeps a link token from ever validating as a code challenge.
interface MagicPayload { email: string; exp: number; kind: 'magic'; }

const createMagicToken = (email: string): string => {
  const payload: MagicPayload = { email: email.toLowerCase(), exp: Date.now() + CODE_EXPIRY_MS, kind: 'magic' };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${hmacSign(data)}`;
};

const verifyMagicToken = (token: string): MagicPayload | null => {
  const [data, sig] = token.split('.');
  if (!data || !sig || hmacSign(data) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as MagicPayload;
    if (payload.kind !== 'magic' || Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
};

// Absolute origin for links in email, derived from the proxied request.
const requestOrigin = (req: any): string => {
  const proto = (req.headers?.['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers?.['x-forwarded-host'] as string) || (req.headers?.host as string) || 'fyi-yacht-search.vercel.app';
  return `${proto.split(',')[0]}://${host.split(',')[0]}`;
};

const verifyChallenge = (token: string): ChallengePayload | null => {
  const [data, sig] = token.split('.');
  if (!data || !sig || hmacSign(data) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as ChallengePayload;
    return Date.now() > payload.exp ? null : payload;
  } catch { return null; }
};

const createSessionToken = (email: string): string => {
  const payload = { email: email.toLowerCase(), exp: Date.now() + SESSION_EXPIRY_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${hmacSign(data)}`;
};

const sendCodeEmail = async (email: string, code: string, magicLink: string): Promise<void> => {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"FYI Yachts" <${getSmtpUser()}>`,
    to: email,
    subject: 'Sign in to FYI Yachts',
    html: `
      <div style="font-family: 'Georgia', serif; max-width: 500px; margin: 0 auto; padding: 40px 24px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #0f2740; font-size: 24px; margin: 0;">FYI Yachts</h1>
          <p style="color: #999; font-size: 13px; margin-top: 4px;">Yacht Search Portal</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${magicLink}" style="display: inline-block; background: #cf4537; color: #ffffff; font-size: 15px; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 10px;">Sign in to the portal</a>
        </div>
        <p style="color: #666; font-size: 13px; line-height: 1.5; text-align: center;">One click — no code needed. The button works for 15 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0;" />
        <p style="color: #333; font-size: 14px; line-height: 1.6;">Prefer to type it? Your verification code is:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-family: monospace; font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #0f2740; background: #F0F4F8; padding: 14px 28px; border-radius: 12px; border: 1px solid #4CBBC2;">${code}</span>
        </div>
        <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 28px;">&copy; ${new Date().getFullYear()} FYI Yachts. All rights reserved.</p>
      </div>
    `,
  });
};

const json = (res: any, status: number, body: Record<string, unknown>) => res.status(status).json(body);

const parseBody = (req: any): Record<string, any> => {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const route = typeof req.query?.route === 'string'
    ? req.query.route
    : Array.isArray(req.query?.route) ? req.query.route.join('/') : '';
  const body = parseBody(req);

  switch (route) {
    case 'send-code': {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      // Checking only for an "@" let malformed addresses through to the mail
      // server, which bounced them as 553 "not a valid RFC 5321 address" and
      // surfaced to the visitor as a 500. Validate here so a typo is a 400
      // they can act on.
      if (!isValidEmailAddress(email)) return json(res, 400, { error: 'Please enter a valid email address.' });
      if (!isEmailConfigured()) return json(res, 500, { error: 'Email service is not configured.' });
      const code = generateCode();
      const challenge = createChallenge(email, code);
      const magicLink = `${requestOrigin(req)}/login?ml=${encodeURIComponent(createMagicToken(email))}`;
      try { await sendCodeEmail(email, code, magicLink); }
      catch (err: any) {
        console.error('SMTP error:', err);
        // The mail server refusing the recipient is the visitor's problem to
        // fix (wrong domain, closed mailbox), not an outage — answer 400 with
        // something actionable rather than a blanket 500.
        if (err?.code === 'EENVELOPE' || err?.responseCode === 553 || err?.responseCode === 550) {
          return json(res, 400, {
            error: 'We could not deliver to that address — please check it and try again.',
          });
        }
        return json(res, 500, { error: 'Failed to send verification email.' });
      }
      return json(res, 200, { challenge });
    }

    case 'verify-link': {
      const token = typeof body.token === 'string' ? body.token : '';
      if (!token) return json(res, 400, { error: 'Sign-in link token is required.' });
      const payload = verifyMagicToken(token);
      if (!payload) return json(res, 401, { error: 'This sign-in link has expired — request a new one.' });
      const sessionToken = createSessionToken(payload.email);
      try { await recordPortalLogin(payload.email); }
      catch (err) { console.error('Supabase recordPortalLogin failed:', err); }
      const isSecure = process.env.NODE_ENV !== 'development';
      res.setHeader('Set-Cookie', [
        `fyi_session=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${isSecure ? '; Secure' : ''}`,
      ]);
      return json(res, 200, { email: payload.email });
    }

    case 'verify-code': {
      const challenge = typeof body.challenge === 'string' ? body.challenge : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!challenge || !code) return json(res, 400, { error: 'Challenge and code are required.' });
      const payload = verifyChallenge(challenge);
      if (!payload) return json(res, 401, { error: 'Verification code has expired.' });
      if (payload.code !== code) return json(res, 401, { error: 'Invalid verification code.' });
      const sessionToken = createSessionToken(payload.email);
      // Persist the user (Market Alert Recipients). Never block login on this.
      try { await recordPortalLogin(payload.email); }
      catch (err) { console.error('Supabase recordPortalLogin failed:', err); }
      const isSecure = process.env.NODE_ENV !== 'development';
      res.setHeader('Set-Cookie', [
        `fyi_session=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Strict${isSecure ? '; Secure' : ''}`,
      ]);
      return json(res, 200, { email: payload.email });
    }

    case 'check-session': {
      const cookieHeader = typeof req.headers?.cookie === 'string' ? req.headers.cookie : '';
      const cookieMatch = cookieHeader.match(/(?:^|;\s*)fyi_session=([^;]+)/);
      const token = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
      const result = verifySession(token);
      if (!result) return json(res, 401, { error: 'Session expired.' });
      return json(res, 200, { valid: true, email: result.email });
    }

    case 'sign-out': {
      res.setHeader('Set-Cookie', 'fyi_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
      return json(res, 200, { ok: true });
    }

    default:
      return json(res, 404, { error: 'Not found' });
  }
}
