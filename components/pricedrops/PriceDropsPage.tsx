import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, TrendingDown, MapPin, Ruler, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

// Genuine price reductions recorded by the daily price-snapshot cron
// (api/cron/price-snapshot → KV → /api/yachts/price-drops). The feed itself
// has no reliable prior asking price, so drops are detected by comparing
// day-over-day snapshots.
interface Drop {
  id: string; make: string; model: string; year: number;
  image: string; oldPrice: number; newPrice: number; pct: number; date: string;
}

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function PriceDropsPage() {
  const [allDrops, setAllDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/yachts/price-drops');
        const data = await res.json();
        const drops: Drop[] = Array.isArray(data?.drops) ? data.drops : [];
        drops.sort((a, b) => b.pct - a.pct);
        setAllDrops(drops);
      } catch (err) {
        console.error('Failed to load price drops:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPages = Math.ceil(allDrops.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const paged = allDrops.slice(start, start + PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-5 h-5 text-green-400" />
          <h1 className="font-serif text-2xl text-white">Price Drops</h1>
        </div>
        <p className="text-white/50 text-sm">Yachts with recently reduced prices, sorted by biggest drop.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-yacht-brand animate-spin" />
          <span className="text-white/50 ml-3 text-sm">Finding price drops...</span>
        </div>
      ) : allDrops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingDown className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-white/50 text-sm">No price drops recorded yet.</p>
          <p className="text-white/30 text-xs mt-1">We track asking prices daily — reductions appear here as brokers adjust.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paged.map(drop => {
              const title = [drop.year || '', drop.make, drop.model].filter(Boolean).join(' ') || 'Yacht';
              return (
                <div key={drop.id} className="bg-white/5 border border-white/10 rounded-none overflow-hidden hover:border-white/20 transition-all group relative">
                  <Link to={`/app/yacht/${drop.id}`} className="block relative aspect-[4/3] overflow-hidden">
                    {drop.image ? (
                      <img src={drop.image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <span className="text-white/20 text-sm">No Image</span>
                      </div>
                    )}
                    {drop.pct > 0 && (
                      <span className="absolute top-2 left-2 bg-green-500/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 z-10">
                        <TrendingDown className="w-3 h-3" />
                        -{drop.pct}%
                      </span>
                    )}
                  </Link>

                  <Link to={`/app/yacht/${drop.id}`} className="block p-3">
                    <h3 className="text-white font-medium text-sm line-clamp-1 mb-1">{title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-yacht-cream font-bold text-lg">{usd(drop.newPrice)}</span>
                      <span className="text-white/30 text-sm line-through">{usd(drop.oldPrice)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-white/40 text-xs">
                      {drop.year ? (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{drop.year}</span>
                      ) : null}
                      <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{drop.make}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Reduced {drop.date}</span>
                    </div>
                  </Link>
                </div>
              );
            })}
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
