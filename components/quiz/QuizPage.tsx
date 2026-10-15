import { useState } from 'react';
import { Heart, ShieldCheck, Sparkles } from 'lucide-react';
import YachtMatchQuiz from './YachtMatchQuiz';

// Public "Yacht Match Platform" page — the campaign landing for the quiz,
// embeddable from fyiyachts.com (public/quiz-embed.js links here). No login
// required; finishing the quiz OFFERS a portal login (email code) so the
// visitor leaves with an account, market alerts, and a personalized For You.

const GOLD = '#D4AF37';

export default function QuizPage() {
  const [started, setStarted] = useState(false);

  return (
    <div className="min-h-dvh bg-yacht-900 font-sans">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-8">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: GOLD }}>FYI Yachts</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-white sm:text-4xl">
            Your next yacht is <span style={{ color: GOLD }}>already in Miami</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-white/70">
            FYI Yachts built a <strong className="text-white">Yacht Match Platform</strong> that pairs motivated
            buyers with sellers. Rate a few yachts and get paired with the boat of your dreams.
          </p>
        </div>

        {!started ? (
          <div className="grid flex-1 items-center gap-6 lg:grid-cols-2">
            {/* Campaign creative */}
            <img
              src="/quiz-ad1.webp"
              alt="Your next yacht is already in Miami — FYI Yachts Yacht Match Platform"
              className="mx-auto w-full max-w-md rounded-none shadow-2xl"
              style={{ boxShadow: `0 0 0 2px ${GOLD}44, 0 25px 60px rgba(0,0,0,.5)` }}
            />
            <div className="mx-auto w-full max-w-md">
              <ul className="space-y-3 text-[14px] text-white/80">
                <li className="flex items-start gap-3">
                  <Heart className="mt-0.5 h-5 w-5 flex-none" style={{ color: GOLD }} />
                  Thumbs-up the yachts you love — ten quick picks, no forms up front.
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 flex-none" style={{ color: GOLD }} />
                  We match you against FYI’s live inventory <em>and</em> private off-market
                  opportunities that are never publicly listed.
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" style={{ color: GOLD }} />
                  Get a free portal login: market alerts, saved yachts, and matches that
                  sharpen every time you come back.
                </li>
              </ul>
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="mt-6 min-h-[52px] w-full rounded-none px-6 py-3 text-[15px] font-bold text-yacht-900 transition hover:scale-[1.02]"
                style={{ background: GOLD, boxShadow: '0 10px 30px rgba(212,175,55,.35)' }}
              >
                Find my yacht match
              </button>
              <p className="mt-2 text-center text-[11.5px] text-white/40">
                Takes about a minute · no obligation
              </p>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 items-start gap-6 lg:grid-cols-[1fr_auto]">
            {/* Off-market creative rides along on desktop while they rate. */}
            <img
              src="/quiz-ad2.webp"
              alt="Not every yacht opportunity is publicly listed — FYI Yachts off-market matches"
              className="hidden w-full max-w-sm justify-self-center rounded-none opacity-90 lg:block"
            />
            <div className="mx-auto w-full lg:mx-0">
              <YachtMatchQuiz inline />
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-white/30">
          © {new Date().getFullYear()} FYI Yachts · 2550 South Bayshore Drive, Miami, FL · (305) 854-6020
        </p>
      </div>
    </div>
  );
}
