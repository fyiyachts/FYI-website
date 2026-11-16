// The listing specification map: API field → label → group → formatter.
//
// The spec table on a listing is data-driven. Rows come from SPEC_FIELDS, in
// order; a row whose value is missing, null, empty, "--", or a meaningless 0
// is simply not there, and a group with no rows has no heading. Nothing ever
// renders as "--".
//
// To add a field: add ONE line to SPEC_FIELDS.
//   { group: 'Dimensions & Weight', label: 'Air Draft', field: 'AirDraftMeasure', format: length },
//
// Shared by the server render (api/listing.ts) and the React listing page
// (components/listing/specFields.ts re-exports it), so crawlers and visitors
// read the same table. Dependency-free apart from the price / country helpers.

import { formatMoney, listPrice, priceCurrency } from './price.js';
import { countryName } from './countryName.js';

export type SpecGroup =
  | 'Overview'
  | 'Dimensions & Weight'
  | 'Performance'
  | 'Engines & Propulsion'
  | 'Tankage'
  | 'Accommodations'
  | 'Equipment & Systems';

export const SPEC_GROUPS: SpecGroup[] = [
  'Overview', 'Dimensions & Weight', 'Performance', 'Engines & Propulsion',
  'Tankage', 'Accommodations', 'Equipment & Systems',
];

export interface SpecRow {
  label: string;
  value: string;
  /** Small secondary text under the value ("Save $25,000", "was $1,200,000"). */
  note?: string;
  /** A struck-through earlier price shown before the value. */
  was?: string;
}

/** What a formatter may return: nothing, a plain value, or a value with extras. */
type Out = string | undefined | null | Omit<SpecRow, 'label'>;

/** Context from outside the feed record. */
export interface SpecContext {
  /** A recorded price reduction still inside its display window (api/_lib/priceHistory.ts). */
  reduction?: { previous: number; currency: string; date: string } | null;
}

export interface SpecField {
  group: SpecGroup;
  label: string;
  /** The API field this row reads. */
  field: string;
  /** Formats the field's value; omitted = shown as text. */
  format?: (value: any, it: Record<string, any>, ctx: SpecContext) => Out;
  /** For rows built from several fields: gets the whole record. Runs even when `field` is empty. */
  compute?: (it: Record<string, any>, ctx: SpecContext) => Out | SpecRow[];
  /** Other API fields this row consumes — keeps them out of the "unmapped" dev log. */
  uses?: string[];
}

/* ------------------------------------------------ value helpers */

const EMPTY = new Set(['', '--', '-', '—', 'n/a', 'na', 'none', 'null', 'undefined', 'unknown', 'unspecified', '0']);

/** Feed text, or undefined when it is one of the many ways of saying "nothing". */
export function text(v: unknown): string | undefined {
  if (v == null || typeof v === 'boolean' || typeof v === 'object') return undefined;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return EMPTY.has(s.toLowerCase()) ? undefined : s;
}

/** "3196|gallon", "36,700 lb", "8,055.46 mi", 595 → { n, unit }. Zero and negatives are "nothing". */
export function measure(v: unknown): { n: number; unit: string } | undefined {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? { n: v, unit: '' } : undefined;
  const s = text(v);
  if (!s) return undefined;
  const m = /^(-?[\d,]*\.?\d+)\s*\|?\s*(.*)$/.exec(s);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? { n, unit: m[2].trim().toLowerCase() } : undefined;
}

/** 12100 → "12,100"; 15.24 → "15.24"; trailing zeros dropped. */
export const fmtNum = (n: number, maxDecimals = 2): string =>
  n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });

const isMetres = (u: string) => /^(m|meter|meters|metre|metres)$/.test(u);
const isLitres = (u: string) => /^(l|liter|liters|litre|litres)$/.test(u);

/** "50 ft" → "50 ft (15.2 m)". */
export const length = (v: unknown): string | undefined => {
  const m = measure(v);
  if (!m) return undefined;
  const ft = isMetres(m.unit) ? m.n / 0.3048 : m.n;
  const metres = ft * 0.3048;
  return `${fmtNum(ft)} ft (${fmtNum(metres, metres < 10 ? 2 : 1)} m)`;
};

