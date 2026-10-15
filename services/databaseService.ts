import type { YachtListing, YachtResponse, YachtFilters } from '../types/yacht';
import { collapseRelistedHulls } from '../utils/collapseRelistedHulls';

// Query params are built here, then forwarded to /api/yachts/proxy (BoatsGroup).
const API_ENDPOINT = '/api/yachts/proxy';
const THROTTLE_MS = 2000;
const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 12;

let lastRequestTimestamp = 0;
const responseCache = new Map<string, { data: YachtResponse; createdAt: number }>();

const throttle = (): Promise<void> => {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (elapsed >= THROTTLE_MS) { lastRequestTimestamp = now; return Promise.resolve(); }
  const waitMs = THROTTLE_MS - elapsed;
  lastRequestTimestamp = now + waitMs;
  return new Promise((resolve) => setTimeout(resolve, waitMs));
};

const getCachedResponse = (key: string): YachtResponse | null => {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > RESPONSE_CACHE_TTL_MS) { responseCache.delete(key); return null; }
  return cached.data;
};

const setCachedResponse = (key: string, data: YachtResponse): void => {
  if (responseCache.size > 100) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { data, createdAt: Date.now() });
};

const PRICE_REDUCTION_KEYS = ['OriginalPrice', 'PreviousPrice', 'PriorPrice', 'OldPrice', 'OldListPrice', 'PreviousListPrice', 'PriceBeforeReduction', 'LastAskingPrice', 'LastPrice', 'YAP_PreviousPrice', 'PriceWas'];
const PRICE_REDUCTION_FLAG_KEYS = ['PriceReducedInd', 'PriceReductionInd', 'IsPriceReduced', 'ReducedInd', 'HasPriceReduction', 'PriceChange', 'YAP_REDUCED_PRICE'];

const parsePriceValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatPriceValue = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const getFirstValue = (item: Record<string, any>, keys: string[]): unknown => {
  for (const key of keys) { if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key]; }
  return undefined;
};

const toBool = (value: unknown): boolean => {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value === 'string') { const n = value.trim().toLowerCase(); return n === 'true' || n === 'yes' || n === 'reduced'; }
  return false;
};

const normalizePostedAt = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
};

const buildInventoryUrl = (page: number, limit: number, filters: YachtFilters, paginationParam: 'page' | 'paged' = 'page'): URL => {
  const url = new URL(API_ENDPOINT, window.location.origin);
  url.searchParams.append(paginationParam, page.toString());
  url.searchParams.append('per_page', limit.toString());
  url.searchParams.append('posts_per_page', limit.toString());
  url.searchParams.append('limit', limit.toString());

  if (filters.keyword?.trim()) url.searchParams.append('ys_keyword', filters.keyword.trim());
  if (filters.make?.trim()) url.searchParams.append('make', filters.make.trim());
  if (filters.boatName?.trim()) url.searchParams.append('ys_name', filters.boatName.trim());
  if (filters.lengthMin) url.searchParams.append('lengthlo', filters.lengthMin);
  if (filters.lengthMax) url.searchParams.append('lengthhi', filters.lengthMax);
  if (filters.yearMin) url.searchParams.append('yearlo', filters.yearMin);
  if (filters.yearMax) url.searchParams.append('yearhi', filters.yearMax);
  if (filters.priceMin) url.searchParams.append('pricelo', filters.priceMin);
  if (filters.priceMax) url.searchParams.append('pricehi', filters.priceMax);
  if (filters.condition?.trim()) url.searchParams.append('sale_class', filters.condition.trim());
  if (filters.boatCategory?.trim()) url.searchParams.append('boat_category', filters.boatCategory.trim());
  if (filters.boatClass?.trim()) url.searchParams.append('boat_class', filters.boatClass.trim());
  if (filters.hullMaterial?.trim()) url.searchParams.append('hull_material', filters.hullMaterial.trim());
  if (filters.state?.trim()) url.searchParams.append('state', filters.state.trim());
  if (filters.country?.trim()) url.searchParams.append('country', filters.country.trim());
  if (filters.engineType?.trim()) url.searchParams.append('engine_type', filters.engineType.trim());
  if (filters.fuelType?.trim()) url.searchParams.append('fuel', filters.fuelType.trim());
  if (filters.engineCount?.trim()) url.searchParams.append('engine_count', filters.engineCount.trim());

  const isOldestFirst = filters.dateSort === 'oldest';
  url.searchParams.append('orderby', 'LastModificationDate');
  url.searchParams.append('order', isOldestFirst ? 'asc' : 'desc');
  url.searchParams.append('sort', 'date_added');
  url.searchParams.append('sortorder', isOldestFirst ? 'asc' : 'desc');
  return url;
};

