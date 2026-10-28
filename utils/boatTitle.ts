/**
 * The card title for a boat: "{Year} {Make} {Model}" — "2021 Hatteras GT65".
 * Cards lead with what the boat IS; its given name ("On the DL") is a
 * secondary line under the title (client, 2026-10-27). Missing parts are
 * skipped, and a model that already starts with the make ("Azimut 50" under
 * make "Azimut") doesn't repeat it. Empty when there is nothing to build from,
 * so callers can fall back (`|| boatName || 'Yacht'`).
 */
export function yachtTitle(
  year: number | string | undefined | null,
  make: string | undefined | null,
  model: string | undefined | null,
): string {
  const mk = (make ?? '').trim();
  let md = (model ?? '').trim();
  if (mk && md.toLowerCase().startsWith(`${mk.toLowerCase()} `)) md = md.slice(mk.length).trim();
  // A year alone ("2020") says nothing about the boat: let the caller fall
  // back to its name instead.
  if (!mk && !md) return '';
  const yr = year != null && String(year).trim() && String(year) !== '—' ? String(year).trim() : '';
  return [yr, mk, md].filter(Boolean).join(' ');
}

/**
 * The boat's given name for the secondary line, or undefined when it has none
 * or the name only repeats the title.
 */
export function boatNameLine(name: string | undefined | null, title: string): string | undefined {
  const n = (name ?? '').trim();
  // No year/make/model title means the name IS the title: don't repeat it.
  if (!n || !title.trim()) return undefined;
  const t = title.toLowerCase();
  return n.toLowerCase() === t || t.endsWith(n.toLowerCase()) ? undefined : n;
}
