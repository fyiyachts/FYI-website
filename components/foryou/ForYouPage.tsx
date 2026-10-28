import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getSavedBoats, getRecentlyViewed } from '../../services/storageService';
import { fetchYachtInventory } from '../../services/databaseService';
import { yachtListingToPineconeBoat } from '../../utils/yachtAdapter';
import type { PineconeBoat } from '../../types/search';
import type { SavedBoat } from '../../types/user';
import { formatBoatPrice } from '../../utils/formatters';
import SaveButton from '../saved/SaveButton';
import CompareButton from '../compare/CompareButton';
import { Sparkles, Loader2, MapPin, Ruler, Calendar, Search, ChevronRight, Heart } from 'lucide-react';
import { getQuizProfile, deriveTaste, quizMatchScore, usdShort } from '../quiz/quizProfile';
import { OPEN_QUIZ_EVENT } from '../quiz/YachtMatchQuiz';
import { YACHT_MATCH_ENABLED } from '../../utils/featureFlags';
import { boatNameLine, yachtTitle } from '../../utils/boatTitle';
import { optImg } from '../../utils/img';

interface ScoredBoat extends PineconeBoat {
  matchScore: number;
  matchReasons: string[];
}

function computeMatchScore(boat: PineconeBoat, savedBoats: SavedBoat[]): { score: number; reasons: string[] } {
  if (savedBoats.length === 0) return { score: 0, reasons: [] };

  let totalScore = 0;
  let matches = 0;
  const reasons: string[] = [];

  // Collect saved boat characteristics
  const savedMakes = savedBoats.map(b => b.specs.make?.toLowerCase()).filter(Boolean) as string[];
  const savedPrices = savedBoats.map(b => parseFloat(b.price.replace(/[^0-9.]/g, ''))).filter(p => p > 0);
  const savedLengths = savedBoats.map(b => parseFloat(b.specs.length?.replace(/[^0-9.]/g, '') || '')).filter(l => l > 0);
  const savedYears = savedBoats.map(b => parseInt(b.specs.year || '', 10)).filter(y => y > 0);

  // Make match (highest weight)
  if (boat.make && savedMakes.includes(boat.make.toLowerCase())) {
    totalScore += 35;
    matches++;
    reasons.push(`Same make: ${boat.make}`);
  }

  // Price similarity
  if (boat.price && savedPrices.length > 0) {
    const avgPrice = savedPrices.reduce((a, b) => a + b, 0) / savedPrices.length;
    const priceDiff = Math.abs(boat.price - avgPrice) / avgPrice;
    if (priceDiff < 0.15) {
      totalScore += 25;
      matches++;
      reasons.push('Similar price range');
    } else if (priceDiff < 0.35) {
      totalScore += 15;
      matches++;
      reasons.push('Comparable price');
    } else if (priceDiff < 0.6) {
      totalScore += 5;
    }
  }

  // Length similarity
  if (boat.length && savedLengths.length > 0) {
    const avgLength = savedLengths.reduce((a, b) => a + b, 0) / savedLengths.length;
    const lengthDiff = Math.abs(boat.length - avgLength) / avgLength;
    if (lengthDiff < 0.15) {
      totalScore += 20;
      matches++;
      reasons.push('Similar size');
    } else if (lengthDiff < 0.3) {
      totalScore += 10;
      matches++;
      reasons.push('Comparable size');
    }
  }

  // Year similarity
  if (boat.year && savedYears.length > 0) {
    const avgYear = savedYears.reduce((a, b) => a + b, 0) / savedYears.length;
    const yearDiff = Math.abs(boat.year - avgYear);
    if (yearDiff <= 2) {
      totalScore += 15;
      matches++;
      reasons.push('Similar year');
    } else if (yearDiff <= 5) {
      totalScore += 8;
    }
  }

  return { score: Math.min(totalScore, 99), reasons };
}

