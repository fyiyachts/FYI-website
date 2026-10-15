import type { PineconeStructuredFilters } from '../../types/search';
import { CONDITION_OPTIONS, HULL_MATERIAL_OPTIONS, FUEL_TYPE_OPTIONS } from '../../utils/constants';
import { SlidersHorizontal } from 'lucide-react';

interface Props {
  filters: PineconeStructuredFilters;
  onChange: (filters: PineconeStructuredFilters) => void;
}

export default function FilterPanel({ filters, onChange }: Props) {
  const update = (key: keyof PineconeStructuredFilters, value: any) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const hasActive = Object.values(filters).some(v => v != null && v !== '' && v !== undefined);

  return (
    <div className="bg-white/5 border border-white/10 rounded-none p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-yacht-teal" />
          <span className="text-white/80 text-sm font-medium">Filters</span>
        </div>
        {hasActive && (
          <button onClick={() => onChange({})} className="text-yacht-brand text-xs hover:text-yacht-brand/80">
            Clear all
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-white/40 text-xs block mb-1">Min Price</label>
          <input
            type="number"
            value={filters.minPrice ?? ''}
            onChange={e => update('minPrice', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="$0"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Max Price</label>
          <input
            type="number"
            value={filters.maxPrice ?? ''}
            onChange={e => update('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Any"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Min Length (ft)</label>
          <input
            type="number"
            value={filters.minLength ?? ''}
            onChange={e => update('minLength', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Max Length (ft)</label>
          <input
            type="number"
            value={filters.maxLength ?? ''}
            onChange={e => update('maxLength', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Any"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Min Year</label>
          <input
            type="number"
            value={filters.minYear ?? ''}
            onChange={e => update('minYear', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Any"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Max Year</label>
          <input
            type="number"
            value={filters.maxYear ?? ''}
            onChange={e => update('maxYear', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Any"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Make</label>
          <input
            type="text"
            value={filters.make ?? ''}
            onChange={e => update('make', e.target.value || undefined)}
            placeholder="e.g. Viking"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Condition</label>
          <select
            value={filters.condition ?? ''}
            onChange={e => update('condition', e.target.value || undefined)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yacht-brand/30"
          >
            <option value="">Any</option>
            {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">Hull Material</label>
          <select
            value={filters.hullMaterial ?? ''}
            onChange={e => update('hullMaterial', e.target.value || undefined)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yacht-brand/30"
          >
            <option value="">Any</option>
            {HULL_MATERIAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1">State</label>
          <input
            type="text"
            value={filters.state ?? ''}
            onChange={e => update('state', e.target.value || undefined)}
            placeholder="e.g. FL"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yacht-brand/30"
          />
        </div>
      </div>
    </div>
  );
}
