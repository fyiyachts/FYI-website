// Photos hidden from specific listings on fyiyachts.com.
//
// For when a photo must come off a listing and BoatWizard can't be edited.
// The photo stays in BoatWizard; the site just doesn't show it. Remove the
// entry once the photos are deleted in BoatWizard (harmless if left: a photo
// no longer in the feed matches nothing).
//
// Photos are matched by file name, not by position: if BoatWizard adds,
// removes or reorders photos, a position would start hiding the wrong one.
// The file name is the last part of the photo's URL; it doesn't change with
// /images/ vs /resize/ or a query string.
//
// Applied by api/yachts/proxy.ts (the listing page, gallery and brochure) and
// api/listing.ts (the server-rendered page crawlers get).

/** The 2012 Azimut Grande 105 "SALE VITA": photos 12, 13, 14, 21, 25 and 26 as of 2026-11-16 (147 photos). */
const SALE_VITA_HIDDEN = [
  '2012-azimut-grande-105-power-9679457-20250505141117367-1_XLARGE.jpg', // #12
  '2012-azimut-grande-105-power-9679457-20250505141127579-1_XLARGE.jpg', // #13
  '2012-azimut-grande-105-power-9679457-20250505141138470-1_XLARGE.jpg', // #14
  '2012-azimut-grande-105-power-9679457-20250505141412399-1_XLARGE.jpg', // #21
  '2012-azimut-grande-105-power-9679457-20250505141515008-1_XLARGE.jpg', // #25
  '2012-azimut-grande-105-power-9679457-20250505141525302-1_XLARGE.jpg', // #26
];

/** DocumentID → file names of the photos to hide. */
const HIDDEN: Record<string, readonly string[]> = {
  // Two listings of the same boat, deliberately; same photos, same order.
  '10391316': SALE_VITA_HIDDEN, // 2012 Azimut Grande 32M
  '10277901': SALE_VITA_HIDDEN, // 2012 Azimut 105
};

const HIDDEN_IDS = Object.keys(HIDDEN);

const fileName = (url: string): string => url.split(/[?#]/)[0].split('/').pop() || '';

const photoUrl = (x: unknown): string =>
  typeof x === 'string' ? x : (x as { Uri?: string; url?: string } | null)?.Uri || (x as { url?: string } | null)?.url || '';

/** Remove the hidden photos from one feed row, in place. Returns the row. */
export function hideListingPhotos<T extends Record<string, any>>(item: T): T {
  const hidden = HIDDEN[String(item?.DocumentID ?? '')];
  if (hidden && Array.isArray(item.Images)) {
    const set = new Set(hidden);
    (item as Record<string, any>).Images = item.Images.filter((x: unknown) => !set.has(fileName(photoUrl(x))));
  }
  return item;
}

/**
 * The same for a feed response body (JSON text with `results`). Untouched —
 * not even re-serialised — unless it mentions one of the listings.
 */
export function hideListingPhotosInBody(body: string): string {
  if (!HIDDEN_IDS.some((id) => body.includes(id))) return body;
  try {
    const data = JSON.parse(body);
    if (!Array.isArray(data?.results)) return body;
    data.results.forEach(hideListingPhotos);
    return JSON.stringify(data);
  } catch {
    return body;
  }
}