export default function ForYouPage() {
  const [recommendations, setRecommendations] = useState<ScoredBoat[]>([]);
  const [loading, setLoading] = useState(true);
  const savedBoats = useMemo(() => getSavedBoats(), []);
  const recentlyViewed = useMemo(() => getRecentlyViewed(), []);
  // Yacht Match Quiz taste profile — recorded when a visitor finishes the
  // thumbs-up/down deck. Personalizes this page even with zero saved boats.
  const quizProfile = useMemo(() => getQuizProfile(), []);
  const quizTaste = useMemo(() => (quizProfile ? deriveTaste(quizProfile) : null), [quizProfile]);

  useEffect(() => {
    (async () => {
      try {
        // Fetch boats filtered by makes the user has shown interest in —
        // saved boats first, then brands they liked in the quiz.
        const savedMakes = [...new Set(savedBoats.map(b => b.specs.make).filter(Boolean))] as string[];
        const quizMakes = quizProfile
          ? [...new Set(quizProfile.ratings.filter(r => r.up && r.make).map(r => r.make as string))]
          : [];
        const makes = [...new Set([...savedMakes, ...quizMakes])];
        const savedIds = new Set(savedBoats.map(b => String(b.id)));
        const viewedIds = new Set(recentlyViewed.map(b => String(b.id)));

        let boats: PineconeBoat[] = [];
        // With a quiz profile, always include a broad sweep too — quiz taste
        // scores on budget/size, which brand-only fetches would miss.
        const fetches: Promise<PineconeBoat[]>[] = makes.slice(0, 3).map(make =>
          fetchYachtInventory(1, 40, { make }).then(r => r.items.map(yachtListingToPineconeBoat))
        );
        if (fetches.length === 0 || quizTaste) {
          fetches.push(fetchYachtInventory(1, 100, {}).then(r => r.items.map(yachtListingToPineconeBoat)));
        }
        const results = await Promise.all(fetches);
        const seen = new Set<string>();
        for (const batch of results) {
          for (const b of batch) {
            if (!seen.has(b.documentId)) { seen.add(b.documentId); boats.push(b); }
          }
        }

        // Score and sort by match — saved-boat similarity + quiz taste.
        const scored: ScoredBoat[] = boats
          .filter(b => !savedIds.has(b.documentId) && !viewedIds.has(b.documentId))
          .map(b => {
            const { score, reasons } = computeMatchScore(b, savedBoats);
            let total = score;
            let allReasons = reasons;
            if (quizTaste) {
              const q = quizMatchScore(quizTaste, { make: b.make, price: b.price, length: b.length, category: (b as any).category });
              if (q.score < 0) return null; // brand they explicitly rejected
              total += q.score;
              allReasons = [...q.reasons, ...reasons];
            }
            return { ...b, matchScore: Math.min(total, 99), matchReasons: allReasons };
          })
          .filter((b): b is ScoredBoat => b !== null && b.matchScore > 0)
          .sort((a, b) => b.matchScore - a.matchScore);

        setRecommendations(scored.slice(0, 20));
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [savedBoats, recentlyViewed, quizProfile, quizTaste]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="w-6 h-6 text-yacht-teal" />
          <h1 className="font-serif text-2xl text-white font-bold">For You</h1>
        </div>
        <p className="text-white/50 text-sm ml-9">
          {quizTaste
            ? 'Based on your Yacht Match quiz and saved yachts, we think you’d like these listings.'
            : 'Based on your saved yachts and searches, we think you’d like these listings.'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-yacht-teal animate-spin" />
          <span className="text-white/50 ml-3 text-sm">Finding your matches...</span>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h2 className="text-white text-lg font-medium mb-2">
            {quizTaste && YACHT_MATCH_ENABLED ? 'Tell us more to match you better' : 'Save some yachts first'}
          </h2>
          <p className="text-white/40 text-sm mb-4">
            {YACHT_MATCH_ENABLED
              ? "We'll recommend yachts from your Yacht Match quiz, saved listings, and browsing history."
              : "We'll recommend yachts from your saved listings and browsing history."}
          </p>
          <div className="flex items-center justify-center gap-3">
            {YACHT_MATCH_ENABLED && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_QUIZ_EVENT))}
                className="inline-flex items-center gap-2 bg-yacht-teal hover:bg-yacht-teal/90 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
              >
                <Heart className="w-4 h-4" /> Take the Match Quiz
              </button>
            )}
            <Link
              to="/app/search"
              className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-white/80 font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              <Search className="w-4 h-4" /> Start Searching
            </Link>
          </div>
        </div>
      ) : (
        <>
          {(savedBoats.length > 0 || quizTaste) && (
            <div className="bg-yacht-teal/5 border border-yacht-teal/15 rounded-none p-4 mb-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-yacht-teal/80 text-xs uppercase tracking-wider">Matching based on</p>
                {YACHT_MATCH_ENABLED && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event(OPEN_QUIZ_EVENT))}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-yacht-teal hover:underline"
                  >
                    <Heart className="w-3.5 h-3.5" /> {quizTaste ? 'Retake the Match Quiz' : 'Take the Match Quiz'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {quizTaste && Number.isFinite(quizTaste.pHi) && (
                  <span className="bg-[#D4AF37]/15 text-[#e8cf7a] border border-[#D4AF37]/25 text-xs px-2.5 py-1 rounded-full font-medium">
                    Quiz budget {usdShort(Math.max(quizTaste.pLo, 0))}–{usdShort(quizTaste.pHi)}
                  </span>
                )}
                {quizTaste && Number.isFinite(quizTaste.lHi) && quizTaste.lHi > 0 && (
                  <span className="bg-[#D4AF37]/15 text-[#e8cf7a] border border-[#D4AF37]/25 text-xs px-2.5 py-1 rounded-full font-medium">
                    {Math.round(quizTaste.lLo)}–{Math.round(quizTaste.lHi)} ft
                  </span>
                )}
                {quizTaste && [...quizTaste.lovedMakes, ...quizTaste.likedMakes]
                  .filter((m, i, arr) => arr.indexOf(m) === i)
                  .slice(0, 3)
                  .map(m => (
                    <span key={`qz-${m}`} className="bg-[#D4AF37]/15 text-[#e8cf7a] border border-[#D4AF37]/25 text-xs px-2.5 py-1 rounded-full font-medium capitalize">
                      {m}
                    </span>
                  ))}
                {[...new Set(savedBoats.map(b => b.specs.make).filter(Boolean))].slice(0, 5).map(make => (
                  <span key={make} className="bg-yacht-teal/15 text-yacht-teal border border-yacht-teal/20 text-xs px-2.5 py-1 rounded-full font-medium">
                    {make}
                  </span>
                ))}
                {savedBoats.length > 0 && (
                  <span className="bg-white/5 text-white/40 border border-white/10 text-xs px-2.5 py-1 rounded-full">
                    {savedBoats.length} saved yacht{savedBoats.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recommendations.map(boat => {
              const title = yachtTitle(boat.year, boat.make, boat.model) || boat.boatName || 'Unknown Vessel';
              const nameLine = boatNameLine(boat.boatName, title);
              const imageUrl = boat.images?.[0] || '';
              const location = [boat.location?.city, boat.location?.state].filter(Boolean).join(', ');

              return (
                <div
                  key={boat.id}
                  className="bg-white/5 border border-white/10 rounded-none overflow-hidden hover:border-white/20 transition-all group relative"
                >
                  <Link to={`/app/yacht/${boat.documentId}`} state={{ boat }} className="block relative aspect-[4/3] overflow-hidden">
                    {imageUrl ? (
                      <img src={optImg(imageUrl, 480)} alt={title} width={480} height={360} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <span className="text-white/20 text-sm">No Image</span>
                      </div>
                    )}

                    {/* Match badge */}
                    <div className="absolute top-2 left-2 bg-yacht-teal/90 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {boat.matchScore}% Match
                    </div>

                    <div className="absolute top-2 right-2 flex gap-1">
                      <SaveButton boat={boat} size="sm" />
                      <CompareButton boatId={Number(boat.documentId)} size="sm" />
                    </div>
                  </Link>

                  <Link to={`/app/yacht/${boat.documentId}`} state={{ boat }} className="block p-3">
                    <h3 className={`text-white font-medium text-sm line-clamp-1 ${nameLine ? '' : 'mb-1'}`}>{title}</h3>
                    {nameLine && <p className="mb-1 truncate text-xs font-light italic text-white/50">{nameLine}</p>}
                    <p className="text-yacht-cream font-bold text-lg">
                      {formatBoatPrice(boat)}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-white/40 text-xs">
                      {boat.length && (
                        <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{Math.round(boat.length)}'</span>
                      )}
                      {boat.year && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{boat.year}</span>
                      )}
                      {location && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{location}</span>
                      )}
                    </div>
                    {boat.matchReasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {boat.matchReasons.slice(0, 2).map(r => (
                          <span key={r} className="text-[10px] text-yacht-teal/70 bg-yacht-teal/10 px-1.5 py-0.5 rounded">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/app/search"
              className="inline-flex items-center gap-2 text-yacht-teal hover:text-yacht-teal/80 text-sm font-medium transition-colors"
            >
              Search for more yachts <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
