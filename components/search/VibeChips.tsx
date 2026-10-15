import { Sparkles } from 'lucide-react';
import { VIBE_CHIPS } from '../../utils/constants';

interface Props {
  onVibeClick: (query: string) => void;
}

export default function VibeChips({ onVibeClick }: Props) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-yacht-teal" />
        <span className="text-yacht-teal/80 text-xs font-medium uppercase tracking-wider">Vibe Search</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {VIBE_CHIPS.map(chip => (
          <button
            key={chip.label}
            onClick={() => onVibeClick(chip.query)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-yacht-teal/10 text-yacht-teal border border-yacht-teal/20 hover:bg-yacht-teal/20 hover:border-yacht-teal/40 transition-all"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
