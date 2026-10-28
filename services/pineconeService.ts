import type { PineconeBoat, PineconeStructuredFilters, SmartQueryIntent } from '../types/search';
import { listPrice, usdEquivalent } from '../api/_lib/price';

function parseLocation(raw: any): PineconeBoat['location'] {
  if (!raw) return {};
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { city: obj.BoatCityName || obj.city, state: obj.BoatStateCode || obj.state, country: obj.BoatCountryID || obj.country };
  } catch { return {}; }
}

function parseImages(raw: any): string[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((img: any) => img?.Uri || img?.url || '').filter(Boolean);
  } catch { return []; }
}

function parseListingDate(meta: Record<string, any>): number | undefined {
  const raw = meta.LastModificationDate || meta.DateCreated || meta.date_created || meta.ListDate || meta.post_date || meta.CreatedDate || meta.listing_date || meta.DateModified || meta.post_modified;
  if (!raw) return undefined;
  const ts = typeof raw === 'number' ? (raw < 1e12 ? raw * 1000 : raw) : new Date(raw).getTime();
  return isNaN(ts) ? undefined : ts;
}

function normalizeMeta(id: string, score: number, meta: Record<string, any>): PineconeBoat {
  return {
    id, score,
    documentId: String(meta.DocumentID || meta.documentId || ''),
    boatName: meta.BoatName || meta.boatName || meta.post_title,
    make: meta.MakeString || meta.make,
    model: meta.Model || meta.model,
    year: meta.ModelYear ? Number(meta.ModelYear) : undefined,
    length: meta.YAP_Length ? Number(meta.YAP_Length) : meta.NominalLength ? Number(meta.NominalLength) / 10 : undefined,
    price: meta.NormPrice ? Number(meta.NormPrice) : meta.YAP_USDVal ? Number(meta.YAP_USDVal) : meta.Price ? Number(meta.Price) : undefined,
    category: meta.BoatCategoryCode,
    classCode: meta.BoatClassCode,
    hullMaterial: meta.BoatHullMaterialCode,
    condition: meta.SaleClassCode || meta.SalesStatus,
    location: parseLocation(meta.BoatLocation),
    engines: meta.Engines || meta.engines,
    companyName: meta.CompanyName || meta.companyName,
    images: parseImages(meta.Images),
    listingUrl: meta._link || undefined,
    listingDate: parseListingDate(meta),
    rawMetadata: meta,
  };
}

const KNOWN_MAKES: Record<string, string> = {
  'leopard': 'Leopard', 'princess': 'Princess', 'burger': 'Burger', 'hatteras': 'Hatteras',
  'sunreef': 'Sunreef', 'carver': 'Carver', 'sanlorenzo': 'Sanlorenzo', 'pardo': 'Pardo Yachts',
  'pardo yachts': 'Pardo Yachts', 'pershing': 'Pershing', 'lazzara': 'Lazzara',
  'cruisers yachts': 'Cruisers Yachts', 'ocean alexander': 'Ocean Alexander',
  'palm beach': 'Palm Beach Motor Yachts', 'riviera': 'Riviera', 'horizon': 'Horizon',
  'aquila': 'Aquila', 'viking': 'Viking', 'vikings': 'Viking', 'lagoon': 'Lagoon',
  'azimut': 'Azimut', 'bertram': 'Bertram', 'boston whaler': 'Boston Whaler',
  'whaler': 'Boston Whaler', 'sea ray': 'Sea Ray', 'searay': 'Sea Ray',
  'sunseeker': 'Sunseeker', 'ferretti': 'Ferretti', 'benetti': 'Benetti',
  'prestige': 'Prestige', 'absolute': 'Absolute', 'sirena': 'Sirena',
  'chris-craft': 'Chris-craft', 'chris craft': 'Chris-craft', 'riva': 'Riva',
  'princess yachts': 'Princess Yachts', 'monte carlo yachts': 'Monte Carlo Yachts',
  'monte carlo': 'Monte Carlo Yachts', 'sabre': 'Sabre', 'hinckley': 'Hinckley',
  'back cove': 'Back Cove', 'tiara': 'Tiara', 'grady-white': 'Grady-White',
  'grady white': 'Grady-White', 'yellowfin': 'Yellowfin', 'regulator': 'Regulator',
  'scout': 'Scout', 'everglades': 'Everglades', 'fountain': 'Fountain',
  'intrepid': 'Intrepid', 'jupiter': 'Jupiter', 'pursuit': 'Pursuit',
  'robalo': 'Robalo', 'contender': 'Contender', 'cigarette': 'Cigarette',
  'cobalt': 'Cobalt', 'formula': 'Formula', 'marquis': 'Marquis',
  'beneteau': 'Beneteau', 'jeanneau': 'Jeanneau', 'catalina': 'Catalina',
  'donzi': 'Donzi', 'wellcraft': 'Wellcraft', 'regal': 'Regal',
  'neptunus': 'Neptunus', 'hampton': 'Hampton', 'marlow': 'Marlow',
  'jarrett bay': 'Jarrett Bay', 'cabo': 'Cabo', 'pearl': 'Pearl',
};

