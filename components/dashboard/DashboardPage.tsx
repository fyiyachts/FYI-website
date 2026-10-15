import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getRecentlyViewed, getSavedBoats, getSavedSearches, toggleSearchAlerts, removeSavedSearch, getPriceAlerts, removePriceAlert, setSearchEmailFrequency } from '../../services/storageService';
import { syncAlertSubscription } from '../../services/alertService';
import type { RecentlyViewedEntry, SavedBoat, SavedSearch } from '../../types/user';
import type { PriceAlert } from '../../services/storageService';
import { Search, Heart, Clock, TrendingDown, ArrowRight, Bell, BellOff, Trash2, Settings, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { timeAgo } from '../../utils/formatters';
import OkeanBuilder from './OkeanBuilder';

type WidgetId = 'quick-actions' | 'saved-searches' | 'recently-viewed' | 'watchlist' | 'price-alerts' | 'okean-builder';

interface WidgetConfig {
  id: WidgetId;
  label: string;
  enabled: boolean;
}

const WIDGET_KEY = 'fyi_dashboard_widgets';

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'quick-actions', label: 'Quick Actions', enabled: true },
  { id: 'saved-searches', label: 'Saved Searches', enabled: true },
  { id: 'recently-viewed', label: 'Recently Viewed', enabled: true },
  { id: 'watchlist', label: 'Watchlist', enabled: true },
  { id: 'price-alerts', label: 'Price Alerts', enabled: true },
  { id: 'okean-builder', label: 'Build Your Okean', enabled: true },
];

