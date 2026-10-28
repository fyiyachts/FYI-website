export interface PineconeBoat {
  id: string;
  score: number;
  documentId: string;
  boatName?: string;
  make?: string;
  model?: string;
  year?: number;
  length?: number;
  /** USD-equivalent asking price (NormPrice): sorting, filters, finance maths. */
  price?: number;
  /** Asking price in the listing's own currency, for display (see formatBoatPrice). */
  listPrice?: { amount: number; currency: string };
  category?: string;
  classCode?: string;
  hullMaterial?: string;
  condition?: string;
  location?: { city?: string; state?: string; country?: string };
  engines?: string;
  companyName?: string;
  images?: string[];
  listingUrl?: string;
  listingDate?: number;
  rawMetadata: Record<string, any>;
}

export interface PineconeStructuredFilters {
  minPrice?: number;
  maxPrice?: number;
  minLength?: number;
  maxLength?: number;
  minYear?: number;
  maxYear?: number;
  make?: string;
  state?: string;
  hullMaterial?: string;
  condition?: string;
}

export interface SmartQueryIntent {
  semanticQuery: string;
  sortBy?: 'length' | 'price' | 'year';
  sortDir: 'desc' | 'asc';
  limit?: number;
  makeFilter?: string;
  classFilter?: string;
}