const KNOWN_CLASSES: Record<string, string[]> = {
  'sportfish': ['Sports Fishing Boats', 'Sport Fish', 'Sportfish', 'Sportfisher', 'Sportfishing', 'Saltwater Fishing'],
  'sport fish': ['Sports Fishing Boats', 'Sport Fish', 'Sportfish', 'Sportfisher', 'Sportfishing', 'Saltwater Fishing'],
  'center console': ['Center Consoles', 'Center Console'],
  'motor yacht': ['Motor Yachts', 'Motor Yacht'],
  'sailboat': ['Sail', 'Sailboat', 'Sloop', 'Cutter', 'Ketch', 'Motorsailers'],
  'catamaran': ['Power Catamarans', 'Catamaran'],
  'trawler': ['Trawlers', 'Trawler'],
  'express cruiser': ['Express Cruiser'],
  'flybridge': ['Flybridge', 'Fly Bridge'],
  'convertible': ['Convertible Boats', 'Convertible'],
  'cruiser': ['Cruisers', 'Cruiser'],
  'pilothouse': ['Pilothouse'],
  'mega yacht': ['Mega Yachts', 'Mega Yacht'],
  'sports cruiser': ['Sports Cruiser'],
  'downeast': ['Downeast'],
  'bowrider': ['Bowrider'],
  'walkaround': ['Walkarounds', 'Walkaround', 'Walk Around'],
  'high performance': ['High Performance Boats'],
};

function applyStructuredFilters(boats: PineconeBoat[], f: PineconeStructuredFilters): PineconeBoat[] {
  return boats.filter(b => {
    if (f.minPrice != null && (b.price == null || b.price < f.minPrice)) return false;
    if (f.maxPrice != null && (b.price == null || b.price > f.maxPrice)) return false;
    if (f.minLength != null && (b.length == null || b.length < f.minLength)) return false;
    if (f.maxLength != null && (b.length == null || b.length > f.maxLength)) return false;
    if (f.minYear != null && (b.year == null || b.year < f.minYear)) return false;
    if (f.maxYear != null && (b.year == null || b.year > f.maxYear)) return false;
    if (f.make && !(b.make || '').toLowerCase().includes(f.make.toLowerCase())) return false;
    if (f.state && !(b.location?.state || '').toLowerCase().includes(f.state.toLowerCase())) return false;
    if (f.hullMaterial && !(b.hullMaterial || '').toLowerCase().includes(f.hullMaterial.toLowerCase())) return false;
    if (f.condition && !(b.condition || '').toLowerCase().includes(f.condition.toLowerCase())) return false;
    return true;
  });
}

