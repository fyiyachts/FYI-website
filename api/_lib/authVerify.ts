import crypto from 'node:crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || '';

const hmacSign = (payload: string): string => {
  return crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
};

export const verifySession = (token: string): { email: string } | null => {
  if (!AUTH_SECRET) return null;
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;
  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (!data || !sig) return null;
  if (hmacSign(data) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (Date.now() > payload.exp) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
};
