import type { UnderstoodFilters } from './briannaClient';

// Turns the filters Brianna applied into human-readable, removable chips.
// Each chip carries a `removalPhrase` — the plain-English correction we send
// back to Brianna when the visitor removes it, so nothing is silently dropped
// and the model re-runs the search honestly.

export interface FilterChip {
  key: string;
  label: string;        // what the visitor sees, e.g. "Under $100k"
  group: string;        // Budget / Type / Length / Year / Make / Condition / Keywords
  removalPhrase: string; // sent to Brianna on ✕
}

const usd = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
};

export function toChips(f: UnderstoodFilters | undefined): FilterChip[] {
  if (!f) return [];
  const chips: FilterChip[] = [];

  if (f.min_price != null && f.max_price != null)
    chips.push({ key: 'price', group: 'Budget', label: `${usd(f.min_price)}–${usd(f.max_price)}`, removalPhrase: 'Remove the budget/price filter.' });
  else if (f.max_price != null)
    chips.push({ key: 'price', group: 'Budget', label: `Under ${usd(f.max_price)}`, removalPhrase: 'Remove the maximum price limit.' });
  else if (f.min_price != null)
    chips.push({ key: 'price', group: 'Budget', label: `Over ${usd(f.min_price)}`, removalPhrase: 'Remove the minimum price filter.' });

  if (f.make) chips.push({ key: 'make', group: 'Make', label: f.make, removalPhrase: `Don't limit to ${f.make} — show other builders too.` });
  if (f.category) chips.push({ key: 'category', group: 'Type', label: f.category, removalPhrase: `Remove the ${f.category} filter.` });
  if (f.condition) chips.push({ key: 'condition', group: 'Condition', label: f.condition, removalPhrase: `Remove the ${f.condition} condition filter.` });

  if (f.min_length_ft != null && f.max_length_ft != null)
    chips.push({ key: 'length', group: 'Length', label: `${f.min_length_ft}–${f.max_length_ft} ft`, removalPhrase: 'Remove the length filter.' });
  else if (f.min_length_ft != null)
    chips.push({ key: 'length', group: 'Length', label: `${f.min_length_ft} ft +`, removalPhrase: 'Remove the minimum length filter.' });
  else if (f.max_length_ft != null)
    chips.push({ key: 'length', group: 'Length', label: `Up to ${f.max_length_ft} ft`, removalPhrase: 'Remove the maximum length filter.' });

  if (f.min_year != null && f.max_year != null)
    chips.push({ key: 'year', group: 'Year', label: `${f.min_year}–${f.max_year}`, removalPhrase: 'Remove the year filter.' });
  else if (f.min_year != null)
    chips.push({ key: 'year', group: 'Year', label: `${f.min_year} & newer`, removalPhrase: 'Remove the year filter.' });
  else if (f.max_year != null)
    chips.push({ key: 'year', group: 'Year', label: `${f.max_year} & older`, removalPhrase: 'Remove the year filter.' });

  const q = (f.query || '').trim();
  if (q && q.length <= 40) chips.push({ key: 'query', group: 'Keywords', label: `“${q}”`, removalPhrase: `Ignore the keywords "${q}".` });

  return chips;
}