export default function DashboardPage() {
  const { email } = useAuth();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  const [savedBoats, setSavedBoats] = useState<SavedBoat[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<Record<string, PriceAlert>>({});
  const [showCustomize, setShowCustomize] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_WIDGETS;
  });

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed().slice(0, 10));
    setSavedBoats(getSavedBoats());
    setSavedSearches(getSavedSearches());
    setPriceAlerts(getPriceAlerts());
  }, []);

  const firstName = email?.split('@')[0] || 'there';

  const isEnabled = (id: WidgetId) => widgets.find(w => w.id === id)?.enabled ?? true;

  const toggleWidget = (id: WidgetId) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
      localStorage.setItem(WIDGET_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleToggleAlert = (id: string) => {
    toggleSearchAlerts(id);
    setSavedSearches(getSavedSearches());
  };

  const handleFrequencyChange = (id: string, freq: 'daily' | 'weekly' | 'off') => {
    setSearchEmailFrequency(id, freq);
    setSavedSearches(getSavedSearches());
    if (email) syncAlertSubscription(email).catch(() => {});
  };

  const handleDeleteSearch = (id: string) => {
    removeSavedSearch(id);
    setSavedSearches(getSavedSearches());
  };

  const handleRemovePriceAlert = (boatId: string) => {
    removePriceAlert(boatId);
    setPriceAlerts(getPriceAlerts());
  };

  const alertEntries = useMemo(() => Object.entries(priceAlerts).map(([id, data]) => ({ id, ...data })), [priceAlerts]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Welcome */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">My FYI</p>
          <h1 className="mt-2 text-3xl font-light tracking-wide text-white">
            Welcome back, <span className="font-serif italic text-yacht-cream">{firstName}</span>
          </h1>
        </div>
        <button
          onClick={() => setShowCustomize(!showCustomize)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/40 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 hover:text-white transition-all"
        >
          <Settings className="w-3.5 h-3.5" />
          Customize
        </button>
      </div>

      {/* Widget Picker */}
      {showCustomize && (
        <div className="bg-white/5 border border-white/10 rounded-none p-5 mb-6">
          <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Toggle Widgets</h3>
          <div className="flex flex-wrap gap-2">
            {widgets.map(w => (
              <button
                key={w.id}
                onClick={() => toggleWidget(w.id)}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] transition-all border ${
                  w.enabled
                    ? 'bg-yacht-brand text-white border-yacht-brand'
                    : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                }`}
              >
                {w.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {isEnabled('quick-actions') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link to="/app/search" className="bg-gradient-to-br from-yacht-brand/20 to-yacht-brand/5 border border-yacht-brand/20 rounded-none p-5 hover:border-yacht-brand/40 transition-colors group">
            <Search className="w-6 h-6 text-yacht-brand mb-2" />
            <h3 className="text-white font-medium text-sm">Search Yachts</h3>
            <p className="text-white/40 text-xs mt-1">AI-powered semantic search</p>
            <ArrowRight className="w-4 h-4 text-yacht-brand mt-3 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/app/saved" className="bg-white/5 border border-white/10 rounded-none p-5 hover:border-white/20 transition-colors group">
            <Heart className="w-6 h-6 text-red-400 mb-2" />
            <h3 className="text-white font-medium text-sm">Saved Yachts</h3>
            <p className="text-white/40 text-xs mt-1">{savedBoats.length} yacht{savedBoats.length !== 1 ? 's' : ''} in your watchlist</p>
            <ArrowRight className="w-4 h-4 text-white/40 mt-3 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/app/compare" className="bg-gradient-to-br from-yacht-teal/15 to-yacht-teal/5 border border-yacht-teal/20 rounded-none p-5 hover:border-yacht-teal/40 transition-colors group">
            <TrendingDown className="w-6 h-6 text-yacht-teal mb-2" />
            <h3 className="text-white font-medium text-sm">Compare</h3>
            <p className="text-white/40 text-xs mt-1">Side-by-side yacht comparison</p>
            <ArrowRight className="w-4 h-4 text-yacht-teal mt-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}

      {/* Two-column grid for Saved Searches + Price Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Saved Searches Widget */}
        {isEnabled('saved-searches') && (
          <div className="bg-white/5 border border-white/10 rounded-none overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-serif text-lg italic tracking-wide text-white">
                <Search className="w-4 h-4 text-yacht-teal" />
                Saved Searches
              </h2>
              <Link to="/app/saved" className="text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-5">
              {savedSearches.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No saved searches found</p>
                  <Link to="/app/search" className="text-yacht-teal text-xs mt-2 inline-block hover:underline">Search to create one</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedSearches.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">{s.query || 'Untitled search'}</p>
                        <p className="text-white/30 text-[10px]">{timeAgo(s.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3">
                        <div className="flex rounded-md overflow-hidden border border-white/10">
                          {(['daily', 'weekly', 'off'] as const).map(freq => {
                            const current = s.emailFrequency || (s.alertsEnabled ? 'weekly' : 'off');
                            const active = current === freq;
                            return (
                              <button
                                key={freq}
                                onClick={() => handleFrequencyChange(s.id, freq)}
                                className={`px-2 py-1 text-[10px] font-semibold transition-colors ${
                                  active
                                    ? freq === 'off' ? 'bg-white/10 text-white/50' : 'bg-yacht-brand/20 text-yacht-brand'
                                    : 'text-white/20 hover:text-white/40'
                                }`}
                              >
                                {freq === 'daily' ? 'D' : freq === 'weekly' ? 'W' : 'Off'}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => handleDeleteSearch(s.id)}
                          className="p-1.5 text-white/20 hover:text-red-400 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price Alerts Widget */}
        {isEnabled('price-alerts') && (
          <div className="bg-white/5 border border-white/10 rounded-none overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-serif text-lg italic tracking-wide text-white">
                <Bell className="w-4 h-4 text-yacht-brand" />
                Price Alerts
              </h2>
              <span className="text-white/30 text-xs">{alertEntries.length} active</span>
            </div>
            <div className="p-5">
              {alertEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No price alerts set</p>
                  <p className="text-white/20 text-xs mt-1">Click the bell on any yacht card to track price drops</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alertEntries.slice(0, 6).map(alert => (
                    <div key={alert.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                      <img src={alert.image} alt={alert.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{alert.title}</p>
                        <p className="text-white/30 text-[10px]">Tracking at {alert.price}</p>
                      </div>
                      <button
                        onClick={() => handleRemovePriceAlert(alert.id)}
                        className="p-1.5 text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recently Viewed */}
      {isEnabled('recently-viewed') && recentlyViewed.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-yacht-teal" />
            <h2 className="text-white font-medium text-sm">Recently Viewed</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recentlyViewed.map(entry => (
              <Link
                key={entry.id}
                to={`/app/yacht/${entry.id}`}
                className="bg-white/5 border border-white/10 rounded-none overflow-hidden shrink-0 w-48 hover:border-white/20 transition-colors"
              >
                {entry.image ? (
                  <img src={entry.image} alt={entry.title} className="w-full aspect-[4/3] object-cover" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[4/3] bg-white/5" />
                )}
                <div className="p-2.5">
                  <p className="text-white text-xs font-medium line-clamp-1">{entry.title}</p>
                  <p className="text-yacht-cream text-xs font-bold">{entry.price}</p>
                  <p className="text-white/30 text-[10px] mt-1">{timeAgo(entry.viewedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Saved Boats preview */}
      {isEnabled('watchlist') && savedBoats.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-400" />
              <h2 className="text-white font-medium text-sm">Your Watchlist</h2>
            </div>
            <Link to="/app/saved" className="text-yacht-teal text-xs hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {savedBoats.slice(0, 4).map(boat => (
              <Link
                key={boat.id}
                to={`/app/yacht/${boat.id}`}
                className="bg-white/5 border border-white/10 rounded-none overflow-hidden hover:border-white/20 transition-colors"
              >
                {boat.image ? (
                  <img src={boat.image} alt={boat.title} className="w-full aspect-[4/3] object-cover" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[4/3] bg-white/5" />
                )}
                <div className="p-3">
                  <p className="text-white text-sm font-medium line-clamp-1">{boat.title}</p>
                  <p className="text-yacht-cream font-bold">{boat.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Okean Builder */}
      {isEnabled('okean-builder') && (
        <div className="mb-8">
          <OkeanBuilder />
        </div>
      )}

      {/* Empty state */}
      {recentlyViewed.length === 0 && savedBoats.length === 0 && savedSearches.length === 0 && alertEntries.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h2 className="text-white text-lg font-medium mb-2">Ready to explore?</h2>
          <p className="text-white/40 text-sm mb-4">Start searching to discover your next yacht.</p>
          <Link to="/app/search" className="inline-flex items-center gap-2 bg-yacht-brand px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light">
            <Search className="w-4 h-4" />Start Searching
          </Link>
        </div>
      )}
    </div>
  );
}