/** "344|gallon" → "344 gal (1,302 L)". */
export const capacity = (v: unknown): string | undefined => {
  const m = measure(v);
  if (!m) return undefined;
  const gal = isLitres(m.unit) ? m.n / 3.785411784 : m.n;
  return `${fmtNum(gal, 0)} gal (${fmtNum(gal * 3.785411784, 0)} L)`;
};

/** "36,700 lb" → "36,700 lb (16,647 kg)". */
export const weight = (v: unknown): string | undefined => {
  const m = measure(v);
  if (!m) return undefined;
  const lb = /^(kg|kgs|kilogram|kilograms)$/.test(m.unit) ? m.n * 2.20462262
    : /^(t|tonne|tonnes|metric ton|metric tons)$/.test(m.unit) ? m.n * 2204.62262
    : m.n;
  return `${fmtNum(lb, 0)} lb (${fmtNum(lb / 2.20462262, 0)} kg)`;
};

/** "25 kn" → "25 kn"; mph and km/h are converted to knots. */
export const speed = (v: unknown): string | undefined => {
  const m = measure(v);
  if (!m) return undefined;
  const kn = /^(mph|mi\/h)$/.test(m.unit) ? m.n * 0.868976 : /^(kph|km\/h|kmh)$/.test(m.unit) ? m.n * 0.539957 : m.n;
  return `${fmtNum(kn, 1)} kn`;
};

/** Ranges are always nautical miles: "8,055.46 mi" → "7,000 nm". */
export const range = (v: unknown): string | undefined => {
  const m = measure(v);
  if (!m) return undefined;
  const nm = /^(mi|mile|miles|sm)$/.test(m.unit) ? m.n * 0.868976 : /^(km|kilometer|kilometers|kilometre|kilometres)$/.test(m.unit) ? m.n * 0.539957 : m.n;
  return `${fmtNum(nm, 0)} nm`;
};

/** "2434|horsepower", "1,200 hp" → horsepower as a number (kW converted). */
export const horsepower = (v: unknown): number | undefined => {
  const m = measure(v);
  if (!m) return undefined;
  return /^(kw|kilowatt|kilowatts)$/.test(m.unit) ? m.n * 1.34102 : m.n;
};
export const power = (v: unknown): string | undefined => {
  const hp = horsepower(v);
  return hp ? `${fmtNum(hp, 0)} hp` : undefined;
};

/** A count: 3 → "3"; 0 and blanks are nothing. */
export const count = (v: unknown): string | undefined => {
  const m = measure(v);
  return m ? fmtNum(m.n, 0) : undefined;
};

/** true / "true" / "Yes" → "Yes"; anything else is nothing (a "No" row says little). */
export const yes = (v: unknown): string | undefined =>
  v === true || /^(true|yes|y|1)$/i.test(String(v ?? '').trim()) ? 'Yes' : undefined;

/** "diesel" → "Diesel"; codes already capitalised are left alone. */
export const label = (v: unknown): string | undefined => {
  const s = text(v);
  return s && /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
};

const list = (v: unknown): string | undefined => {
  const items = (Array.isArray(v) ? v : [v]).map(text).filter((s): s is string => !!s && !/^other$/i.test(s));
  return items.length ? [...new Set(items)].join(', ') : undefined;
};

const degrees = (v: unknown): string | undefined => {
  const m = measure(v);
  return m ? `${fmtNum(m.n, 1)}°` : undefined;
};

const sameText = (a: unknown, b: unknown) =>
  String(a ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') === String(b ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const join = (parts: (string | undefined | null | false)[], sep = ' · '): string | undefined => {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join(sep) : undefined;
};

/* ------------------------------------------------ composite rows */

/** City, State / Country — the listing's general area, never a berth. */
export function listingLocation(it: Record<string, any>): string | undefined {
  const loc = it.BoatLocation || {};
  const city = text(loc.BoatCityName);
  // Country spelled out when there is no US state ("Turkey", not "TR").
  return join([city, text(loc.BoatStateCode) || text(countryName(loc.BoatCountryID))], ', ');
}

