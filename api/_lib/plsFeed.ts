// BoatsGroup co-brokerage (PLS) feed: the wider market of boats listed by
// other brokerages that FYI can sell. FYI's own boats ("FYI Exclusives") still
// come from api.boats.com/inventory with BOATS_API_KEY; this module adds the
// co-brokerage side with BOATS_PLS_API_KEY.
//
// Verified against the live service 2026-10-22:
// - `fields` is REQUIRED (no wildcard). We request every field the exclusives
//   feed carries that the site reads, under the SAME names, so existing cards,
//   search and listing pages consume co-brokerage rows unchanged.
// - Response shape is {"data":{"numResults","results"},"status"}, unlike the
//   inventory API's bare {"numResults","results"}. toSiteResponse() flattens it.
// - Listing-broker fields (CompanyName, Office, Owner, SalesRep, Marketing,
//   Service) are never returned. Co-brokerage rows are presented as FYI's,
//   with FYI's office as the contact.
// - FYI's own boats also appear in PLS under the same DocumentID; callers
//   dedupe so each boat shows once, as the FYI Exclusive version.

const PLS_URL = 'https://services.boats.com/pls/boats/search';
const PLS_DETAILS_URL = 'https://services.boats.com/pls/boats/details';
const PLS_KEY = process.env.BOATS_PLS_API_KEY || '';
const TIMEOUT_MS = 8_000;

export const plsConfigured = (): boolean => !!PLS_KEY;

/** Same field names as the exclusives feed (api.boats.com/inventory). */
export const PLS_FIELDS = [
  'DocumentID', 'Source', 'SalesStatus', 'CoOpIndicator',
  'MakeString', 'MakeStringExact', 'Model', 'ModelExact', 'ModelYear', 'BoatName',
  'ListingTitle', 'BuilderName', 'DesignerName',
  'Price', 'OriginalPrice', 'NormPrice', 'PriceHideInd',
  'LengthOverall', 'NominalLength', 'NormNominalLength', 'LengthOfDeck', 'LengthAtWaterLine',
  'BeamMeasure', 'MaxDraft', 'BridgeClearanceMeasure',
  'BoatLocation', 'BoatCategoryCode', 'BoatClassCode', 'SaleClassCode', 'BoatHullMaterialCode',
  'Engines', 'NumberOfEngines', 'TotalEnginePowerQuantity', 'TotalEngineHoursNumeric', 'DriveTypeCode',
  'CruisingSpeedMeasure', 'MaximumSpeedMeasure', 'RangeMeasure',
  'FuelTankCapacityMeasure', 'WaterTankCapacityMeasure', 'HoldingTankCapacityMeasure',
  'CabinsCountNumeric', 'HeadsCountNumeric', 'MaximumNumberOfPassengersNumeric',
  'DryWeightMeasure', 'DisplacementMeasure',
  'GeneralBoatDescription', 'AdditionalDetailDescription',
  'Images', 'Videos', 'EmbeddedVideo', 'ExternalLink',
  'LastModificationDate', 'ItemReceivedDate', 'IMTTimeStamp',
].join(',');

/** Fields for grid/search rows: enough for a card, a fraction of the payload. */
export const PLS_CARD_FIELDS = [
  'DocumentID', 'SalesStatus', 'MakeString', 'Model', 'ModelYear', 'BoatName',
  'Price', 'OriginalPrice', 'NormPrice', 'PriceHideInd',
  'LengthOverall', 'NominalLength', 'NormNominalLength',
  'BoatLocation', 'BoatCategoryCode', 'BoatClassCode', 'SaleClassCode',
  'Images', 'LastModificationDate',
].join(',');

const FYI_OFFICE = {
  Name: 'FYI Yachts',
  PostalAddress: '2424 Coral Way', City: 'Miami', State: 'FL', PostCode: '33145',
  Country: 'US', Email: 'sales@fyiyachts.com', Phone: '305-854-6020',
};

/** Tag a PLS row as co-brokerage and give it FYI's contact details. */
export function toCobrokerageItem(raw: Record<string, any>, cardOnly = false): Record<string, any> {
  const item: Record<string, any> = { ...raw, ListingType: 'cobrokerage', Source: raw.Source || 'PLS' };
  if (cardOnly && Array.isArray(item.Images)) item.Images = item.Images.slice(0, 1);
  // Broker fields are absent from PLS. FYI's office is the contact; no
  // SalesRep, so listing pages show no "Listed by" line for these boats.
  item.Office = FYI_OFFICE;
  return item;
}

/** Params the PLS search understands (mirrors the inventory API). */
const FORWARD = new Set([
  'rows', 'start', 'make', 'model', 'keyword', 'class', 'condition',
  'year', 'length', 'price', 'state', 'country', 'sort', 'documentid',
]);

export interface PlsResult { numResults: number; results: Record<string, any>[] }

export async function plsSearch(
  query: Record<string, string | undefined>,
  opts: { fields?: string; cardOnly?: boolean } = {},
): Promise<PlsResult> {
  if (!PLS_KEY) return { numResults: 0, results: [] };
  const url = new URL(PLS_URL);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '' && FORWARD.has(k.toLowerCase())) url.searchParams.set(k.toLowerCase(), v);
  }
  url.searchParams.set('key', PLS_KEY);
  url.searchParams.set('fields', opts.fields || PLS_FIELDS);
  if (!url.searchParams.has('rows')) url.searchParams.set('rows', '50');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok || !body || body.status !== 'success' || !body.data) {
    const msg = body?.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(`PLS search failed: ${msg}`);
  }
  const results = Array.isArray(body.data.results) ? body.data.results : [];
  return {
    numResults: Number(body.data.numResults) || 0,
    results: results.map((r: Record<string, any>) => toCobrokerageItem(r, opts.cardOnly)),
  };
}

/**
 * The PLS courtesy disclaimer for one boat, e.g. "<p>FYI Yachts is pleased to
 * assist you in the purchase of this vessel. This boat is centrally listed by
 * Yachts360.</p>". Only the details endpoint returns it. Undefined on any error.
 */
export async function plsGetDisclaimer(id: string): Promise<string | undefined> {
  if (!PLS_KEY || !/^\d+$/.test(id)) return undefined;
  try {
    const url = new URL(PLS_DETAILS_URL);
    url.searchParams.set('key', PLS_KEY);
    url.searchParams.set('id', id);
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const body: any = await res.json().catch(() => null);
    const disclaimer = body?.status === 'success' ? body.data?.PlsDisclaimer : undefined;
    return typeof disclaimer === 'string' && disclaimer.trim() ? disclaimer : undefined;
  } catch {
    return undefined;
  }
}

const toPlainText = (html: string): string =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** One co-brokerage boat by DocumentID, full detail. Undefined when not found. */
export async function plsGetById(id: string): Promise<Record<string, any> | undefined> {
  if (!PLS_KEY || !/^\d+$/.test(id)) return undefined;
  // The disclaimer is fine print: its failure never fails the listing.
  const [{ results }, disclaimer] = await Promise.all([
    plsSearch({ documentid: id, rows: '1' }),
    plsGetDisclaimer(id).catch(() => undefined),
  ]);
  const item = results.find((r) => String(r.DocumentID) === id);
  if (item && disclaimer) {
    const text = toPlainText(disclaimer);
    if (text) item.PlsDisclaimer = text;
  }
  return item;
}
