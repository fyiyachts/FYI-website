const AUTH_API = '/api/auth';
const EMAIL_KEY = 'fyi_email';

const postAuth = async (route: string, body: Record<string, unknown>): Promise<any> => {
  const params = new URLSearchParams({ route });
  const response = await fetch(`${AUTH_API}?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
};

export const sendVerificationCode = async (email: string): Promise<string> => {
  const { challenge } = await postAuth('send-code', { email });
  return challenge;
};

export const verifyCode = async (email: string, code: string, challenge: string): Promise<string> => {
  const { email: verifiedEmail } = await postAuth('verify-code', { code, challenge });
  localStorage.setItem(EMAIL_KEY, verifiedEmail);
  return verifiedEmail;
};

/** Sign in by clicking the emailed magic link (?ml= token on /login). */
export const verifyMagicLink = async (token: string): Promise<string> => {
  const { email } = await postAuth('verify-link', { token });
  localStorage.setItem(EMAIL_KEY, email);
  return email;
};

export const checkSession = async (): Promise<string | null> => {
  try {
    const { email } = await postAuth('check-session', {});
    localStorage.setItem(EMAIL_KEY, email);
    return email;
  } catch {
    localStorage.removeItem(EMAIL_KEY);
    return null;
  }
};

export const getStoredEmail = (): string | null => localStorage.getItem(EMAIL_KEY);

export const signOut = async (): Promise<void> => {
  localStorage.removeItem(EMAIL_KEY);
  try { await postAuth('sign-out', {}); } catch { /* ignore */ }
};

export const hasStoredSession = (): boolean => !!localStorage.getItem(EMAIL_KEY);