function askingPrice(it: Record<string, any>, ctx: SpecContext): Out {
  const price = listPrice(it);
  if (!price) return 'Price on request';
  const notes: string[] = [];
  const qualifier = text(it.PriceQualifier);
  if (qualifier) notes.push(qualifier);
  const savings = measure(it.SavingsPrice);
  if (savings) notes.push(`Save ${formatMoney({ amount: savings.n, currency: priceCurrency(it.SavingsPrice) === 'USD' ? price.currency : priceCurrency(it.SavingsPrice) })}`);
  const r = ctx.reduction;
  const reduced = r && r.currency === price.currency && r.previous > price.amount;
  if (reduced) notes.push(`Price reduced ${fmtDate(r.date)}`);
  return {
    value: formatMoney(price),
    ...(reduced ? { was: formatMoney({ amount: r.previous, currency: r.currency }) } : {}),
    ...(notes.length ? { note: notes.join(' · ') } : {}),
  };
}

/** "2026-11-03" → "Nov 3, 2026". */
export function fmtDate(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m[2]) - 1] ?? ''} ${Number(m[3])}, ${m[1]}`.trim();
}

function draft(it: Record<string, any>): Out {
  const max = length(it.MaxDraft) ?? length(it.DraftMeasure);
  const extras = join([
    length(it.DriveUp) && `Drive up ${length(it.DriveUp)}`,
    length(it.KeelUp) && `Keel up ${length(it.KeelUp)}`,
    length(it.KeelDown) && `Keel down ${length(it.KeelDown)}`,
  ]);
  if (max) return extras ? { value: max, note: extras } : max;
  return extras;
}

function warranty(it: Record<string, any>): Out {
  const period = text(it.WarrantyPeriod);
  const expires = fmtDate(it.WarrantyExpirationDate);
  return join([period, expires && `Expires ${expires}`]);
}

const engines = (it: Record<string, any>): Record<string, any>[] =>
  (Array.isArray(it.Engines) ? it.Engines : []).filter((e: any) => e && typeof e === 'object');

function totalPower(it: Record<string, any>): Out {
  const stated = power(it.TotalEnginePowerQuantity);
  if (stated) return stated;
  const sum = engines(it).reduce((n, e) => n + (horsepower(e.EnginePower) ?? 0), 0);
  return sum > 0 ? `${fmtNum(sum, 0)} hp` : undefined;
}

/** The parts of one engine line, in display order. */
function engineParts(e: Record<string, any>, each = false): (string | undefined)[] {
  const hp = power(e.EnginePower);
  const hours = measure(e.Hours);
  const type = label(e.Type);
  const drive = text(e.DriveTransmissionDescription);
  return [
    join([text(e.Make), text(e.Model)], ' '),
    hp && (each ? `${hp} each` : hp),
    // Hours are only ever shown per engine (never a total): "595 hrs each" on a 2× row.
    hours && `${fmtNum(hours.n, 0)} hrs${each ? ' each' : ''}`,
    count(e.Year) && String(e.Year),
    type,
    drive && !sameText(drive, type) && !/^other$/i.test(drive) ? drive : undefined,
    text(e.PropellerType),
  ];
}

/**
 * One row per engine — "Engine 1: MTU 16V 2000 M96 · 2,434 hp · 595 hrs ·
 * 2019 · Inboard · Shaft" — or a single "2× …" row when they are identical.
 */
function engineRows(it: Record<string, any>): SpecRow[] {
  const list = engines(it);
  const lines = list.map((e) => join(engineParts(e)));
  if (!lines.some(Boolean)) return [];
  if (list.length > 1 && lines.every((l) => l && l === lines[0])) {
    return [{ label: 'Engines', value: `${list.length}× ${join(engineParts(list[0], true))}` }];
  }
  const rows: SpecRow[] = [];
  lines.forEach((line, i) => {
    if (!line) return;
    const where = text(list[i].BoatEngineLocationCode);
    rows.push({ label: list.length === 1 ? 'Engine' : `Engine ${i + 1}${where ? ` (${where})` : ''}`, value: line });
  });
  return rows;
}

const fuelTypes = (it: Record<string, any>): Out => list(engines(it).map((e) => label(e.Fuel)));

/** "3,196 gal (12,100 L) · 2 tanks · Aluminum". */
const tank = (prefix: string) => (it: Record<string, any>): Out => {
  const n = measure(it[`${prefix}TankCountNumeric`]);
  return join([
    capacity(it[`${prefix}TankCapacityMeasure`]),
    n && `${fmtNum(n.n, 0)} ${n.n === 1 ? 'tank' : 'tanks'}`,
    label(it[`${prefix}TankMaterialCode`]),
  ]);
};

function waterHeater(it: Record<string, any>): Out {
  const n = measure(it.WaterHeaterCountNumeric);
  return join([
    capacity(it.WaterHeaterCapacityMeasure),
    n && `${fmtNum(n.n, 0)} ${n.n === 1 ? 'heater' : 'heaters'}`,
    label(it.WaterHeaterMaterialCode),
  ]);
}

/** Total berths with the breakdown: "6 (2 double, 2 twin, 2 single)". */
function berths(it: Record<string, any>): Out {
  const kinds: [string, number][] = [
    ['double', measure(it.DoubleBerthsCountNumeric)?.n ?? 0],
    ['twin', measure(it.TwinBerthsCountNumeric)?.n ?? 0],
    ['single', measure(it.SingleBerthsCountNumeric)?.n ?? 0],
  ];
  const sum = kinds.reduce((n, [, c]) => n + c, 0);
  if (!sum) return count(it.BerthsCountNumeric);
  return `${fmtNum(sum, 0)} (${kinds.filter(([, c]) => c > 0).map(([k, c]) => `${fmtNum(c, 0)} ${k}`).join(', ')})`;
}

/* ------------------------------------------------ the map */

export const SPEC_FIELDS: SpecField[] = [
  // Overview
  { group: 'Overview', label: 'Asking Price', field: 'Price', compute: askingPrice, uses: ['NormPrice', 'OriginalPrice', 'PriceHideInd', 'PriceQualifier', 'SavingsPrice'] },
  { group: 'Overview', label: 'Year', field: 'ModelYear', format: (v) => (measure(v) ? String(v) : undefined) },
  { group: 'Overview', label: 'Make', field: 'MakeString', uses: ['MakeStringExact'] },
  { group: 'Overview', label: 'Model', field: 'Model', uses: ['ModelExact'] },
  { group: 'Overview', label: 'Builder', field: 'BuilderName', format: (v, it) => (sameText(v, it.MakeString) ? undefined : text(v)) },
  { group: 'Overview', label: 'Designer', field: 'DesignerName' },
  { group: 'Overview', label: 'Condition', field: 'SaleClassCode', format: label },
  { group: 'Overview', label: 'Type', field: 'BoatClassCode', format: list, uses: ['BoatCategoryCode'] },
  { group: 'Overview', label: 'Hull Material', field: 'BoatHullMaterialCode', format: label },
  // Hull ID and Stock # are deliberately not shown (BoatHullID, StockNumber).
  { group: 'Overview', label: 'Tax Status', field: 'TaxStatusCode', format: label },
  // Only a real two-letter country code: the feed also sends "0" and "1".
  { group: 'Overview', label: 'Flag / Registration', field: 'RegistrationCountryCode', format: (v) => (/^[A-Za-z]{2}$/.test(String(v ?? '').trim()) ? countryName(String(v).trim()) : undefined) },
  { group: 'Overview', label: 'Warranty', field: 'WarrantyPeriod', compute: warranty, uses: ['WarrantyExpirationDate'] },
  { group: 'Overview', label: 'Location', field: 'BoatLocation', compute: (it) => { const l = listingLocation(it); return l ? { value: l, note: 'Approximate area' } : undefined; } },

  // Dimensions & Weight
  { group: 'Dimensions & Weight', label: 'LOA', field: 'LengthOverall', format: length },
  { group: 'Dimensions & Weight', label: 'Nominal Length', field: 'NominalLength', format: (v, it) => (sameText(length(v), length(it.LengthOverall)) ? undefined : length(v)), uses: ['NormNominalLength'] },
  { group: 'Dimensions & Weight', label: 'LWL', field: 'LengthAtWaterLine', format: length },
  { group: 'Dimensions & Weight', label: 'Length on Deck', field: 'LengthOfDeck', format: length },
  { group: 'Dimensions & Weight', label: 'Beam', field: 'BeamMeasure', format: length },
  { group: 'Dimensions & Weight', label: 'Draft', field: 'MaxDraft', compute: draft, uses: ['DraftMeasure', 'DriveUp', 'KeelUp', 'KeelDown'] },
  { group: 'Dimensions & Weight', label: 'Bridge Clearance', field: 'BridgeClearanceMeasure', format: length },
  { group: 'Dimensions & Weight', label: 'Freeboard', field: 'FreeBoardMeasure', format: length },
  { group: 'Dimensions & Weight', label: 'Cabin Headroom', field: 'CabinHeadroomMeasure', format: length },
  { group: 'Dimensions & Weight', label: 'Deadrise', field: 'DeadriseMeasure', format: degrees },
  { group: 'Dimensions & Weight', label: 'Displacement', field: 'DisplacementMeasure', format: (v, it) => join([weight(v), text(it.DisplacementTypeCode)]), uses: ['DisplacementTypeCode'] },
  { group: 'Dimensions & Weight', label: 'Dry Weight', field: 'DryWeightMeasure', format: weight },
  { group: 'Dimensions & Weight', label: 'Ballast', field: 'BallastWeightMeasure', format: weight },
  { group: 'Dimensions & Weight', label: 'Keel', field: 'BoatKeelCode', format: label },

  // Performance
  { group: 'Performance', label: 'Cruising Speed', field: 'CruisingSpeedMeasure', format: speed },
  { group: 'Performance', label: 'Max Speed', field: 'MaximumSpeedMeasure', format: speed },
  { group: 'Performance', label: 'Range', field: 'RangeMeasure', format: range },
  // The feed uses this one field for both knots and RPM ("22", "2175"): shown as given.
  { group: 'Performance', label: 'Propeller Cruising Speed', field: 'PropellerCruisingSpeed', format: (v) => { const m = measure(v); return m ? (m.n > 100 ? `${fmtNum(m.n, 0)} rpm` : `${fmtNum(m.n, 1)} kn`) : undefined; } },

  // Engines & Propulsion
  { group: 'Engines & Propulsion', label: 'Number of Engines', field: 'NumberOfEngines', compute: (it) => count(it.NumberOfEngines) ?? count(engines(it).length) },
  { group: 'Engines & Propulsion', label: 'Total Power', field: 'TotalEnginePowerQuantity', compute: totalPower },
  { group: 'Engines & Propulsion', label: 'Fuel Type', field: 'Engines', compute: fuelTypes },
  { group: 'Engines & Propulsion', label: 'Drive Type', field: 'DriveTypeCode', format: (v) => (/^other$/i.test(String(v ?? '').trim()) ? undefined : label(v)) },
  { group: 'Engines & Propulsion', label: 'Engines', field: 'Engines', compute: engineRows },

  // Tankage
  { group: 'Tankage', label: 'Fuel', field: 'FuelTankCapacityMeasure', compute: tank('Fuel'), uses: ['FuelTankCountNumeric', 'FuelTankMaterialCode'] },
  { group: 'Tankage', label: 'Fresh Water', field: 'WaterTankCapacityMeasure', compute: tank('Water'), uses: ['WaterTankCountNumeric', 'WaterTankMaterialCode'] },
  { group: 'Tankage', label: 'Holding', field: 'HoldingTankCapacityMeasure', compute: tank('Holding'), uses: ['HoldingTankCountNumeric', 'HoldingTankMaterialCode'] },
  { group: 'Tankage', label: 'Water Heater', field: 'WaterHeaterCapacityMeasure', compute: waterHeater, uses: ['WaterHeaterCountNumeric', 'WaterHeaterMaterialCode'] },

  // Accommodations
  { group: 'Accommodations', label: 'Cabins', field: 'CabinsCountNumeric', format: count },
  { group: 'Accommodations', label: 'Heads', field: 'HeadsCountNumeric', format: count },
  { group: 'Accommodations', label: 'Bathrooms', field: 'BathroomsCountNumeric', format: count },
  { group: 'Accommodations', label: 'Berths', field: 'BerthsCountNumeric', compute: berths, uses: ['SingleBerthsCountNumeric', 'DoubleBerthsCountNumeric', 'TwinBerthsCountNumeric'] },
  { group: 'Accommodations', label: 'Max Passengers', field: 'MaximumNumberOfPassengersNumeric', format: count },
  { group: 'Accommodations', label: 'Convertible Saloon', field: 'ConvertibleSaloonIndicator', format: yes },

  // Equipment & Systems
  { group: 'Equipment & Systems', label: 'Windlass', field: 'WindlassTypeCode', format: label },
  { group: 'Equipment & Systems', label: 'Electrical', field: 'ElectricalCircuitMeasure' },
  { group: 'Equipment & Systems', label: 'Trim Tabs', field: 'TrimTabsIndicator', format: yes },
  { group: 'Equipment & Systems', label: 'Rope Cutters', field: 'RopeCutterIndicator', format: yes },
  { group: 'Equipment & Systems', label: 'Liferaft Capacity', field: 'LiferaftCapacityNumeric', format: (v) => { const m = measure(v); return m ? `${fmtNum(m.n, 0)} ${m.n === 1 ? 'person' : 'people'}` : undefined; } },
];

/* ------------------------------------------------ building the table */

export interface SpecGroupRows { heading: SpecGroup; rows: SpecRow[] }

const toRows = (f: SpecField, out: Out | SpecRow[]): SpecRow[] => {
  if (Array.isArray(out)) return out.filter((r) => text(r.value));
  if (out == null) return [];
  const row = typeof out === 'string' ? { value: out } : out;
  const value = text(row.value);
  return value ? [{ label: f.label, ...row, value }] : [];
};

/** The listing's spec table: only the groups and rows this boat actually has. */
export function buildSpecGroups(it: Record<string, any>, ctx: SpecContext = {}): SpecGroupRows[] {
  const byGroup = new Map<SpecGroup, SpecRow[]>();
  for (const f of SPEC_FIELDS) {
    let out: Out | SpecRow[];
    try {
      out = f.compute ? f.compute(it, ctx) : f.format ? f.format(it[f.field], it, ctx) : text(it[f.field]);
    } catch {
      out = undefined; // one odd value must never take the table down
    }
    const rows = toRows(f, out);
    if (rows.length) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), ...rows]);
  }
  return SPEC_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({ heading: g, rows: byGroup.get(g)! }));
}

/* ------------------------------------------------ unmapped fields (dev) */

/** Fields the page uses elsewhere (title, photos, description) or that are internal. */
const HANDLED = new Set([
  'DocumentID', 'BoatName', 'ListingTitle', 'Images', 'GeneralBoatDescription', 'AdditionalDetailDescription',
  'PlsDisclaimer', 'ListingType', 'SalesStatus', 'CompanyName', 'CoOpIndicator',
  // Deliberately not shown.
  'BoatHullID', 'StockNumber', 'Videos', 'EmbeddedVideo', 'ExternalLink',
  // Never a total: engine hours are shown per engine, from Engines[].Hours (FYI, 2026-11-16).
  'TotalEngineHoursNumeric',
]);
const INTERNAL_RE = /(ID$|^Has|NoCaseAlnumOnly$|^Norm|TimeStamp$|Date$|DateTime$|Present$|^Service$|^Marketing$|^Owner$|^SalesRep$|^Office$|^Source$|Indicator$|^IsAvailable|^ProvisioningEventName$|Flag$)/;
const MAPPED = new Set(SPEC_FIELDS.flatMap((f) => [f.field, ...(f.uses ?? [])]));

/**
 * Non-empty scalar fields the API returned that the spec map does not know —
 * logged in development so they can be added to SPEC_FIELDS. Never rendered.
 */
export function unmappedFields(it: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(it)) {
    if (MAPPED.has(k) || HANDLED.has(k) || INTERNAL_RE.test(k)) continue;
    if (v == null || typeof v === 'object') continue;
    if (typeof v === 'boolean' ? !v : !text(v)) continue;
    out[k] = v;
  }
  return out;
}
