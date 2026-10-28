import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PineconeBoat } from '../../types/search';
import { formatPrice } from '../../utils/formatters';
import SaveButton from '../saved/SaveButton';
import CompareButton from '../compare/CompareButton';
import { MapPin, Ruler, Calendar, Bell, BellRing, Clock } from 'lucide-react';
import { hasPriceAlert, setPriceAlert, removePriceAlert } from '../../services/storageService';
import { daysListed } from '../../utils/formatters';
import { boatNameLine, yachtTitle } from '../../utils/boatTitle';
import { optImg } from '../../utils/img';

interface Props {
  boat: PineconeBoat;
  showDaysListed?: boolean;
}

export default function YachtCard({ boat, showDaysListed }: Props) {
  const imageUrl = boat.images?.[0] || '';
  const title = yachtTitle(boat.year, boat.make, boat.model) || boat.boatName || 'Unknown Vessel';
  const nameLine = boatNameLine(boat.boatName, title);
  const location = [boat.location?.city, boat.location?.state].filter(Boolean).join(', ');
  const boatId = String(boat.documentId);

  const [alertActive, setAlertActive] = useState(() => hasPriceAlert(boatId));
  const [showToast, setShowToast] = useState(false);

  const toggleAlert = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (alertActive) {
      removePriceAlert(boatId);
      setAlertActive(false);
    } else {
      setPriceAlert(boatId, {
        title,
        price: boat.price ? formatPrice(boat.price) : 'N/A',
        image: imageUrl,
        savedAt: Date.now(),
      });
      setAlertActive(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all group relative">
      <Link to={`/app/yacht/${boat.documentId}`} state={{ boat }} className="block relative aspect-[4/3] overflow-hidden">
        {imageUrl ? (
          <img src={optImg(imageUrl, 480)} alt={title} width={480} height={360} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <span className="text-white/20 text-sm">No Image</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <SaveButton boat={boat} size="sm" />
          <CompareButton boatId={Number(boat.documentId)} size="sm" />
        </div>
        {/* Days Listed Badge */}
        {showDaysListed && boat.listingDate && (
          <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10">
            <Clock className="w-3 h-3" />
            {(() => {
              const days = daysListed(boat.listingDate!);
              if (days === 0) return 'Listed Today';
              if (days === 1) return '1 day';
              return `${days} days`;
            })()}
          </span>
        )}
        {/* Price Alert Bell */}
        <button
          onClick={toggleAlert}
          title={alertActive ? 'Remove price drop alert' : 'Alert me on price drop'}
          className={`absolute bottom-2 left-2 p-1.5 rounded-full backdrop-blur-sm transition-all z-10 ${
            alertActive
              ? 'bg-yacht-brand text-white ring-2 ring-yacht-brand/40'
              : 'bg-black/40 text-white/60 hover:bg-yacht-brand hover:text-white opacity-0 group-hover:opacity-100'
          }`}
        >
          {alertActive ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
        </button>
      </Link>

      <Link to={`/app/yacht/${boat.documentId}`} state={{ boat }} className="block p-3">
        <h3 className={`text-white font-medium text-sm line-clamp-1 ${nameLine ? '' : 'mb-1'}`}>{title}</h3>
        {nameLine && <p className="mb-1 truncate text-xs font-light italic text-white/50">{nameLine}</p>}
        <p className="text-yacht-cream font-bold text-lg">
          {boat.price ? formatPrice(boat.price) : 'Price on Request'}
        </p>
        <div className="flex items-center gap-3 mt-2 text-white/40 text-xs">
          {boat.length && (
            <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{Math.round(boat.length)}'</span>
          )}
          {boat.year && (
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{boat.year}</span>
          )}
          {location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{location}</span>
          )}
        </div>
        {boat.companyName && (
          <p className="text-white/30 text-xs mt-1.5">{boat.companyName}</p>
        )}
      </Link>

      {/* Toast */}
      {showToast && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-yacht-brand text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-20 animate-fade-in-up">
          Price alert set
        </div>
      )}
    </div>
  );
}
