import type { YachtListing } from '../types/yacht';
import type { PineconeBoat } from '../types/search';

/**
 * Converts a YachtListing (from upstream API / databaseService)
 * into a PineconeBoat shape so YachtCard and other components work unchanged.
 */
export function yachtListingToPineconeBoat(listing: YachtListing): PineconeBoat {
  const lengthNum = listing.specs.length ? parseFloat(listing.specs.length.replace(/[^0-9.]/g, '')) : undefined;
  const yearNum = listing.specs.year ? parseInt(listing.specs.year, 10) : undefined;
  const priceNum = listing.price ? parseFloat(listing.price.replace(/[^0-9.]/g, '')) : undefined;

  // Parse location string "City, State" into object
  let location: PineconeBoat['location'] | undefined;
  if (listing.location) {
    const parts = listing.location.split(',').map(s => s.trim());
    location = { city: parts[0], state: parts[1] };
  }

  return {
    id: String(listing.id),
    score: 0,
    documentId: String(listing.id),
    boatName: listing.title,
    make: listing.specs.make || undefined,
    model: listing.specs.model || undefined,
    year: yearNum && !isNaN(yearNum) ? yearNum : undefined,
    length: lengthNum && !isNaN(lengthNum) ? lengthNum : undefined,
    price: priceNum && !isNaN(priceNum) ? priceNum : undefined,
    location,
    companyName: listing.companyName,
    images: listing.images?.length ? listing.images : listing.image ? [listing.image] : [],
    listingUrl: listing.permalink,
    listingDate: listing.postedAt ? new Date(listing.postedAt).getTime() : undefined,
    rawMetadata: {},
  };
}
