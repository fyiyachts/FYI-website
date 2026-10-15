import { useState, useEffect } from 'react';
import { fetchYachtInventory } from '../../services/databaseService';
import { yachtListingToPineconeBoat } from '../../utils/yachtAdapter';
import type { PineconeBoat } from '../../types/search';
import YachtCard from '../listing/YachtCard';
import { Loader2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export default function NewestPage() {
  const [boats, setBoats] = useState<PineconeBoat[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const result = await fetchYachtInventory(1, 100, { dateSort: 'most-recent' });
        setBoats(result.items.map(yachtListingToPineconeBoat));
      } catch (err) {
        console.error('Failed to load newest listings:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPages = Math.ceil(boats.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const paged = boats.slice(start, start + PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5 text-yacht-brand" />
          <h1 className="font-serif text-2xl text-white">Newest Listings</h1>
        </div>
        <p className="text-white/50 text-sm">Recently listed yachts, sorted by listing date.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-yacht-brand animate-spin" />
          <span className="text-white/50 ml-3 text-sm">Loading newest listings...</span>
        </div>
      ) : boats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-white/50 text-sm">No listings found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paged.map(boat => (
              <YachtCard key={boat.id} boat={boat} showDaysListed />
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
        </>
      )}
    </div>
  );
}
