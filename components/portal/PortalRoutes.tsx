import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { isAdminEmail } from '../../utils/admin';
import AppShell from '../layout/AppShell';
import DashboardPage from '../dashboard/DashboardPage';
import InternalStatsPage from '../admin/InternalStatsPage';
import AdminLeadsPage from '../admin/AdminLeadsPage';
import SearchPage from '../search/SearchPage';
import YachtDetailPage from '../listing/YachtDetailPage';
import SavedPage from '../saved/SavedPage';
import ComparePage from '../compare/ComparePage';
import ForYouPage from '../foryou/ForYouPage';
import NewBuildPage from '../build/NewBuildPage';
import NewestPage from '../newest/NewestPage';
import PriceDropsPage from '../pricedrops/PriceDropsPage';
import BriannaWidget from '../chat/BriannaWidget';
import TeamPage from '../team/TeamPage';
import BrokerPage from '../team/BrokerPage';
import YachtMatchQuiz from '../quiz/YachtMatchQuiz';
import { YACHT_MATCH_ENABLED } from '../../utils/featureFlags';

// The authenticated portal, split out of the main bundle (React.lazy in
// App.tsx) so public visitors never download the dashboard, admin, search,
// charts, or chat code — roughly half the app.

function AdminRoute({ children }: { children: ReactNode }) {
  const { email } = useAuth();
  if (!isAdminEmail(email)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function PortalRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const { pathname } = useLocation();
  // Back-office pages (internal stats, admin) are working screens — no
  // lead-capture popups there, incl. the auto-opening Yacht Match quiz.
  const isBackOffice = /^\/app\/(internal-stats|admin)(\/|$)/.test(pathname);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yacht-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-yacht-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/internal-stats" element={<AdminRoute><InternalStatsPage /></AdminRoute>} />
        {/* FYI Dashboard was consolidated into Internal Stats (2026-08-18). */}
        <Route path="/admin/dashboard" element={<Navigate to="/app/internal-stats" replace />} />
        <Route path="/admin/leads" element={<AdminRoute><AdminLeadsPage /></AdminRoute>} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/newest" element={<NewestPage />} />
        <Route path="/for-you" element={<ForYouPage />} />
        <Route path="/new-build" element={<NewBuildPage />} />
        <Route path="/yacht/:id" element={<YachtDetailPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/price-drops" element={<PriceDropsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/team/:slug" element={<BrokerPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      <BriannaWidget />
      {YACHT_MATCH_ENABLED && !isBackOffice && <YachtMatchQuiz />}
    </AppShell>
  );
}
