import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendVerificationCode, verifyCode, verifyMagicLink } from '../../services/authService';
import { Mail, ArrowRight, Shield, Loader2 } from 'lucide-react';
import FYILogo from '../layout/FYILogo';

type Step = 'email' | 'code';

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkSigningIn, setLinkSigningIn] = useState(
    () => new URLSearchParams(window.location.search).has('ml'),
  );

  // Magic-link arrival: /login?ml=<token> from the sign-in email
  // authenticates without typing the code.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('ml');
    if (!token) return;
    verifyMagicLink(token)
      .then(() => {
        navigate('/app', { replace: true });
        window.location.href = '/app';
      })
      .catch((err: any) => {
        setLinkSigningIn(false);
        // Drop the used token from the URL so a retry starts clean.
        window.history.replaceState(null, '', '/login');
        setError(err.message || 'This sign-in link has expired — request a new one.');
      });
  }, [navigate]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email.'); return; }
    setError('');
    setLoading(true);
    try {
      const ch = await sendVerificationCode(email.trim());
      setChallenge(ch);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Failed to send code.');
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Please enter the verification code.'); return; }
    setError('');
    setLoading(true);
    try {
      await verifyCode(email, code.trim(), challenge);
      navigate('/app', { replace: true });
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Invalid code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-yacht-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <FYILogo className="h-14 w-auto mb-4" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">My FYI · Yacht Search Portal</p>
        </div>

        <div className="border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          {linkSigningIn ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-yacht-brand" />
              <p className="mt-4 text-white/80 text-sm">Signing you in…</p>
            </div>
          ) : step === 'email' ? (
            <form onSubmit={handleSendCode}>
              <div className="flex items-center gap-2 mb-6">
                <Mail className="w-5 h-5 text-yacht-brand" />
                <h2 className="text-xl font-light tracking-wide text-white">Sign in with email</h2>
              </div>
              <p className="text-white/60 text-sm mb-6">
                Enter your email address and we'll send you a verification code.
              </p>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border-b border-white/20 bg-transparent py-3 text-sm font-light text-white placeholder:text-white/35 focus:border-yacht-brand focus:outline-none"
                autoFocus
                disabled={loading}
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 bg-yacht-brand py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Send Code</span><ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-yacht-brand" />
                <h2 className="text-xl font-light tracking-wide text-white">Verification code</h2>
              </div>
              <p className="text-white/60 text-sm mb-6">
                We sent a 6-digit code to <span className="text-white">{email}</span>
              </p>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full border-b border-white/20 bg-transparent py-3 text-center font-mono text-2xl tracking-[0.5em] text-white placeholder:text-white/25 focus:border-yacht-brand focus:outline-none"
                autoFocus
                disabled={loading}
                maxLength={6}
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="mt-6 flex w-full items-center justify-center gap-2 bg-yacht-brand py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Verify & Sign In</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="mt-3 w-full py-2 text-[11px] font-light uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white/80"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