function matchesBoatClass(boat: PineconeBoat, classKeyword: string): boolean {
  const patterns = KNOWN_CLASSES[classKeyword.toLowerCase()];
  if (!patterns) return false;
  const searchFields = [boat.classCode, boat.model, boat.boatName, boat.rawMetadata?.GeneralBoatDescription?.replace(/<[^>]*>/g, '').slice(0, 500)].filter(Boolean).join(' ').toLowerCase();
  return patterns.some(p => searchFields.includes(p.toLowerCase()));
}

export function parseSmartQuery(raw: string): SmartQueryIntent {
  let q = raw.trim();
  let sortBy: SmartQueryIntent['sortBy'];
  let sortDir: SmartQueryIntent['sortDir'] = 'desc';
  let limit: number | undefined;
  let makeFilter: string | undefined;

  const leadingNum = q.match(/^(\d+)\s+/);
  if (leadingNum) { limit = parseInt(leadingNum[1], 10); q = q.slice(leadingNum[0].length); }

  if (/\b(largest|biggest|longest)\b/i.test(q)) { sortBy = 'length'; sortDir = 'desc'; q = q.replace(/\b(largest|biggest|longest)\b/i, '').trim(); }
  else if (/\b(smallest|shortest)\b/i.test(q)) { sortBy = 'length'; sortDir = 'asc'; q = q.replace(/\b(smallest|shortest)\b/i, '').trim(); }
  else if (/\b(cheapest|lowest[- ]?priced?|most[- ]?affordable)\b/i.test(q)) { sortBy = 'price'; sortDir = 'asc'; q = q.replace(/\b(cheapest|lowest[- ]?priced?|most[- ]?affordable)\b/i, '').trim(); }
  else if (/\b(most[- ]?expensive|priciest|highest[- ]?priced?)\b/i.test(q)) { sortBy = 'price'; sortDir = 'desc'; q = q.replace(/\b(most[- ]?expensive|priciest|highest[- ]?priced?)\b/i, '').trim(); }
  else if (/\b(newest|latest|most[- ]?recent)\b/i.test(q)) { sortBy = 'year'; sortDir = 'desc'; q = q.replace(/\b(newest|latest|most[- ]?recent)\b/i, '').trim(); }
  else if (/\b(oldest)\b/i.test(q)) { sortBy = 'year'; sortDir = 'asc'; q = q.replace(/\b(oldest)\b/i, '').trim(); }

  const qLower = q.toLowerCase();
  const sortedMakeKeys = Object.keys(KNOWN_MAKES).sort((a, b) => b.length - a.length);
  for (const key of sortedMakeKeys) {
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(qLower)) { makeFilter = KNOWN_MAKES[key]; break; }
  }

  let classFilter: string | undefined;
  const sortedClassKeys = Object.keys(KNOWN_CLASSES).sort((a, b) => b.length - a.length);
  for (const key of sortedClassKeys) {
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (regex.test(qLower)) { classFilter = key; break; }
  }

  q = q.replace(/\s{2,}/g, ' ').trim();
  return { semanticQuery: q || raw.trim(), sortBy, sortDir, limit, makeFilter, classFilter };
}

// ---- BoatsGroup (boats.com) feed ------------------------------------------
// Pinecone has been retired. Search now runs over the live boats.com inventory
// feed (proxied server-side at /api/yachts/proxy) and is filtered client-side.
// The active catalogue is small enough to fetch whole and filter in the browser.

const STOP = new Set([
  'the', 'and', 'for', 'with', 'under', 'over', 'around', 'near', 'between', 'less', 'than',
  'max', 'min', 'about', 'new', 'used', 'boat', 'boats', 'yacht', 'yachts', 'vessel', 'vessels',
  'million', 'thousand', 'dollar', 'dollars', 'usd', 'price', 'priced', 'foot', 'feet', 'ft',
]);

const numFrom = (v: any): number | undefined => {
  if (typeof v === 'number') return isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : undefined;
};

