// Persisted Yacht Match Quiz results — the bridge between the quiz popup and
// the For You page. Saved to localStorage when a visitor finishes rating the
// deck (whether or not they submit the contact form), so their taste profile
// keeps personalizing recommendations on later visits.

export interface QuizRatingRecord {
  id: string;
  name: string;
  make?: string;
  category?: string;
  priceUsd?: number;
  lengthFt?: number;
  up: boolean;
  reasons: string[];
}

export interface QuizProfile {
  ratings: QuizRatingRecord[];
  matchIds: string[];
  completedAt: string; // ISO
}

const KEY = 'fyi-quiz-profile-v1';

export function saveQuizProfile(profile: QuizProfile): void {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage full/blocked */ }
}

export function getQuizProfile(): QuizProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return Array.isArray(p?.ratings) && p.ratings.length ? (p as QuizProfile) : null;
  } catch {
    return null;
  }
}

// Derived preference windows — same shape the quiz's own matcher uses, so
// For You and the quiz agree on what "a match" means.
export interface QuizTaste {
  pLo: number; pHi: number;
  lLo: number; lHi: number;
  lovedMakes: Set<string>;
  likedMakes: Set<string>;
  blockedMakes: Set<string>;
  categories: Set<string>;
}

export function deriveTaste(profile: QuizProfile): QuizTaste | null {
  const liked = profile.ratings.filter((r) => r.up);
  if (!liked.length) return null;
  const prices = liked.map((r) => r.priceUsd!).filter(Boolean).sort((a, b) => a - b);
  const lengths = liked.map((r) => r.lengthFt!).filter(Boolean).sort((a, b) => a - b);
  let pLo = prices.length ? prices[0] * 0.7 : 0;
  let pHi = prices.length ? prices[prices.length - 1] * 1.25 : Infinity;
  let lLo = lengths.length ? lengths[0] * 0.85 : 0;
  let lHi = lengths.length ? lengths[lengths.length - 1] * 1.15 : Infinity;
  const lovedMakes = new Set<string>();
  const blockedMakes = new Set<string>();

  for (const r of profile.ratings) {
    for (const reason of r.reasons) {
      if (r.up) {
        if (reason === 'In budget' && r.priceUsd) {
          pLo = Math.max(pLo, r.priceUsd * 0.6);
          pHi = Math.min(pHi, r.priceUsd * 1.35);
        }
        if (reason === 'Right size' && r.lengthFt) {
          lLo = Math.max(lLo, r.lengthFt * 0.85);
          lHi = Math.min(lHi, r.lengthFt * 1.2);
        }
        if (reason === 'The brand' && r.make) lovedMakes.add(r.make.toLowerCase());
      } else {
        if (reason === 'Over budget' && r.priceUsd) pHi = Math.min(pHi, r.priceUsd * 0.95);
        if (reason === 'Too big' && r.lengthFt) lHi = Math.min(lHi, r.lengthFt * 0.98);
        if (reason === 'Too small' && r.lengthFt) lLo = Math.max(lLo, r.lengthFt * 1.02);
        if (reason === 'The brand' && r.make) blockedMakes.add(r.make.toLowerCase());
      }
    }
  }
  if (pHi < pLo) pHi = pLo * 1.3;
  if (lHi < lLo) lHi = lLo * 1.2;

  return {
    pLo, pHi, lLo, lHi,
    lovedMakes,
    likedMakes: new Set(liked.map((r) => r.make?.toLowerCase()).filter(Boolean) as string[]),
    blockedMakes,
    categories: new Set(liked.map((r) => r.category).filter(Boolean) as string[]),
  };
}

// Score any boat against the quiz taste. Returns a 0–n score plus
// human-readable reasons; score < 0 means "they explicitly rejected this
// brand — don't recommend it."
export function quizMatchScore(
  taste: QuizTaste,
  boat: { make?: string | null; price?: number | null; length?: number | null; category?: string | null },
): { score: number; reasons: string[] } {
  const make = boat.make?.toLowerCase();
  if (make && taste.blockedMakes.has(make)) return { score: -1, reasons: [] };
  let score = 0;
  const reasons: string[] = [];
  if (boat.price != null && boat.price >= taste.pLo && boat.price <= taste.pHi) {
    score += 25; reasons.push('In your quiz budget');
  }
  if (boat.length != null && boat.length >= taste.lLo && boat.length <= taste.lHi) {
    score += 20; reasons.push('Right size for you');
  }
  if (make && taste.lovedMakes.has(make)) { score += 30; reasons.push('Brand you loved'); }
  else if (make && taste.likedMakes.has(make)) { score += 12; reasons.push('Brand you liked'); }
  if (boat.category && taste.categories.has(boat.category)) score += 8;
  return { score, reasons };
}

export const usdShort = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `$${Math.round(n / 1000)}K`;
