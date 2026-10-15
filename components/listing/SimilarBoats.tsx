import { useRef } from 'react';
import type { PineconeBoat } from '../../types/search';
import YachtCard from './YachtCard';
import { ChevronLeft, ChevronRight, Anchor } from 'lucide-react';

interface Props {
  boats: PineconeBoat[];
}

export default function SimilarBoats({ boats }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (boats.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Anchor className="w-4 h-4 text-yacht-teal" />
          <h2 className="text-white font-serif font-bold">Similar Yachts</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {boats.slice(0, 8).map(boat => (
          <div key={boat.id} className="shrink-0 w-72 snap-start">
            <YachtCard boat={boat} />
          </div>
        ))}
      </div>
    </div>
  );
}
