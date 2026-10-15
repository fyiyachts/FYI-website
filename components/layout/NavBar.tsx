import { Link, useLocation } from 'react-router-dom';
import { Search, Heart, BarChart3, LayoutDashboard, Menu, X, Sparkles, Anchor, Clock, TrendingDown, ShieldAlert, ClipboardList, Users, HeartHandshake } from 'lucide-react';
import { OPEN_QUIZ_EVENT } from '../quiz/YachtMatchQuiz';
import { YACHT_MATCH_ENABLED } from '../../utils/featureFlags';
import { useState } from 'react';
import { getCompareList } from '../../services/storageService';
import { useAuth } from '../auth/AuthProvider';
import { isAdminEmail } from '../../utils/admin';
import UserProfileDropdown from './UserProfileDropdown';
import FYILogo from './FYILogo';

const NAV_ITEMS = [
  { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/search', label: 'Search', icon: Search },
  { path: '/app/newest', label: 'Newest', icon: Clock },
  { path: '/app/price-drops', label: 'Price Drops', icon: TrendingDown },
  { path: '/app/for-you', label: 'For You', icon: Sparkles },
  { path: '/app/saved', label: 'Saved', icon: Heart },
  { path: '/app/compare', label: 'Compare', icon: BarChart3 },
  { path: '/app/new-build', label: 'New Build', icon: Anchor },
  { path: '/app/team', label: 'Broker Team', icon: Users },
];

// Admin-only surfaces (red section) — rendered for isAdminEmail users only.
const ADMIN_ITEMS = [
  { path: '/app/admin/leads', label: 'FYI Leads', icon: ClipboardList },
  { path: '/app/internal-stats', label: 'Internal Stats', icon: ShieldAlert },
];

export default function NavBar() {
  const { pathname } = useLocation();
  const { email } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const compareCount = getCompareList().length;
  const showAdmin = isAdminEmail(email);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-[220px] bg-yacht-800 border-r border-white/10 z-50">
        {/* Logo */}
        <Link to="/app" className="flex items-center px-5 py-5 shrink-0">
          <FYILogo className="h-7 w-auto text-white" />
        </Link>
        <div className="h-px bg-gradient-to-r from-yacht-teal/40 via-yacht-brand/30 to-transparent mx-3" />

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/app' ? pathname === '/app' : pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
                  isActive
                    ? 'bg-white/5 text-white shadow-[inset_2px_0_0_#cf4537]'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                {path === '/app/compare' && compareCount > 0 && (
                  <span className="ml-auto bg-yacht-brand text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {compareCount}
                  </span>
                )}
              </Link>
            );
          })}
          {/* Yacht Match quiz launcher — a modal, not a route. */}
          {YACHT_MATCH_ENABLED && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_QUIZ_EVENT))}
              className="flex w-full items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-all hover:bg-white/5 hover:text-white"
            >
              <HeartHandshake className="w-4 h-4 shrink-0" style={{ color: '#D4AF37' }} />
              <span>Find Your Match</span>
            </button>
          )}
          {showAdmin && (
            <>
              {/* Admin section — gold hairline + small-caps heading, links in
                  the brand's gold accent (matches the admin page headers). */}
              <div className="mt-4 mb-1.5 px-3 flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]/90">Admin</span>
                <span className="h-px flex-1 bg-gradient-to-r from-[#D4AF37]/40 to-transparent" />
              </div>
              {ADMIN_ITEMS.map(({ path, label, icon: Icon }) => {
                const isActive = pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
                      isActive
                        ? 'bg-[#D4AF37]/[0.12] text-[#e8cf7a] shadow-[inset_2px_0_0_#D4AF37]'
                        : 'text-white/55 hover:bg-[#D4AF37]/[0.06] hover:text-[#e8cf7a]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-white/45'}`} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User profile at bottom */}
        <div className="border-t border-white/10 p-3 shrink-0">
          <UserProfileDropdown position="sidebar" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <nav className="md:hidden border-b border-white/10 bg-yacht-900/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 flex items-center justify-between h-14">
          <Link to="/app" className="flex items-center">
            <FYILogo className="h-6 w-auto text-white" />
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white/60 hover:text-white">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 bg-yacht-900 px-4 pb-4">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const isActive = path === '/app' ? pathname === '/app' : pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${isActive ? 'bg-white/5 text-white shadow-[inset_2px_0_0_#cf4537]' : 'text-white/55'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
            {YACHT_MATCH_ENABLED && (
              <button
                type="button"
                onClick={() => { setMobileOpen(false); window.dispatchEvent(new Event(OPEN_QUIZ_EVENT)); }}
                className="flex w-full items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors"
              >
                <HeartHandshake className="w-4 h-4" style={{ color: '#D4AF37' }} />
                <span>Find Your Match</span>
              </button>
            )}
            {showAdmin && (
              <>
                <div className="mt-3 mb-1 px-3 flex items-center gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]/90">Admin</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-[#D4AF37]/40 to-transparent" />
                </div>
                {ADMIN_ITEMS.map(({ path, label, icon: Icon }) => {
                  const isActive = pathname.startsWith(path);
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                        isActive
                          ? 'bg-[#D4AF37]/[0.12] text-[#e8cf7a] shadow-[inset_2px_0_0_#D4AF37]'
                          : 'text-white/55'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4AF37]' : 'text-white/45'}`} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </>
            )}
            <div className="mt-3 pt-3 border-t border-white/10">
              <UserProfileDropdown />
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
