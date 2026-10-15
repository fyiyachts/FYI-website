import { useState, useCallback, useEffect } from 'react';
import SearchBar from './SearchBar';
import VibeChips from './VibeChips';
import MakeTypeChips from './MakeTypeChips';
import FilterPanel from './FilterPanel';
import SearchResults from './SearchResults';
import MarketSnapshot from './MarketSnapshot';
import type { PineconeBoat, PineconeStructuredFilters } from '../../types/search';
import { smartSearchPinecone } from '../../services/pineconeService';
import { fetchYachtInventory } from '../../services/databaseService';
import { yachtListingToPineconeBoat } from '../../utils/yachtAdapter';
import { saveSearch, getSavedSearches } from '../../services/storageService';
import { syncAlertSubscription } from '../../services/alertService';
import { useAuth } from '../auth/AuthProvider';
import { Bell, Check, ArrowUpDown } from 'lucide-react';

export default function SearchPage() {
  const [results, setResults] = useState<PineconeBoat[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [structuredFilters, setStructuredFilters] = useState<PineconeStructuredFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [defaultBoats, setDefaultBoats] = useState<PineconeBoat[]>([]);
  const [defaultLoading, setDefaultLoading] = useState(true);
  const [searchSaved, setSearchSaved] = useState(false);
  const [sortOption, setSortOption] = useState('price-desc');
  const { email } = useAuth();

  type SortKey = 'price-desc' | 'price-asc' | 'length-desc' | 'length-asc' | 'year-desc' | 'year-asc';
  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'length-desc', label: 'Size: Largest First' },
    { value: 'length-asc', label: 'Size: Smallest First' },
    { value: 'year-desc', label: 'Year: Newest First' },
    { value: 'year-asc', label: 'Year: Oldest First' },
  ];

  const applySortToBoats = (boats: PineconeBoat[]): PineconeBoat[] => {
    const sorted = [...boats];
    const [field, dir] = sortOption.split('-') as [string, string];
    sorted.sort((a, b) => {
      const aVal = (field === 'price' ? a.price : field === 'length' ? a.length : a.year) || 0;
      const bVal = (field === 'price' ? b.price : field === 'length' ? b.length : b.year) || 0;
      return dir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  };

  // Load default boats on mount via upstream API (cheaper than Pinecone)
  useEffect(() => {
    (async () => {
      try {
        const result = await fetchYachtInventory(1, 100, {});
        const boats = result.items.map(yachtListingToPineconeBoat);
        boats.sort((a, b) => (b.price || 0) - (a.price || 0));
        setDefaultBoats(boats);
      } catch (err) {
        console.error('Failed to load default boats:', err);
      } finally {
        setDefaultLoading(false);
      }
    })();
  }, []);

  const runSearch = useCallback(async (query: string, cf?: string | null, sf?: PineconeStructuredFilters) => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setCurrentQuery(query);
    setSearchSaved(false);
    try {
      const { boats } = await smartSearchPinecone(query, 100, undefined, cf ?? classFilter, sf ?? structuredFilters);
      setResults(boats);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [classFilter, structuredFilters]);

  const handleSearch = (query: string) => runSearch(query);
  const handleVibeClick = (query: string) => runSearch(query);
  const handleMakeClick = (make: string) => runSearch(make);

  const handleClassChange = (cls: string | null) => {
    setClassFilter(cls);
    if (currentQuery) runSearch(currentQuery, cls);
  };

  const handleFiltersChange = (filters: PineconeStructuredFilters) => {
    setStructuredFilters(filters);
    if (currentQuery) runSearch(currentQuery, classFilter, filters);
  };

  const handleSaveSearchAlert = () => {
    if (!currentQuery.trim()) return;
    const existing = getSavedSearches();
    if (existing.some(s => s.query === currentQuery)) { setSearchSaved(true); return; }
    saveSearch({
      id: `search-${Date.now()}`,
      query: currentQuery,
      filters: { ...structuredFilters, classFilter },
      alertsEnabled: true,
      createdAt: Date.now(),
    });
    setSearchSaved(true);
    if (email) syncAlertSubscription(email).catch(() => {});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-white mb-1">AI-Powered Search</h1>
        <p className="text-white/50 text-sm">Search thousands of yacht listings with natural language.</p>
      </div>

      <SearchBar onSearch={handleSearch} loading={loading} />
      <VibeChips onVibeClick={handleVibeClick} />
      <MakeTypeChips onMakeClick={handleMakeClick} onClassChange={handleClassChange} activeClass={classFilter} />

      <div className="flex items-center justify-between mt-4 mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-white/50 hover:text-white text-sm transition-colors"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <div className="relative flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-white/40" />
            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg text-white/70 text-xs px-2 py-1.5 pr-6 appearance-none cursor-pointer hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:border-white/20"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-yacht-900 text-white">{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        {searched && !loading && (
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-sm">{results.length} result{results.length !== 1 ? 's' : ''}</span>
            <button
              onClick={handleSaveSearchAlert}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                searchSaved
                  ? 'bg-yacht-brand/10 text-yacht-brand border border-yacht-brand/20'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              {searchSaved ? <Check className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              {searchSaved ? 'Alert Saved' : 'Alert Me'}
            </button>
          </div>
        )}
      </div>

      {showFilters && <FilterPanel filters={structuredFilters} onChange={handleFiltersChange} />}

      {searched && <MarketSnapshot results={results} query={currentQuery} />}

      <SearchResults
        results={applySortToBoats(searched ? results : defaultBoats)}
        loading={searched ? loading : defaultLoading}
        searched={searched || defaultBoats.length > 0}
        showingDefault={!searched && defaultBoats.length > 0}
      />
    </div>
  );
}
