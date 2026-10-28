import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Check, Heart, KeyRound, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { saveQuizProfile } from './quizProfile';
import { submitBriannaLead } from '../chat/briannaClient';
import { sendVerificationCode, verifyCode } from '../../services/authService';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';
import { track, trackAdsConversion } from '../../utils/analytics';
import { boatNameLine, yachtTitle } from '../../utils/boatTitle';
import { optImg } from '../../utils/img';
import { formatMoney, listPrice, usdEquivalent } from '../../api/_lib/price';
import { fetchJsonShared } from '../../utils/sharedFetch';

// "Find Your Yacht Match" — a thumbs-up/down quiz over live inventory.
// Rate ~10 boats, we score the rest of the fleet against what you liked and
// show the top matches; the contact step submits to the HubSpot form
// "Find Your Yacht Match Quiz" so the lead lands as a real form submission
// (analytics + workflows + contact-owner notification all apply).

const GOLD = '#D4AF37';
const HUBSPOT_PORTAL = '3826631';
const HUBSPOT_FORM = '17ca77f7-9005-4d61-ad15-a5c301bbcce3';
const HS_SUBMIT = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL}/${HUBSPOT_FORM}`;
const DECK_SIZE = 10;
const DISMISS_KEY = 'fyi-quiz-dismissed-v1';
export const OPEN_QUIZ_EVENT = 'fyi:open-quiz';

interface QuizBoat {
  id: string;
  /** Card title: "{Year} {Make} {Model}". */
  name: string;
  /** The boat's given name, shown as a secondary line. */
  boatName?: string;
  make?: string;
  year?: number;
  lengthFt?: number;
  /** USD-equivalent (NormPrice): budget maths only. */
  priceUsd?: number;
  /** Asking price as shown, in the listing's own currency. */
  priceLabel: string;
  category?: string;
  image?: string;
  location?: string;
}

const usd = (n?: number) =>
  n != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : 'Price on request';

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

function mapBoat(it: any): QuizBoat {
  const img = Array.isArray(it.Images) && it.Images.length
    ? (typeof it.Images[0] === 'string' ? it.Images[0] : it.Images[0]?.Uri || it.Images[0]?.url)
    : undefined;
  const loc = it.BoatLocation || {};
  return {
    id: String(it.DocumentID || ''),
    name: yachtTitle(it.ModelYear, it.MakeString, it.Model) || String(it.BoatName || '').trim() || 'Yacht',
    boatName: boatNameLine(it.BoatName, yachtTitle(it.ModelYear, it.MakeString, it.Model)),
    make: it.MakeString || undefined,
    year: it.ModelYear ? Number(it.ModelYear) : undefined,
    lengthFt: num(it.LengthOverall ?? it.NominalLength),
    priceUsd: usdEquivalent(it),
    priceLabel: formatMoney(listPrice(it)),
    category: it.BoatCategoryCode || undefined,
    image: img,
    location: [loc.BoatCityName !== 'Unknown' ? loc.BoatCityName : null, loc.BoatStateCode || loc.BoatCountryID]
      .filter(Boolean).join(', ') || undefined,
  };
}

// Spread the deck across the price range so the visitor's thumbs actually
// tell us something — 10 random boats from one tier teaches nothing.
function pickDeck(boats: QuizBoat[]): QuizBoat[] {
  const usable = boats.filter((b) => b.image && b.priceUsd);
  const sorted = [...usable].sort((a, b) => (a.priceUsd ?? 0) - (b.priceUsd ?? 0));
  if (sorted.length <= DECK_SIZE) return sorted;
  const deck: QuizBoat[] = [];
  const step = sorted.length / DECK_SIZE;
  for (let i = 0; i < DECK_SIZE; i++) {
    const bucket = sorted.slice(Math.floor(i * step), Math.floor((i + 1) * step));
    deck.push(bucket[Math.floor(bucket.length / 2)]);
  }
  // Shuffle deterministically enough for a quiz (Fisher–Yates on index hash).
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (i * 7919 + 13) % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// One rated boat + the (optional) reasons the visitor tapped.
export interface Rating {
  boat: QuizBoat;
  up: boolean;
  reasons: string[];
}

const LIKE_REASONS = ['Right size', 'In budget', 'Love the style', 'The brand'];
const DISLIKE_REASONS = ['Too big', 'Too small', 'Over budget', 'Not my style', 'The brand'];

// Reasons sharpen the profile: "In budget" tightens the price window around
// that boat, "Too big" caps length at it, a brand dislike excludes the make…
// Without reasons the boat still contributes its general shape, as before.
function scoreMatches(all: QuizBoat[], ratings: Rating[]): QuizBoat[] {
  const liked = ratings.filter((r) => r.up);
  if (!liked.length) return [];
  const dislikedIds = new Set(ratings.filter((r) => !r.up).map((r) => r.boat.id));

  const prices = liked.map((r) => r.boat.priceUsd!).filter(Boolean).sort((a, b) => a - b);
  const lengths = liked.map((r) => r.boat.lengthFt!).filter(Boolean).sort((a, b) => a - b);
  let pLo = prices.length ? prices[0] * 0.7 : 0;
  let pHi = prices.length ? prices[prices.length - 1] * 1.25 : Infinity;
  let lLo = lengths.length ? lengths[0] * 0.85 : 0;
  let lHi = lengths.length ? lengths[lengths.length - 1] * 1.15 : Infinity;
  let priceWeight = 3;
  let lengthWeight = 2;
  let makeWeight = 1.5;
  const lovedMakes = new Set<string>();
  const blockedMakes = new Set<string>();
  const cats = new Set(liked.map((r) => r.boat.category).filter(Boolean));
  let styleWeight = 1;

  for (const r of ratings) {
    const { boat: b, up, reasons } = r;
    for (const reason of reasons) {
      if (up) {
        if (reason === 'In budget' && b.priceUsd) {
          pLo = Math.max(pLo, b.priceUsd * 0.6);
          pHi = Math.min(pHi, b.priceUsd * 1.35);
          priceWeight += 1.5;
        }
        if (reason === 'Right size' && b.lengthFt) {
          lLo = Math.max(lLo, b.lengthFt * 0.85);
          lHi = Math.min(lHi, b.lengthFt * 1.2);
          lengthWeight += 1.5;
        }
        if (reason === 'The brand' && b.make) { lovedMakes.add(b.make); makeWeight += 1; }
        if (reason === 'Love the style') styleWeight += 1;
      } else {
        if (reason === 'Over budget' && b.priceUsd) pHi = Math.min(pHi, b.priceUsd * 0.95);
        if (reason === 'Too big' && b.lengthFt) lHi = Math.min(lHi, b.lengthFt * 0.98);
        if (reason === 'Too small' && b.lengthFt) lLo = Math.max(lLo, b.lengthFt * 1.02);
        if (reason === 'The brand' && b.make) blockedMakes.add(b.make);
      }
    }
  }
  // Reason caps can cross (e.g. one "too big" below a liked size) — keep sane.
  if (pHi < pLo) pHi = pLo * 1.3;
  if (lHi < lLo) lHi = lLo * 1.2;

  const likedMakes = new Set(liked.map((r) => r.boat.make).filter(Boolean));

  return all
    .filter((b) => b.image && !dislikedIds.has(b.id) && !(b.make && blockedMakes.has(b.make)))
    .map((b) => {
      let s = 0;
      if (b.priceUsd != null && b.priceUsd >= pLo && b.priceUsd <= pHi) s += priceWeight;
      if (b.lengthFt != null && b.lengthFt >= lLo && b.lengthFt <= lHi) s += lengthWeight;
      if (b.category && cats.has(b.category)) s += styleWeight;
      if (b.make && lovedMakes.has(b.make)) s += makeWeight;
      else if (b.make && likedMakes.has(b.make)) s += 1;
      if (liked.some((l) => l.boat.id === b.id)) s += 2; // they literally liked it
      return { b, s };
    })
    .sort((x, y) => y.s - x.s)
    .slice(0, 4)
    .map((x) => x.b);
}

type Stage = 'loading' | 'rate' | 'contact' | 'account' | 'done' | 'error';

// Two homes: the default floating popup inside the logged-in portal, and
// `inline` mode — the public /quiz page (embedded from fyiyachts.com), which
// adds an account-creation step after the contact form: we email a login
// code, they verify, and the portal session cookie is set right there.
export default function YachtMatchQuiz({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(inline);
  // Overlay mode must trap scrolling — the page behind the modal scrolling
  // out from under it looked like a "blank blue page" lock-up to FYI.
  useLockBodyScroll(open && !inline);
  const [stage, setStage] = useState<Stage>('loading');
  const [boats, setBoats] = useState<QuizBoat[]>([]);
  const [deck, setDeck] = useState<QuizBoat[]>([]);
  const [idx, setIdx] = useState(0);
  const [ratings, setRatings] = useState<Rating[]>([]);
  // A thumb was tapped; we're showing the optional "what stood out?" chips.
  const [pending, setPending] = useState<{ up: boolean; reasons: string[] } | null>(null);
  const [matches, setMatches] = useState<QuizBoat[]>([]);
  // Contact form
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Account-creation step (inline/public page only).
  const [challenge, setChallenge] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const verifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accountBusy || !challenge) return;
    if (!/^\d{6}$/.test(loginCode.trim())) { setAccountError('Enter the 6-digit code from your email.'); return; }
    setAccountBusy(true);
    setAccountError(null);
    try {
      await verifyCode(email.trim(), loginCode.trim(), challenge);
      // Session cookie is set — enter the portal with the quiz taste already
      // saved locally, so For You is personalized from the first pageview.
      window.location.assign('/for-you');
    } catch (err: any) {
      setAccountError(err?.message || 'That code didn’t match — try again.');
      setAccountBusy(false);
    }
  };

  const load = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    fetchJsonShared<any>('/api/yachts/proxy?rows=200')
      .then((d) => {
        const all = (Array.isArray(d?.results) ? d.results : []).map(mapBoat).filter((b: QuizBoat) => b.id);
        setBoats(all);
        setDeck(pickDeck(all));
        setStage('rate');
      })
      .catch(() => setStage('error'));
  }, []);

  // Open triggers: nav button event, plus one-time auto-open per browser.
  // Inline (public /quiz page) is always open and loads immediately.
  useEffect(() => {
    if (inline) { load(); return; }
    const onOpen = () => { setOpen(true); load(); };
    window.addEventListener(OPEN_QUIZ_EVENT, onOpen);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!localStorage.getItem(DISMISS_KEY)) {
      timer = setTimeout(onOpen, 2500);
    }
    return () => { window.removeEventListener(OPEN_QUIZ_EVENT, onOpen); if (timer) clearTimeout(timer); };
  }, [load, inline]);

  const close = () => {
    if (inline) return; // the page version has nothing to close into
    setOpen(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  // Thumb tap → don't advance yet; offer the optional "what stood out?" chips.
  const rate = useCallback((up: boolean) => {
    if (!deck[idx] || pending) return;
    setPending({ up, reasons: [] });
  }, [deck, idx, pending]);

  const toggleReason = (reason: string) =>
    setPending((p) => p && {
      ...p,
      reasons: p.reasons.includes(reason) ? p.reasons.filter((r) => r !== reason) : [...p.reasons, reason],
    });

  // Commit the rating (with any tapped reasons) and move on.
  const next = useCallback(() => {
    const boat = deck[idx];
    if (!boat || !pending) return;
    const done = [...ratings, { boat, up: pending.up, reasons: pending.reasons }];
    setRatings(done);
    setPending(null);
    if (idx + 1 >= deck.length) {
      const top = scoreMatches(boats, done);
      setMatches(top);
      // Persist the taste profile so the For You page keeps recommending
      // against it — even if they skip the contact form.
      saveQuizProfile({
        ratings: done.map((r) => ({
          id: r.boat.id, name: r.boat.name, make: r.boat.make, category: r.boat.category,
          priceUsd: r.boat.priceUsd, lengthFt: r.boat.lengthFt, up: r.up, reasons: r.reasons,
        })),
        matchIds: top.map((b) => b.id),
        completedAt: new Date().toISOString(),
      });
      setStage('contact');
    } else {
      setIdx(idx + 1);
    }
  }, [deck, idx, pending, ratings, boats]);

  // Keyboard: ← thumbs down, → thumbs up, Enter advances past the reason chips.
  useEffect(() => {
    if (!open || stage !== 'rate') return;
    const onKey = (e: KeyboardEvent) => {
      if (pending) {
        if (e.key === 'Enter') { e.preventDefault(); next(); }
      } else {
        if (e.key === 'ArrowRight') rate(true);
        if (e.key === 'ArrowLeft') rate(false);
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, stage, rate, next, pending]);

  const summary = useMemo(() => {
    const liked = ratings.filter((r) => r.up);
    const withReasons = (r: Rating) =>
      `${r.boat.name} (${r.boat.priceLabel}${r.reasons.length ? `; ${r.reasons.join(', ')}` : ''})`;
    const likeLine = liked.map(withReasons).join('; ') || 'none';
    const passLine = ratings.filter((r) => !r.up && r.reasons.length).map(withReasons).join('; ');
    const matchLine = matches.map((b) => `${b.name} (${b.priceLabel})`).join('; ') || 'none';
    const prices = liked.map((r) => r.boat.priceUsd!).filter(Boolean);
    const lengths = liked.map((r) => r.boat.lengthFt!).filter(Boolean);
    const range = prices.length
      ? `budget ~${usd(Math.min(...prices))}–${usd(Math.max(...prices))}` : 'budget unknown';
    const lens = lengths.length
      ? `length ~${Math.round(Math.min(...lengths))}–${Math.round(Math.max(...lengths))} ft` : '';
    return `Yacht Match Quiz — liked ${liked.length}/${deck.length}: ${likeLine}.` +
      (passLine ? ` Passed on: ${passLine}.` : '') +
      ` Inferred ${range}${lens ? ', ' + lens : ''}. Top matches: ${matchLine}.`;
  }, [ratings, matches, deck.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!first.trim()) { setError('Please enter your first name.'); return; }
    if (!/.+@.+\..+/.test(email.trim())) { setError('Please enter a valid email.'); return; }
    setError(null);
    setSending(true);
    try {
      const res = await fetch(HS_SUBMIT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: [
            { objectTypeId: '0-1', name: 'firstname', value: first.trim() },
            { objectTypeId: '0-1', name: 'lastname', value: last.trim() },
            { objectTypeId: '0-1', name: 'email', value: email.trim() },
            { objectTypeId: '0-1', name: 'phone', value: phone.trim() },
            { objectTypeId: '0-1', name: 'message', value: summary },
          ].filter((f) => f.value),
          context: { pageUri: window.location.href, pageName: 'FYI Portal — Yacht Match Quiz' },
        }),
      });
      if (!res.ok) throw new Error(`HubSpot form submit ${res.status}`);
      // Quiz confirms inline — fire the lead + Ads conversion here (the same
      // send_to the /thank-you page fires).
      track('generate_lead', { context: 'Yacht Match quiz', page_path: window.location.pathname });
      trackAdsConversion('Yacht Match quiz');
      // Also deliver through Brianna's pipeline so the FYI team gets the SMS
      // text (CRM site-inquiry webhook → Twilio), not just the HubSpot form
      // submission. Best-effort — never block or fail the quiz on this.
      // Structured interest → auto-tags boat_brands_interested + budget in
      // HubSpot, feeding the Email Health category lists over time.
      const likedNow = ratings.filter((r) => r.up);
      const likedBrands = [...new Set(likedNow.map((r) => r.boat.make).filter(Boolean) as string[])];
      const likedPrices = likedNow.map((r) => r.boat.priceUsd!).filter(Boolean);
      const budgetStr = likedPrices.length
        ? `${usd(Math.min(...likedPrices))}–${usd(Math.max(...likedPrices))}`
        : undefined;
      submitBriannaLead({
        name: `${first.trim()} ${last.trim()}`.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        interest: summary,
        brands: likedBrands.length ? likedBrands : undefined,
        budget: budgetStr,
      }).catch(() => {});
      localStorage.setItem(DISMISS_KEY, '1');
      if (inline) {
        // Public page: roll straight into portal-account creation — email a
        // login code so their session is live before they leave the page.
        setStage('account');
        try {
          setChallenge(await sendVerificationCode(email.trim()));
        } catch (err) {
          console.error('[quiz] send-code failed:', err);
          setAccountError('We couldn’t email your login code — you can sign in later at the portal login page.');
        }
      } else {
        setStage('done');
      }
    } catch (err) {
      console.error('[quiz] submit failed:', err);
      setError('Couldn’t send just now — please try again, or email sales@fyiyachts.com.');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;
  const boat = deck[idx];
  const field =
    'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-yacht-teal placeholder:text-slate-400';

  const card = (
      <div className={`flex w-full max-w-md flex-col overflow-hidden rounded-none bg-yacht-cream shadow-2xl motion-safe:animate-fade-in-up ${inline ? '' : 'max-h-[92dvh]'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-yacht-900 to-yacht-700 px-4 py-3">
          <Heart className="h-5 w-5 flex-none" style={{ color: GOLD }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-wide text-white">Find Your Yacht Match</p>
            {stage === 'rate' && deck.length > 0 && (
              <p className="text-[11px] text-white/70">Boat {Math.min(idx + 1, deck.length)} of {deck.length} — thumbs up what you love</p>
            )}
          </div>
          {!inline && (
            <button type="button" onClick={close} aria-label="Close quiz" className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {stage === 'loading' && <p className="py-16 text-center text-sm text-slate-400">Loading the fleet…</p>}
          {stage === 'error' && <p className="py-16 text-center text-sm text-slate-500">Couldn’t load inventory — please try again later.</p>}

          {stage === 'rate' && boat && (
            <div key={boat.id} className="motion-safe:animate-fade-in-up">
              <div className="overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm">
                {boat.image ? (
                  <img src={optImg(boat.image, 640)} alt={boat.name} fetchPriority="high" className="h-52 w-full object-cover" />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-yacht-900/5"><Anchor className="h-10 w-10 text-yacht-900/25" /></div>
                )}
                <div className="p-3.5">
                  <p className="text-[15px] font-semibold text-yacht-900">{boat.name}</p>
                  {boat.boatName && <p className="truncate text-[13px] font-light italic text-slate-500">{boat.boatName}</p>}
                  <p className="text-[15px] font-bold" style={{ color: '#9d7413' }}>{boat.priceLabel}</p>
                  <p className="text-[12px] text-slate-500">
                    {[boat.lengthFt ? `${Math.round(boat.lengthFt)} ft` : null, boat.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              {!pending ? (
                <div className="mt-4 flex items-center justify-center gap-6">
                  <button
                    type="button"
                    onClick={() => rate(false)}
                    aria-label="Not for me"
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-slate-500 shadow-sm transition hover:scale-105 hover:border-red-300 hover:text-red-500"
                  >
                    <ThumbsDown className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rate(true)}
                    aria-label="I love it"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-yacht-900 text-white shadow-lg transition hover:scale-105"
                    style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
                  >
                    <ThumbsUp className="h-6 w-6" style={{ color: GOLD }} />
                  </button>
                </div>
              ) : (
                // Optional refinement — tap any that apply, or just Next.
                <div className="mt-4 rounded-none border bg-white p-3 shadow-sm motion-safe:animate-fade-in-up" style={{ borderColor: `${GOLD}66` }}>
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-yacht-900">
                    {pending.up
                      ? <><ThumbsUp className="h-4 w-4" style={{ color: GOLD }} /> What did you like? <span className="font-normal text-slate-400">(optional)</span></>
                      : <><ThumbsDown className="h-4 w-4 text-slate-400" /> What put you off? <span className="font-normal text-slate-400">(optional)</span></>}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(pending.up ? LIKE_REASONS : DISLIKE_REASONS).map((reason) => {
                      const on = pending.reasons.includes(reason);
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => toggleReason(reason)}
                          aria-pressed={on}
                          className={`min-h-[36px] rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                            on
                              ? 'border-yacht-teal bg-yacht-teal/10 text-yacht-teal'
                              : 'border-slate-300 bg-white text-slate-600 hover:border-yacht-teal hover:text-yacht-teal'
                          }`}
                        >
                          {reason}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={next}
                    className="mt-3 min-h-[44px] w-full rounded-lg bg-yacht-900 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-yacht-700"
                  >
                    {idx + 1 >= deck.length ? 'See my matches' : 'Next boat'}
                  </button>
                </div>
              )}
              <div className="mt-3 flex justify-center gap-1" aria-hidden="true">
                {deck.map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= idx ? 'bg-yacht-teal' : 'bg-slate-300'}`} />
                ))}
              </div>
            </div>
          )}

          {stage === 'contact' && (
            <div className="motion-safe:animate-fade-in-up">
              <p className="text-[15px] font-bold text-yacht-900">
                {matches.length ? `We found ${matches.length} yachts that fit your taste` : 'Let a broker curate your matches'}
              </p>
              {matches.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {matches.map((b) => (
                    <Link key={b.id} to={`/yacht/${b.id}`} onClick={close} className="group overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm transition hover:border-yacht-teal">
                      {b.image && <img src={optImg(b.image, 320)} alt={b.name} loading="lazy" className="h-20 w-full object-cover" />}
                      <div className="p-2">
                        <p className="truncate text-[11.5px] font-semibold text-yacht-900 group-hover:text-yacht-teal">{b.name}</p>
                        {b.boatName && <p className="truncate text-[10.5px] font-light italic text-slate-500">{b.boatName}</p>}
                        <p className="text-[11.5px] font-bold" style={{ color: '#9d7413' }}>{b.priceLabel}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <form onSubmit={submit} className="mt-4 rounded-none border bg-white p-3 shadow-sm" style={{ borderColor: `${GOLD}66` }}>
                <p className="text-[12.5px] font-semibold text-yacht-900">Get your matches + new ones as they list</p>
                <p className="mt-0.5 text-[11.5px] text-slate-500">A broker will email your shortlist and keep an eye out for you.</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="qz-first" className="mb-0.5 block text-[11px] font-medium text-slate-500">First name</label>
                    <input id="qz-first" className={field} autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="qz-last" className="mb-0.5 block text-[11px] font-medium text-slate-500">Last name</label>
                    <input id="qz-last" className={field} autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
                  </div>
                </div>
                <div className="mt-2">
                  <label htmlFor="qz-email" className="mb-0.5 block text-[11px] font-medium text-slate-500">Email</label>
                  <input id="qz-email" className={field} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="mt-2">
                  <label htmlFor="qz-phone" className="mb-0.5 block text-[11px] font-medium text-slate-500">
                    Phone <span className="font-normal text-slate-400">— for a faster callback</span>
                  </label>
                  <input id="qz-phone" className={field} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                {error && <p role="alert" className="mt-2 text-[12px] font-medium text-red-600">{error}</p>}
                <button type="submit" disabled={sending} className="mt-2.5 min-h-[44px] w-full rounded-lg bg-yacht-900 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-yacht-700 disabled:opacity-60">
                  {sending ? 'Sending…' : inline ? 'Send my matches + create my login' : 'Send my matches'}
                </button>
                {!inline && (
                  <button type="button" onClick={close} className="mt-1.5 w-full py-1 text-center text-[11.5px] text-slate-400 hover:text-slate-600">
                    No thanks, just browsing
                  </button>
                )}
              </form>
            </div>
          )}

          {stage === 'account' && (
            <div className="py-6 text-center motion-safe:animate-fade-in-up">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${GOLD}1f` }}>
                <KeyRound className="h-6 w-6" style={{ color: '#9d7413' }} />
              </div>
              <p className="text-[15px] font-bold text-yacht-900">Your portal login is one step away</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] text-slate-500">
                We emailed a 6-digit code to <span className="font-semibold text-yacht-900">{email.trim()}</span>.
                Enter it to unlock your FYI portal — market alerts, saved yachts, and matches tuned to this quiz.
              </p>
              <form onSubmit={verifyLogin} className="mx-auto mt-4 max-w-[240px]">
                <label htmlFor="qz-code" className="sr-only">6-digit login code</label>
                <input
                  id="qz-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="min-h-[52px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-[22px] tracking-[0.4em] text-yacht-900 outline-none transition focus:border-yacht-teal placeholder:text-slate-300"
                />
                {accountError && <p role="alert" className="mt-2 text-[12px] font-medium text-red-600">{accountError}</p>}
                <button
                  type="submit"
                  disabled={accountBusy || !challenge}
                  className="mt-3 min-h-[44px] w-full rounded-lg bg-yacht-900 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-yacht-700 disabled:opacity-60"
                >
                  {accountBusy ? 'Unlocking…' : 'Enter the FYI portal'}
                </button>
              </form>
              <button type="button" onClick={() => setStage('done')} className="mt-2 py-1 text-[12px] text-slate-400 hover:text-slate-600">
                Maybe later — my matches are already on the way
              </button>
            </div>
          )}

          {stage === 'done' && (
            <div className="py-10 text-center motion-safe:animate-fade-in-up">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-[15px] font-bold text-yacht-900">You’re all set{first ? `, ${first.trim()}` : ''}!</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] text-slate-500">
                Your matches are on their way, and a broker will reach out with a curated shortlist.
              </p>
              <div className="mt-4 flex flex-col items-center gap-2">
                <Link
                  to={inline ? '/login' : '/for-you'}
                  onClick={close}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-yacht-900 px-6 py-2 text-[13px] font-semibold text-white transition hover:bg-yacht-700"
                >
                  <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
                  {inline ? 'Sign in to the FYI portal' : 'See all your matches in For You'}
                </Link>
                {!inline && (
                  <button type="button" onClick={close} className="py-1 text-[12px] text-slate-400 hover:text-slate-600">
                    Keep browsing
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
  );

  if (inline) return card;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-yacht-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Find your yacht match quiz"
    >
      {card}
    </div>
  );
}