const executeQuery = async (url: URL): Promise<YachtResponse | null> => {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.delete('_t');
  const cacheKey = keyUrl.toString();
  const cached = getCachedResponse(cacheKey);
  if (cached) return cached;

  await throttle();
  try {
    const proxyUrl = new URL('/api/yachts/proxy', window.location.origin);
    url.searchParams.forEach((value, key) => proxyUrl.searchParams.set(key, value));

    const response = await fetch(proxyUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok) return { items: [], total: 0, pageSize: DEFAULT_PAGE_SIZE };

    const rawText = await response.text();
    if (rawText.trim().startsWith('<')) return { items: [], total: 0, pageSize: DEFAULT_PAGE_SIZE };

    let parsedData;
    try { parsedData = JSON.parse(rawText); } catch { return { items: [], total: 0, pageSize: DEFAULT_PAGE_SIZE }; }

    let rawItems: any[] = [];
    let total = 0;
    let pageSize = DEFAULT_PAGE_SIZE;

    if (parsedData.results && Array.isArray(parsedData.results)) {
      rawItems = parsedData.results;
      total = Number.parseInt(String(parsedData.total ?? rawItems.length), 10) || rawItems.length;
      pageSize = Number.parseInt(String(parsedData.total_displaying ?? rawItems.length), 10) || rawItems.length || DEFAULT_PAGE_SIZE;
    } else if (Array.isArray(parsedData)) {
      rawItems = parsedData; total = parsedData.length; pageSize = rawItems.length || DEFAULT_PAGE_SIZE;
    } else if (parsedData.yachts && Array.isArray(parsedData.yachts)) {
      rawItems = parsedData.yachts; total = rawItems.length; pageSize = rawItems.length || DEFAULT_PAGE_SIZE;
    }

    const items: YachtListing[] = rawItems.map((item: any) => {
      // Keep the whole gallery, not just the cover — the detail page's image
      // gallery renders from it (FYI bug report 2026-07-17: one photo shown).
      const galleryImages: string[] = Array.isArray(item.Images)
        ? item.Images
            .map((img: any) => (typeof img === 'string' ? img : img?.Uri || img?.url || ''))
            .filter(Boolean)
        : [];
      let imageUrl = galleryImages[0] || '';
      if (!imageUrl && item.featured_image_url) { imageUrl = item.featured_image_url; }

      let location = item.Location || 'Global';
      if (item.BoatLocation) {
        const parts = [];
        if (item.BoatLocation.BoatCityName) parts.push(item.BoatLocation.BoatCityName);
        if (item.BoatLocation.BoatStateCode) parts.push(item.BoatLocation.BoatStateCode);
        else if (item.BoatLocation.BoatCountryID) parts.push(item.BoatLocation.BoatCountryID);
        if (parts.length > 0) location = parts.join(', ');
      }

      const postedAt = normalizePostedAt(item.LastModificationDate || item.IMTTimeStamp || item.PostedDate || item.CreatedDate || item.PublishDate);
      const hidePrice = item.PriceHideInd === '1';
      const currentPriceRaw = hidePrice ? undefined : (item.Price || item.NormPrice || item.CurrentPrice || item.ListPrice);
      const currentPriceValue = parsePriceValue(currentPriceRaw);
      const previousPriceRaw = getFirstValue(item, PRICE_REDUCTION_KEYS);
      const previousPriceValue = parsePriceValue(previousPriceRaw);
      const hasReductionFlag = PRICE_REDUCTION_FLAG_KEYS.some((key) => toBool(item[key]));

      const currentPrice = hidePrice ? 'Price on Request' : (currentPriceValue !== undefined ? formatPriceValue(currentPriceValue) : (typeof currentPriceRaw === 'string' && currentPriceRaw.trim() ? currentPriceRaw.trim() : 'Price on Request'));
      const previousPriceText = previousPriceValue !== undefined ? formatPriceValue(previousPriceValue) : (typeof previousPriceRaw === 'string' && (previousPriceRaw as string).trim() ? (previousPriceRaw as string).trim() : undefined);
      const isNumericReduction = previousPriceValue !== undefined && currentPriceValue !== undefined && previousPriceValue > currentPriceValue;
      const hasDistinctPreviousPrice = !!previousPriceText && currentPrice !== 'Price on Request' && previousPriceText !== currentPrice;
      const isPriceReduced = !hidePrice && hasDistinctPreviousPrice && (hasReductionFlag || isNumericReduction);

      return {
        id: Number(item.DocumentID) || item.id || Math.floor(Math.random() * 100000),
        title: item.BoatName
          || [item.ModelYear, item.MakeString || item.Make, item.Model].filter(Boolean).join(' ').trim()
          || item.title || 'Unknown Vessel',
        permalink: item.link || `https://fyiyachts.com/yacht/${item.DocumentID}`,
        price: currentPrice,
        previousPrice: isPriceReduced && hasDistinctPreviousPrice ? previousPriceText : undefined,
        isPriceReduced,
        image: imageUrl,
        images: galleryImages.length ? galleryImages : imageUrl ? [imageUrl] : [],
        postedAt,
        location,
        specs: {
          length: item.DisplayLengthFeet || item.Length || item.LengthOverall || '',
          year: item.ModelYear || item.Year || '',
          make: item.MakeString || item.Make || '',
          model: item.Model || '',
        },
        brokerageId: item.ListingOwnerBrokerageID || '',
        companyName: item.CompanyName || '',
      };
    });

    const result = { items, total, pageSize };
    setCachedResponse(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Database] fetch error:', error);
    return null;
  }
};

