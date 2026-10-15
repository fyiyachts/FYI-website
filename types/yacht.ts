export interface YachtListing {
  id: number;
  title: string;
  permalink: string;
  price: string;
  previousPrice?: string;
  isPriceReduced?: boolean;
  image: string;
  /** Full gallery (all feed Images), first entry matches `image`. */
  images?: string[];
  postedAt?: string;
  location?: string;
  brokerageId?: string;
  companyName?: string;
  specs: {
    length?: string;
    year?: string;
    make?: string;
    model?: string;
  };
}

export interface YachtResponse {
  items: YachtListing[];
  total: number;
  pageSize: number;
}

export interface YachtFilters {
  keyword?: string;
  make?: string;
  boatName?: string;
  yearMin?: string;
  yearMax?: string;
  lengthMin?: string;
  lengthMax?: string;
  priceMin?: string;
  priceMax?: string;
  dateSort?: 'most-recent' | 'oldest';
  priceReducedOnly?: boolean;
  condition?: string;
  boatCategory?: string;
  boatClass?: string;
  hullMaterial?: string;
  state?: string;
  country?: string;
  engineType?: string;
  fuelType?: string;
  engineCount?: string;
}
