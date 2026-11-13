// Titles, meta descriptions and JSON-LD for a listing — one definition for
// the server render (api/listing.ts) and the React page, so the two never
// disagree about what a listing is called.

import { formatMoney, listPrice } from './price.js';
import { listingLocation, measure, fmtNum } from './specFields.js';
import type { ListingContent } from './listingContent.js';

export interface ListingImage { url: string; alt: string }

export interface ListingSeo {
  /** "2017 Monte Carlo Yachts MC5" — year, make, model. */
  ymm: string;
  /** The boat's given name, when it has one that isn't just the model. */
  boatName: string;
  /** Page H1: `2021 Custom Glovertown Shipyard “ANNE S PIERCE”`. */
  h1: string;
  /** "<Year> <Make> <Model> <LOA> for Sale in <City, State> | FYI Yachts". */
  pageTitle: string;
  metaDescription: string;
  /** "$599,900" or "Price on request". */
  priceText: string;
  location: string;
  lengthFt?: number;
  images: ListingImage[];
}

const clip = (s: string, max: number): string => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s,;:.–—-]+$/, '')}…`;
};

/** Absolute photo URLs with alt text: the feed's caption, else "Year Make Model – photo N". */
export function listingImages(it: Record<string, any>, site: string, ymm: string): ListingImage[] {
  const out: ListingImage[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(it.Images) ? it.Images : []) {
    let url: string = typeof x === 'string' ? x : x?.Uri || x?.url || '';
    if (!url) continue;
    // Hand-entered listings self-host their photos root-relative.
    if (url.startsWith('/')) url = `${site}${url}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const caption = typeof x === 'object' && typeof x?.Caption === 'string' ? x.Caption.replace(/\s+/g, ' ').trim() : '';
    out.push({ url, alt: caption || `${ymm} – photo ${out.length + 1}` });
  }
  return out;
}

export function buildListingSeo(it: Record<string, any>, content: ListingContent, site: string): ListingSeo {
  const ymmRaw = [it.ModelYear, it.MakeString, it.Model].filter(Boolean).join(' ').trim();
  const name = String(it.BoatName || '').trim();
  const ymm = ymmRaw || name || 'Yacht';
  const boatName = name && ymmRaw && !ymmRaw.toLowerCase().includes(name.toLowerCase()) ? name : '';
  const len = measure(it.LengthOverall) ?? measure(it.NominalLength);
  const lengthFt = len ? (/^m/.test(len.unit) ? len.n / 0.3048 : len.n) : undefined;
  const location = listingLocation(it) || '';
  const priceText = formatMoney(listPrice(it));

  const pageTitle = [
    ymm,
    lengthFt ? `${fmtNum(lengthFt, 0)} ft` : '',
    boatName ? `“${boatName}”` : '',
    location ? `for Sale in ${location}` : 'for Sale',
    '| FYI Yachts',
  ].filter(Boolean).join(' ');

  const tail = [priceText, location].filter(Boolean).join(' · ');
  const lead = content.descriptionText
    ? clip(content.descriptionText, 155)
    : `${ymm}${boatName ? ` “${boatName}”` : ''} for sale with FYI Yachts (Florida Yachts International), Miami.`;
  const metaDescription = `${lead} ${tail}.`.replace(/\s+/g, ' ').trim();

  return {
    ymm, boatName,
    h1: boatName ? `${ymm} “${boatName}”` : ymm,
    pageTitle, metaDescription, priceText, location, lengthFt,
    images: listingImages(it, site, ymm),
  };
}

/**
 * Product (+ Vehicle) JSON-LD. Offers only when the price is shown: a hidden
 * price appears nowhere in the markup. Google requires offers (or reviews) on
 * a Product, so a price-on-request boat is typed Vehicle alone — valid
 * schema.org, and not an "invalid Product" in Search Console.
 */
export function listingJsonLd(it: Record<string, any>, content: ListingContent, seo: ListingSeo, canonical: string): Record<string, unknown> {
  const price = listPrice(it);
  const sold = /sold/i.test(String(it.SalesStatus ?? ''));
  const year = measure(it.ModelYear)?.n;
  return {
    '@context': 'https://schema.org',
    '@type': price ? ['Product', 'Vehicle'] : 'Vehicle',
    name: seo.h1,
    url: canonical,
    ...(content.descriptionText ? { description: clip(content.descriptionText, 500) } : {}),
    ...(seo.images.length ? { image: seo.images.map((i) => i.url) } : {}),
    ...(it.MakeString ? { brand: { '@type': 'Brand', name: String(it.MakeString) } } : {}),
    ...(it.Model ? { model: String(it.Model) } : {}),
    ...(year ? { productionDate: String(year), vehicleModelDate: String(year) } : {}),
    ...(price ? {
      offers: {
        '@type': 'Offer',
        price: price.amount,
        priceCurrency: price.currency,
        availability: sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        itemCondition: String(it.SaleClassCode ?? '').toLowerCase() === 'new'
          ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
        url: canonical,
        seller: { '@type': 'Organization', name: 'FYI Yachts', url: 'https://fyiyachts.com' },
      },
    } : {}),
  };
}