export const fetchYachtInventory = async (page = 1, limit = DEFAULT_PAGE_SIZE, filters: YachtFilters = {}): Promise<YachtResponse> => {
  const paginationParam: 'page' | 'paged' = page > 1 ? 'paged' : 'page';
  const url = buildInventoryUrl(page, limit, filters, paginationParam);
  let result = await executeQuery(url);

  if ((!result || result.items.length === 0) && filters.keyword && !filters.make) {
    const fallbackUrl = buildInventoryUrl(page, limit, { ...filters, keyword: undefined, make: filters.keyword }, paginationParam);
    const fallbackResult = await executeQuery(fallbackUrl);
    if (fallbackResult && fallbackResult.items.length > 0) result = fallbackResult;
  }

  if (page > 1 && (!result || result.items.length === 0) && paginationParam === 'paged') {
    const pageParamResult = await executeQuery(buildInventoryUrl(page, limit, filters, 'page'));
    if (pageParamResult && pageParamResult.items.length > 0) result = pageParamResult;
  }

  if (!result) return { items: [], total: 0, pageSize: DEFAULT_PAGE_SIZE };

  // The feed can carry the same hull twice under different DocumentIDs —
  // same make/model/length/price, one record with a wrong year. Collapse those
  // onto the oldest-year record, but only when the years are close: a build
  // year and a refit year decades apart are two listings the brokerage created
  // on purpose, and collapsing them hid one (see collapseRelistedHulls).
  const dedupedItems = collapseRelistedHulls(
    result.items,
    (item) => `${item.specs.make}|${item.specs.model}|${item.specs.length}|${item.price}`,
    (item) => Number(item.specs.year),
  );

  const shouldSortOldestFirst = filters.dateSort === 'oldest';
  const sortedItems = [...dedupedItems].sort((a, b) => {
    const aTime = a.postedAt ? Date.parse(a.postedAt) : NaN;
    const bTime = b.postedAt ? Date.parse(b.postedAt) : NaN;
    const aVal = isNaN(aTime) ? (shouldSortOldestFirst ? Infinity : -Infinity) : aTime;
    const bVal = isNaN(bTime) ? (shouldSortOldestFirst ? Infinity : -Infinity) : bTime;
    return shouldSortOldestFirst ? aVal - bVal : bVal - aVal;
  });

  const removedByDedup = result.items.length - dedupedItems.length;
  return { ...result, items: sortedItems, total: Math.max(0, result.total - removedByDedup) };
};

export const fetchYachtById = async (id: number): Promise<YachtListing | null> => {
  // Search with a reasonable page size to improve chance of finding the exact boat
  const result = await fetchYachtInventory(1, 50, { keyword: String(id) });
  const match = result.items.find(item => item.id === id);
  if (match) return match;
  // Try by boat name as fallback
  const byName = await fetchYachtInventory(1, 20, { boatName: String(id) });
  return byName.items.find(item => item.id === id) || null;
};
