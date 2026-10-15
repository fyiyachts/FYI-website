import type { PineconeBoat } from '../../types/search';
import { formatPrice } from '../../utils/formatters';
import { TrendingUp, Ship, DollarSign, Ruler } from 'lucide-react';

interface Props {
  results: PineconeBoat[];
  query: string;
}

export default function MarketSnapshot({ results, query }: Props) {
  if (results.length === 0) return null;

  const withPrice = results.filter(b => b.price && b.price > 0);
  const avgPrice = withPrice.length > 0 ? withPrice.reduce((s, b) => s + b.price!, 0) / withPrice.length : 0;
  const withLength = results.filter(b => b.length && b.length > 0);
  const avgLength = withLength.length > 0 ? withLength.reduce((s, b) => s + b.length!, 0) / withLength.length : 0;
  const minPrice = withPrice.length > 0 ? Math.min(...withPrice.map(b => b.price!)) : 0;
  const maxPrice = withPrice.length > 0 ? Math.max(...withPrice.map(b => b.price!)) : 0;

  const stats = [
    { icon: Ship, label: 'Listings', value: results.length.toString(), color: 'text-yacht-teal' },
    { icon: DollarSign, label: 'Avg Price', value: avgPrice > 0 ? formatPrice(avgPrice) : 'N/A', color: 'text-yacht-brand' },
    { icon: TrendingUp, label: 'Price Range', value: minPrice > 0 ? `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}` : 'N/A', color: 'text-yacht-teal' },
    { icon: Ruler, label: 'Avg Length', value: avgLength > 0 ? `${Math.round(avgLength)}'` : 'N/A', color: 'text-yacht-brand' },
  ];

  return (
    <div className="bg-yacht-teal/5 border border-yacht-teal/15 rounded-none p-4 mt-4">
      <p className="text-yacht-teal/60 text-xs uppercase tracking-wider mb-3">Market Snapshot — "{query}"</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-white/40 text-xs">{label}</span>
            </div>
            <p className="text-white font-semibold text-sm">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
