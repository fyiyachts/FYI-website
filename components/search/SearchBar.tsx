import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface Props {
  onSearch: (query: string) => void;
  loading: boolean;
}

export default function SearchBar({ onSearch, loading }: Props) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-yacht-teal/60" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Try "5 largest Vikings" or "family cruiser under $500k"'
          className="w-full bg-white/5 border border-white/15 rounded-none pl-12 pr-28 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-yacht-teal/50 focus:ring-1 focus:ring-yacht-teal/25 transition-all text-base"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-yacht-brand hover:bg-yacht-brand/90 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </div>
    </form>
  );
}
