import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { isBoatSaved, saveBoat, unsaveBoat } from '../../services/storageService';
import { syncAlertSubscription } from '../../services/alertService';
import { useAuth } from '../auth/AuthProvider';
import type { PineconeBoat } from '../../types/search';
import { formatBoatPrice } from '../../utils/formatters';

interface Props {
  boat: PineconeBoat;
  size?: 'sm' | 'md';
}

export default function SaveButton({ boat, size = 'sm' }: Props) {
  const [saved, setSaved] = useState(false);
  const { email } = useAuth();

  useEffect(() => {
    setSaved(isBoatSaved(Number(boat.documentId)));
  }, [boat.documentId]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = Number(boat.documentId);
    if (saved) {
      unsaveBoat(id);
      setSaved(false);
    } else {
      saveBoat({
        id,
        documentId: boat.documentId,
        title: boat.boatName || [boat.year, boat.make, boat.model].filter(Boolean).join(' ') || 'Unknown',
        price: formatBoatPrice(boat),
        image: boat.images?.[0] || '',
        specs: { length: boat.length ? `${Math.round(boat.length)}` : undefined, year: boat.year ? String(boat.year) : undefined, make: boat.make, model: boat.model },
        location: [boat.location?.city, boat.location?.state].filter(Boolean).join(', ') || undefined,
        savedAt: Date.now(),
        priceAtSave: formatBoatPrice(boat),
      });
      setSaved(true);
    }
    // Sync alerts to backend
    if (email) syncAlertSubscription(email).catch(() => {});
  };

  const cls = size === 'sm'
    ? 'p-1.5 rounded-lg'
    : 'p-2 rounded-lg';

  return (
    <button
      onClick={toggle}
      className={`${cls} bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors ${saved ? 'text-red-400' : 'text-white/60 hover:text-white'}`}
      title={saved ? 'Remove from saved' : 'Save yacht'}
    >
      <Heart className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} ${saved ? 'fill-current' : ''}`} />
    </button>
  );
}
