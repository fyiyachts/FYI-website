// Listing prices in their own currency. A feed (or hand-entered) record
// carries the asking price as "845000 EUR" / "7900000.00 USD" in `Price`, and
// a USD-equivalent number in `NormPrice`. Display honours the record's own
// currency ("€845,000"); sorting and price filters use the USD equivalent
// (usdEquivalent) so a euro boat sits in its natural place among dollar ones.
// The displayed price is never converted.
//
// USD records display exactly as before: NormPrice ?? Price, formatted
// "$7,900,000". Shared by the API (listing render, llms-inventory) and the
// client (cards, rails, listing page) — keep it dependency-free.

export interface Money { amount: number; currency: string }

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** The ISO code at the end of a Price string ("845000 EUR" → "EUR"); USD when absent. */
export function priceCurrency(price: unknown): string {
  const m = /\b([A-Za-z]{3})\s*$/.exec(String(price ?? '').trim());
  return m ? m[1].toUpperCase() : 'USD';
}

/** USD-equivalent asking price for sorting and filtering; undefined when hidden or absent. */
export function usdEquivalent(it: Record<string, any>): number | undefined {
  if (it.PriceHideInd) return undefined;
  return num(it.NormPrice) ?? num(it.Price);
}

/** The asking price to show, in the record's own currency; undefined when hidden or absent. */
export function listPrice(it: Record<string, any>): Money | undefined {
  if (it.PriceHideInd) return undefined;
  const currency = priceCurrency(it.Price);
  if (currency !== 'USD') {
    const amount = num(it.Price);
    if (amount) return { amount, currency };
  }
  const usd = usdEquivalent(it);
  return usd ? { amount: usd, currency: 'USD' } : undefined;
}

/** "$7,900,000", "€845,000"; `fallback` when there is no price to show. */
export function formatMoney(m: Money | undefined | null, fallback = 'Price on request'): string {
  if (!m || !Number.isFinite(m.amount) || m.amount <= 0) return fallback;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency, maximumFractionDigits: 0 }).format(m.amount);
  } catch {
    // Not a currency Intl knows: show the code rather than guess a symbol.
    return `${m.currency} ${Math.round(m.amount).toLocaleString('en-US')}`;
  }
}
