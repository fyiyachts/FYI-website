import { MAKE_CHIPS, CLASS_FILTER_OPTIONS } from '../../utils/constants';

interface Props {
  onMakeClick: (make: string) => void;
  onClassChange: (cls: string | null) => void;
  activeClass: string | null;
}

export default function MakeTypeChips({ onMakeClick, onClassChange, activeClass }: Props) {
  return (
    <div className="mt-3 space-y-3">
      <div>
        <span className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1.5 block">Popular Makes</span>
        <div className="flex flex-wrap gap-1.5">
          {MAKE_CHIPS.map(make => (
            <button
              key={make}
              onClick={() => onMakeClick(make)}
              className="px-2.5 py-1 rounded-full text-xs bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
            >
              {make}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1.5 block">Boat Type</span>
        <div className="flex flex-wrap gap-1.5">
          {CLASS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onClassChange(activeClass === opt.value ? null : opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all ${activeClass === opt.value ? 'bg-yacht-brand/20 text-yacht-brand border-yacht-brand/40' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