function feedRecordToBoat(it: Record<string, any>): PineconeBoat {
  const loc = it.BoatLocation || {};
  const images = Array.isArray(it.Images)
    ? it.Images.map((x: any) => (typeof x === 'string' ? x : x?.Uri || x?.url || '')).filter(Boolean)
    : [];
  const classCode = Array.isArray(it.BoatClassCode) ? it.BoatClassCode.join(', ') : (it.BoatClassCode || undefined);
  const name = it.BoatName || [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim() || 'Yacht';
  return {
    id: `boat-${it.DocumentID}`,
    score: 1,
    documentId: String(it.DocumentID || ''),
    boatName: name,
    make: it.MakeString || undefined,
    model: it.Model || undefined,
    year: it.ModelYear ? Number(it.ModelYear) : undefined,
    length: numFrom(it.LengthOverall ?? it.NominalLength),
    // USD equivalent for sorting/filters; listPrice keeps the record's own currency.
    price: usdEquivalent(it),
    listPrice: listPrice(it),
    category: it.BoatCategoryCode || undefined,
    classCode,
    hullMaterial: it.BoatHullMaterialCode || undefined,
    condition: it.SaleClassCode || undefined,
    location: { city: loc.BoatCityName || undefined, state: loc.BoatStateCode || undefined, country: loc.BoatCountryID || undefined },
    companyName: it.CompanyName || undefined,
    images,
    listingUrl: undefined,
    listingDate: it.LastModificationDate ? new Date(it.LastModificationDate).getTime() : undefined,
    rawMetadata: it,
  };
}

// Short-lived per-query cache + one retry. Search, For You, Newest, and the
// dashboard all funnel through this fetch; without the cache a single page view
// could fire enough proxy calls to trip its 30-req/min rate limit, which
// returned an empty result set and rendered as "No yachts found" (the bug FYI
// reported 2026-07-17). The cache collapses those bursts, and the retry rides
// out transient upstream failures instead of showing an empty inventory.
const FEED_CACHE_TTL_MS = 2 * 60 * 1000;
const feedCache = new Map<string, { boats: PineconeBoat[]; at: number }>();

async function fetchFeed(params: Record<string, string> = {}): Promise<PineconeBoat[]> {
  const search = new URLSearchParams(params);
  // The proxy defaults to 200 rows; ask for the whole active catalogue so
  // client-side make/class filters never miss listings beyond the first page.
  if (!search.has('rows')) search.set('rows', '400');
  const qs = search.toString();

  const cached = feedCache.get(qs);
  if (cached && Date.now() - cached.at < FEED_CACHE_TTL_MS) return cached.boats;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/yachts/proxy?${qs}`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const items: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        if (items.length > 0 || attempt === 1) {
          const boats = items.map(feedRecordToBoat);
          if (boats.length > 0) feedCache.set(qs, { boats, at: Date.now() });
          return boats;
        }
      }
    } catch {
      // fall through to retry
    }
    await new Promise(r => setTimeout(r, 900));
  }
  return [];
}

const haystack = (b: PineconeBoat): string =>
  [b.boatName, b.make, b.model, b.category, b.classCode, (b.rawMetadata?.GeneralBoatDescription || '').replace(/<[^>]*>/g, '')]
    .filter(Boolean).join(' ').toLowerCase();

// Token match against listing text. Returns the original set (never empties it)
// when no token matches, so the user always sees relevant inventory.
function keywordFilter(boats: PineconeBoat[], text: string): PineconeBoat[] {
  const tokens = (text || '').toLowerCase().split(/\s+/).filter(t => t.length > 2 && !STOP.has(t));
  if (!tokens.length) return boats;
  const matched = boats.filter(b => { const hay = haystack(b); return tokens.some(t => hay.includes(t)); });
  return matched.length ? matched : boats;
}

// Single-listing lookup by DocumentID, otherwise a keyword scan of active inventory.
export async function searchPinecone(query: string, topK = 20, filters?: Record<string, any>): Promise<PineconeBoat[]> {
  const docEq = filters?.DocumentID?.$eq ?? filters?.documentId?.$eq;
  if (docEq) {
    const boats = await fetchFeed({ documentid: String(docEq) });
    return boats.slice(0, topK);
  }
  const boats = await fetchFeed();
  return keywordFilter(boats, query).slice(0, topK);
}

export async function findSimilarYachts(boat: PineconeBoat, topK = 20): Promise<PineconeBoat[]> {
  const boats = (await fetchFeed()).filter(b => b.documentId !== boat.documentId);
  const score = (b: PineconeBoat): number => {
    let s = 0;
    if (b.make && boat.make && b.make.toLowerCase() === boat.make.toLowerCase()) s += 3;
    if (b.classCode && boat.classCode && b.classCode.toLowerCase() === boat.classCode.toLowerCase()) s += 2;
    if (b.category && boat.category && b.category === boat.category) s += 1;
    if (b.length && boat.length) s += Math.max(0, 2 - Math.abs(b.length - boat.length) / 10);
    return s;
  };
  return boats.sort((a, b) => score(b) - score(a)).slice(0, topK);
}

export async function smartSearchPinecone(
  query: string, _defaultTopK = 100, _filters?: Record<string, any>,
  classFilterOverride?: string | null, structuredFilters?: PineconeStructuredFilters
): Promise<{ boats: PineconeBoat[]; intent: SmartQueryIntent }> {
  const intent = parseSmartQuery(query);
  let boats = await fetchFeed();

  if (intent.makeFilter) {
    const mk = intent.makeFilter.toLowerCase();
    boats = boats.filter(b => (b.make || '').toLowerCase().includes(mk));
  }
  const effectiveClassFilter = classFilterOverride || intent.classFilter;
  if (effectiveClassFilter) boats = boats.filter(b => matchesBoatClass(b, effectiveClassFilter));
  if (intent.semanticQuery) boats = keywordFilter(boats, intent.semanticQuery);
  if (structuredFilters && Object.values(structuredFilters).some(v => v != null && v !== '')) {
    boats = applyStructuredFilters(boats, structuredFilters);
  }

  if (intent.sortBy) {
    const key = intent.sortBy;
    boats.sort((a, b) => {
      const aVal = (a[key] as number) ?? (intent.sortDir === 'asc' ? Infinity : -Infinity);
      const bVal = (b[key] as number) ?? (intent.sortDir === 'asc' ? Infinity : -Infinity);
      return intent.sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  } else {
    boats.sort((a, b) => (b.price || 0) - (a.price || 0));
  }
  if (intent.limit) boats = boats.slice(0, intent.limit);
  return { boats, intent };
}

export async function fetchNewestListings(topK = 100): Promise<PineconeBoat[]> {
  const boats = await fetchFeed();
  boats.sort((a, b) => (b.listingDate ?? 0) - (a.listingDate ?? 0));
  return boats.slice(0, topK);
}

export function yachtListingToPineconeBoat(listing: { id: number; title: string; price: string; image: string; images?: string[]; permalink?: string; location?: string; specs: { length?: string; year?: string; make?: string; model?: string } }): PineconeBoat {
  const parseNum = (s?: string) => s ? parseFloat(s.replace(/[^0-9.]/g, '')) : undefined;
  return {
    id: `yacht-${listing.id}`, score: 1, documentId: String(listing.id),
    boatName: listing.title, make: listing.specs.make, model: listing.specs.model,
    year: listing.specs.year ? Number(listing.specs.year) : undefined,
    length: parseNum(listing.specs.length), price: parseNum(listing.price),
    location: { city: listing.location?.split(',')[0]?.trim(), state: listing.location?.split(',')[1]?.trim() },
    images: listing.images?.length ? listing.images : listing.image ? [listing.image] : [],
    listingUrl: listing.permalink, rawMetadata: {},
  };
}
