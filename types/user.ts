export interface SavedBoat {
  id: number;
  documentId: string;
  title: string;
  price: string;
  image: string;
  specs: { length?: string; year?: string; make?: string; model?: string };
  location?: string;
  savedAt: number;
  priceAtSave: string;
}

export interface SavedSearch {
  id: string;
  query: string;
  filters: Record<string, any>;
  alertsEnabled: boolean;
  emailFrequency?: 'daily' | 'weekly' | 'off';
  createdAt: number;
  lastCheckedAt?: number;
}

export interface UserNote {
  boatId: string;
  text: string;
  updatedAt: number;
}

export interface PriceSnapshot {
  price: string;
  date: number;
}

export interface AlertSubscription {
  email: string;
  savedBoats: Array<{ id: number; title: string; priceAtSubscribe: string }>;
  savedSearches: Array<{ id: string; query: string; filters: Record<string, any>; lastResultIds: string[] }>;
  updatedAt: number;
}

export interface RecentlyViewedEntry {
  id: number;
  documentId: string;
  title: string;
  price: string;
  image: string;
  viewedAt: number;
}

export interface UserProfile {
  name: string;
  phone: string;
  profileImage: string;
}
