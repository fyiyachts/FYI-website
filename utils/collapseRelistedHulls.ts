/**
 * Collapse records that are the same hull relisted under a near-identical year.
 *
 * The BoatsGroup feed can carry one hull twice under different DocumentIDs with
 * identical make/model/length/price — a relist, or a year typo. Those should
 * render as one card.
 *
 * A build year and a refit year are a different case, and the gap is what tells
 * them apart. FYI's 61' Garlington is listed as both 1997 (build) and 2022
 * (refit) on purpose, because that is how the brokerage lists it on Boat
 * Wizard; collapsing on make/model/length/price alone hid one of the two
 * listings they had deliberately created (client, 2026-09-16).
 *
 * So the collapse now needs the years to be close as well. Same year or one
 * apart is a relist; decades apart is two listings someone meant to have.
 */

/** Years this far apart or closer are treated as the same hull relisted. */
export const MAX_RELIST_YEAR_GAP = 1;

export function collapseRelistedHulls<T>(
  items: T[],
  keyOf: (item: T) => string,
  yearOf: (item: T) => number,
): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const kept: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    // Oldest first: the build year is the one worth keeping when two records
    // really are one hull, and it makes the walk below a single pass.
    // A record with no usable year sorts last and collapses as it did before
    // this guard existed — without a year there is nothing to measure.
    const year = (item: T) => {
      const n = yearOf(item);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };
    const sorted = [...group].sort((a, b) => year(a) - year(b));

    let anchor = sorted[0];
    kept.push(anchor);
    for (const item of sorted.slice(1)) {
      const ya = year(anchor);
      const yi = year(item);
      const sameHull = !Number.isFinite(ya) || !Number.isFinite(yi)
        ? true
        : yi - ya <= MAX_RELIST_YEAR_GAP;
      if (!sameHull) {
        anchor = item;
        kept.push(item);
      }
    }
  }
  return kept;
}
