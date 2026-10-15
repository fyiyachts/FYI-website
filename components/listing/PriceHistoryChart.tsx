import { getPriceSnapshots } from '../../services/storageService';
import { formatDate, parsePriceNumber } from '../../utils/formatters';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown } from 'lucide-react';

interface Props {
  boatId: string;
  currentPrice: string;
}

export default function PriceHistoryChart({ boatId, currentPrice }: Props) {
  const allSnapshots = getPriceSnapshots();
  const snapshots = allSnapshots[boatId] || [];

  if (snapshots.length < 2) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-yacht-brand" />
          <h3 className="text-white font-medium text-sm">Price History</h3>
        </div>
        <p className="text-white/30 text-xs">Price tracking started. Visit again to see price trends.</p>
      </div>
    );
  }

  const data = snapshots.map(s => ({
    date: formatDate(s.date),
    price: parsePriceNumber(s.price) || 0,
  }));

  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = Math.max((maxPrice - minPrice) * 0.1, 1000);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="w-4 h-4 text-yacht-brand" />
        <h3 className="text-white font-medium text-sm">Price History</h3>
        <span className="text-white/30 text-xs ml-auto">{snapshots.length} data points</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            domain={[minPrice - padding, maxPrice + padding]}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f2136',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
            formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Price']}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#D4AF37"
            strokeWidth={2}
            dot={{ fill: '#D4AF37', r: 3 }}
            activeDot={{ r: 5, fill: '#D4AF37' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
