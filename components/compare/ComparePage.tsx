import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCompareList, clearCompare, removeFromCompare } from '../../services/storageService';
import { searchPinecone } from '../../services/pineconeService';
import type { PineconeBoat } from '../../types/search';
import { formatBoatPrice } from '../../utils/formatters';
import { BarChart3, X, Trash2, Loader2 } from 'lucide-react';
import { boatNameLine, yachtTitle } from '../../utils/boatTitle';
import { optImg } from '../../utils/img';

export default function ComparePage() {
  const [ids, setIds] = useState<number[]>([]);
  const [boats, setBoats] = useState<PineconeBoat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const compareIds = getCompareList();
    setIds(compareIds);
    if (compareIds.length === 0) { setLoading(false); return; }

    Promise.all(
      compareIds.map(id =>
        searchPinecone(String(id), 5, { DocumentID: { $eq: String(id) } })
          .then(results => results.find(r => r.documentId === String(id)) || results[0] || null)
          .catch(() => null)
      )
    ).then(results => {
      setBoats(results.filter((b): b is PineconeBoat => b !== null));
      setLoading(false);
    });
  }, []);

  const handleRemove = (id: number) => {
    removeFromCompare(id);
    setIds(getCompareList());
    setBoats(prev => prev.filter(b => Number(b.documentId) !== id));
  };

  const handleClear = () => {
    clearCompare();
    setIds([]);
    setBoats([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-yacht-brand animate-spin" />
      </div>
    );
  }

  if (ids.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <BarChart3 className="w-12 h-12 text-white/15 mx-auto mb-3" />
        <h1 className="font-serif text-2xl text-white mb-2">Compare Yachts</h1>
        <p className="text-white/40 text-sm mb-4">Add up to 6 yachts to compare side by side.</p>
        <Link to="/app/search" className="text-yacht-teal text-sm hover:underline">Start searching</Link>
      </div>
    );
  }

  const specRows = [
    { label: 'Price', key: 'price' as const },
    { label: 'Year', key: 'year' },
    { label: 'Make', key: 'make' },
    { label: 'Model', key: 'model' },
    { label: 'Length', key: 'length' },
    { label: 'Location', key: 'location' },
    { label: 'Brokerage', key: 'company' },
  ];

  const getSpecValue = (boat: PineconeBoat, key: string): string => {
    switch (key) {
      case 'price': return formatBoatPrice(boat);
      case 'year': return boat.year ? String(boat.year) : '—';
      case 'make': return boat.make || '—';
      case 'model': return boat.model || '—';
      case 'length': return boat.length ? `${Math.round(boat.length)}'` : '—';
      case 'location': return [boat.location?.city, boat.location?.state].filter(Boolean).join(', ') || '—';
      case 'company': return boat.companyName || '—';
      default: return '—';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-white">Compare ({boats.length})</h1>
        <button onClick={handleClear} className="text-white/40 hover:text-red-400 text-xs flex items-center gap-1 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />Clear All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="w-32" />
              {boats.map(boat => (
                <th key={boat.id} className="p-2 text-center">
                  <div className="bg-white/5 border border-white/10 rounded-none p-3 relative">
                    <button onClick={() => handleRemove(Number(boat.documentId))} className="absolute top-2 right-2 text-white/30 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                    <Link to={`/app/yacht/${boat.documentId}`}>
                      {boat.images?.[0] ? (
                        <img src={optImg(boat.images[0], 480)} alt={yachtTitle(boat.year, boat.make, boat.model) || boat.boatName || 'Yacht'} className="w-full aspect-[4/3] object-cover rounded-lg mb-2" />
                      ) : (
                        <div className="w-full aspect-[4/3] bg-white/5 rounded-lg mb-2" />
                      )}
                      <p className="text-white text-sm font-medium line-clamp-1">
                        {yachtTitle(boat.year, boat.make, boat.model) || boat.boatName || 'Unknown Vessel'}
                      </p>
                      {boatNameLine(boat.boatName, yachtTitle(boat.year, boat.make, boat.model)) && (
                        <p className="truncate text-xs font-light italic text-white/50">
                          {boatNameLine(boat.boatName, yachtTitle(boat.year, boat.make, boat.model))}
                        </p>
                      )}
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specRows.map(({ label, key }) => (
              <tr key={key} className="border-t border-white/5">
                <td className="py-3 px-2 text-white/40 text-xs font-medium">{label}</td>
                {boats.map(boat => (
                  <td key={boat.id} className="py-3 px-2 text-center">
                    <span className={`text-sm ${key === 'price' ? 'text-yacht-cream font-bold' : 'text-white'}`}>
                      {getSpecValue(boat, key)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
