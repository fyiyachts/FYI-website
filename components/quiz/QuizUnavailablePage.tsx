import FYILogo from '../layout/FYILogo';

// Shown at the public /quiz URL while Yacht Match is disabled
// (utils/featureFlags.ts) — fyiyachts.com embeds and past ads still link here,
// so visitors get a branded notice instead of a dead page.
export default function QuizUnavailablePage() {
  return (
    <div className="min-h-screen bg-yacht-900 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <FYILogo className="h-8 w-auto text-white mx-auto mb-6" />
        <h1 className="font-serif text-2xl text-white font-bold mb-3">
          Yacht Match is taking a short break
        </h1>
        <p className="text-white/60 text-sm mb-8">
          Our matchmaking experience is temporarily offline. Our brokers are
          still here to pair you with the right yacht — browse the fleet or
          reach out directly.
        </p>
        <a
          href="https://www.fyiyachts.com"
          className="inline-flex items-center gap-2 bg-yacht-teal hover:bg-yacht-teal/90 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
        >
          Explore FYI Yachts
        </a>
      </div>
    </div>
  );
}
