import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSavedBoats, unsaveBoat, getSavedSearches, removeSavedSearch, toggleSearchAlerts } from '../../services/storageService';
import { syncAlertSubscription } from '../../services/alertService';
import { useAuth } from '../auth/AuthProvider';
import type { SavedBoat, SavedSearch } from '../../types/user';
import { Heart, Search, Bell, BellOff, Trash2, MapPin, TrendingDown } from 'lucide-react';
import { timeAgo } from '../../utils/formatters';
import { boatNameLine, yachtTitle } from '../../utils/boatTitle';
import { optImg } from '../../utils/img';

/** Card title from the saved specs; boats saved earlier stored the boat's name as `title`. */
const savedTitle = (b: SavedBoat): string =>
  yachtTitle(b.specs?.year, b.specs?.make, b.specs?.model) || b.title;

export default function SavedPage() {
  const [boats, setBoats] = useState<SavedBoat[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [tab, setTab] = useState<'boats' | 'searches'>('boats');
  const { email } = useAuth();

  useEffect(() => {
    setBoats(getSavedBoats());
    setSearches(getSavedSearches());
  }, []);

  const handleUnsave = (id: number) => {
    unsaveBoat(id);
    setBoats(getSavedBoats());
    if (email) syncAlertSubscription(email).catch(() => {});
  };

  const handleRemoveSearch = (id: string) => {
    removeSavedSearch(id);
    setSearches(getSavedSearches());
    if (email) syncAlertSubscription(email).catch(() => {});
  };

  const handleToggleAlert = (id: string) => {
    toggleSearchAlerts(id);
    setSearches(getSavedSearches());
    if (email) syncAlertSubscription(email).catch(() => {});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-serif text-2xl text-white mb-4">Saved</h1>

      {/* Alert status banner */}
      {boats.length > 0 && (
        <div className="flex items-center gap-3 bg-yacht-brand/5 border border-yacht-brand/15 rounded-none px-4 py-3 mb-6">
          <TrendingDown className="w-5 h-5 text-yacht-brand shrink-0" />
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Price Drop Monitoring Active</p>
            <p className="text-white/40 text-xs mt-0.5">
              {boats.length} boat{boats.length !== 1 ? 's' : ''} monitored
              {searches.filter(s => s.alertsEnabled).length > 0 && ` · ${searches.filter(s => s.alertsEnabled).length} search alert${searches.filter(s => s.alertsEnabled).length !== 1 ? 's' : ''}`}
              {' '}— daily digest sent to {email || 'your email'}
            </p>
          </div>
          <Bell className="w-4 h-4 text-yacht-brand/60" />
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('boats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === 'boats' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
          <Heart className="w-4 h-4" />Boats ({boats.length})
        </button>
        <button onClick={() => setTab('searches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === 'searches' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
          <Search className="w-4 h-4" />Searches ({searches.length})
        </button>
      </div>

      {tab === 'boats' && (
        boats.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-12 h-12 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No saved yachts yet.</p>
            <Link to="/app/search" className="text-yacht-teal text-sm hover:underline mt-2 inline-block">Start searching</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boats.map(boat => (
              <div key={boat.id} className="bg-white/5 border border-white/10 rounded-none overflow-hidden group">
                <Link to={`/app/yacht/${boat.id}`} className="block relative aspect-[4/3] overflow-hidden">
                  {boat.image ? (
                    <img src={optImg(boat.image, 480)} alt={savedTitle(boat)} width={480} height={360} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center"><span className="text-white/20 text-sm">No Image</span></div>
                  )}
                </Link>
                <div className="p-3">
                  <Link to={`/app/yacht/${boat.id}`} className="block">
                    <h3 className="text-white font-medium text-sm line-clamp-1">{savedTitle(boat)}</h3>
                    {boatNameLine(boat.title, savedTitle(boat)) && (
                      <p className="truncate text-xs font-light italic text-white/50">{boatNameLine(boat.title, savedTitle(boat))}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-yacht-cream font-bold text-lg">{boat.price}</p>
                      <span className="text-[10px] text-yacht-brand/60 bg-yacht-brand/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <TrendingDown className="w-2.5 h-2.5" />Monitored
                      </span>
                    </div>
                    {boat.location && <p className="text-white/40 text-xs flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{boat.location}</p>}
                  </Link>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span className="text-white/30 text-xs">Saved {timeAgo(boat.savedAt)}</span>
                    <button onClick={() => handleUnsave(boat.id)} className="text-white/30 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'searches' && (
        searches.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No saved searches yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {searches.map(search => (
              <div key={search.id} className="bg-white/5 border border-white/10 rounded-none p-4 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">"{search.query}"</p>
                  <p className="text-white/40 text-xs mt-0.5">Saved {timeAgo(search.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleAlert(search.id)}
                    className={`p-2 rounded-lg transition-colors ${search.alertsEnabled ? 'text-yacht-brand bg-yacht-brand/10' : 'text-white/30 hover:text-white/60'}`}
                    title={search.alertsEnabled ? 'Alerts on' : 'Alerts off'}>
                    {search.alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleRemoveSearch(search.id)} className="text-white/30 hover:text-red-400 p-2 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
