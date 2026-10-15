import { useState, useEffect } from 'react';
import { BarChart3, Check } from 'lucide-react';
import { isInCompare, addToCompare, removeFromCompare } from '../../services/storageService';

interface Props {
  boatId: number;
  size?: 'sm' | 'md';
}

export default function CompareButton({ boatId, size = 'sm' }: Props) {
  const [inCompare, setInCompare] = useState(false);

  useEffect(() => {
    setInCompare(isInCompare(boatId));
  }, [boatId]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(boatId);
      setInCompare(false);
    } else {
      const added = addToCompare(boatId);
      setInCompare(added);
    }
  };

  const cls = size === 'sm' ? 'p-1.5 rounded-lg' : 'p-2 rounded-lg';

  return (
    <button
      onClick={toggle}
      className={`${cls} bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors ${inCompare ? 'text-yacht-brand' : 'text-white/60 hover:text-white'}`}
      title={inCompare ? 'Remove from compare' : 'Add to compare'}
    >
      {inCompare ? <Check className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} /> : <BarChart3 className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />}
    </button>
  );
}
