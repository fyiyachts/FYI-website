import { useState, useEffect } from 'react';
import type { PineconeBoat } from '../../types/search';
import YachtCard from '../listing/YachtCard';
import { Loader2, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

interface Props {
  results: PineconeBoat[];
  loading: boolean;
  searched: boolean;
  showingDefault?: boolean;
}

export default function SearchResults({ results, loading, searched, showingDefault }: Props) {
  const [page, setPage] = useState(1);

  // Reset to page 1 when results change
  useEffect(() => { setPage(1); }, [results]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-yacht-brand animate-spin" />
        <span className="text-white/50 ml-3 text-sm">{showingDefault ? 'Loading listings...' : 'Searching...'}</span>
      </div>
    );
  }

  if (searched && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <SearchX className="w-12 h-12 text-white/20 mb-3" />
        <p className="text-white/50 text-sm">No yachts found. Try a different search or adjust your filters.</p>
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-white/30 text-sm">Enter a search query or click a vibe chip to get started.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const paged = results.slice(start, start + PAGE_SIZE);

  return (
    <div>
      {showingDefault && (
        <div className="mb-4 mt-2">
          <h2 className="text-white/70 text-sm font-medium">Browse Listings — Largest to Smallest</h2>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {paged.map(boat => (
          <YachtCard key={boat.id} boat={boat} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 mb-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                p === page
                  ? 'bg-yacht-brand text-white font-semibold'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
