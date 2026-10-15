import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import {
  RefreshCw, TrendingUp, TrendingDown, Users, PhoneCall,
  MessageSquare, ArrowRight, Inbox,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { AdminCard, CHART_COLORS, TOOLTIP_STYLE, hubspotContactUrl, fmt } from './adminUi';

// FYI Dashboard — windowed lead metrics with a prior-period trend,
// source/owner/status/brand/state breakdowns, and a recent-leads feed
// (a port of the Valhalla dealer portal's /portal dashboard onto FYI's
// HubSpot, portal 3826631). Data from /api/admin/reports. Formerly its own
// /app/admin/dashboard page; now rendered as a section of Internal Stats
// (consolidated 2026-08-18) — the old route redirects there.

interface CountRow { label: string; value: number; pct: number }
interface RecentLead {
  id: string; name: string; email: string | null; source: string | null;
  distributedTo: string | null; status: string | null; createdAt: string | null;
}
interface Reports {
  generatedAt: string;
  cached?: boolean;
  totals: {
    contacts: number; windowDays: number; newLeads: number; newLeadsPrior: number;
    reachedOut: number; responded: number; unassignedInSample: number;
  };
  sample: { size: number; of: number; truncated: boolean };
  bySource: CountRow[];
  ownerLeaderboard: CountRow[];
  byStatus: CountRow[];
  byBrand: CountRow[];
  byState: CountRow[];
  recentLeads: RecentLead[];
}

const WINDOWS = [7, 30, 90, 365] as const;
const pct = (n: number, base: number) => (base > 0 ? (n / base) * 100 : 0);

function StatTile({ icon, label, value, sub, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  trend?: { pct: number; up: boolean } | null;
}) {
  return (
    <div className="rounded-none p-4 border bg-white/[0.07] border-white/15">
      <div className="flex items-center gap-2 text-white/75 text-xs font-semibold">{icon}{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend.pct).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <div className="text-white/65 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

/** Horizontal count list with proportional bars — leaderboards & breakdowns. */
function BarList({ title, sub, rows, emptyText }: {
  title: string; sub?: string; rows: CountRow[]; emptyText?: string;
}) {
  const max = rows[0]?.value ?? 0;
  return (
    <div className="rounded-none border border-white/15 bg-white/[0.04] p-4">
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      {sub && <p className="text-white/60 text-xs mb-2">{sub}</p>}
      {rows.length === 0 ? (
        <p className="text-white/50 text-xs py-4">{emptyText || 'No data in this period.'}</p>
      ) : (
        <div className="space-y-1.5 mt-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-36 shrink-0 truncate text-xs text-white/85" title={r.label}>{r.label}</span>
              <div className="flex-1 h-4 rounded bg-white/10 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${max > 0 ? Math.max((r.value / max) * 100, 2) : 0}%`, background: CHART_COLORS[0] }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs text-white/75 tabular-nums">
                {fmt(r.value)} · {r.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function FyiDashboardSection() {
  const { email } = useAuth();
  const [days, setDays] = useState<number>(30);
  const [reports, setReports] = useState<Reports | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (windowDays: number, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/reports?days=${windowDays}${refresh ? '&refresh=1' : ''}`,
        { credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setReports(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const t = reports?.totals;
  const trend = t && t.newLeadsPrior > 0
    ? { pct: ((t.newLeads - t.newLeadsPrior) / t.newLeadsPrior) * 100, up: t.newLeads >= t.newLeadsPrior }
    : null;

  return (
    <AdminCard
      title="FYI Dashboard"
      subtitle="Lead volume, sources, distribution & recent arrivals · pick a period"
      className="mt-6"
    >
      <div className="flex items-center gap-2 mb-5">
        {/* Time-period selector */}
        <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors ${
                days === w ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-white/55 hover:text-white'
              }`}
            >
              {w === 365 ? '1y' : `${w}d`}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(days, true)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !reports && (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/75 text-sm">Pulling live HubSpot data…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-none border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      {reports && t && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile
              icon={<Inbox className="w-3.5 h-3.5" />}
              label={`New leads (${t.windowDays}d)`}
              value={fmt(t.newLeads)}
              sub={`vs ${fmt(t.newLeadsPrior)} prior ${t.windowDays}d`}
              trend={trend}
            />
            <StatTile
              icon={<PhoneCall className="w-3.5 h-3.5" />}
              label="Reached out"
              value={`${pct(t.reachedOut, t.newLeads).toFixed(0)}%`}
              sub={`${fmt(t.reachedOut)} of this period's leads`}
            />
            <StatTile
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              label="Responded / engaged"
              value={`${pct(t.responded, t.newLeads).toFixed(0)}%`}
              sub={fmt(t.responded)}
            />
            <StatTile
              icon={<Users className="w-3.5 h-3.5" />}
              label="Total CRM contacts"
              value={fmt(t.contacts)}
              sub="all time"
            />
          </div>

          {/* Source chart + owner leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="rounded-none border border-white/15 bg-white/[0.04] p-4">
              <h3 className="text-white font-semibold text-sm mb-1">Leads by source</h3>
              <p className="text-white/60 text-xs mb-2">
                Lead Source of the period's newest {fmt(reports.sample.size)} leads
                {reports.sample.truncated ? ` (of ${fmt(reports.sample.of)})` : ''}
              </p>
              {reports.bySource.length === 0 ? (
                <p className="text-white/50 text-xs py-4">No tagged leads in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, reports.bySource.length * 26)}>
                  <BarChart data={reports.bySource} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fill: '#cbd5e1', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [fmt(Number(v)), 'Leads']}
                      cursor={{ fill: 'rgba(212,175,55,0.06)' }}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <BarList
              title="Who leads are distributed to"
              sub={`Owner of each assigned lead · ${fmt(t.unassignedInSample)} unassigned in sample`}
              rows={reports.ownerLeaderboard}
              emptyText="No assigned leads in this period."
            />
          </div>

          {/* Status / brand / state breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <BarList title="Lead status" sub="hs_lead_status of the period's leads" rows={reports.byStatus} />
            <BarList title="Brand interest" sub="Boat make/brand the lead asked about" rows={reports.byBrand} />
            <BarList title="Top states" rows={reports.byState} />
          </div>

          {/* Recent leads */}
          <section className="bg-white/[0.07] border border-white/15 rounded-none p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-white font-serif font-bold text-lg">Recent leads</h2>
                <p className="text-white/70 text-xs">Latest arrivals, any source</p>
              </div>
              <Link
                to="/app/admin/leads"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white/85 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
              >
                All leads <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-white/55 text-xs">
                    <th className="py-2 pr-4 font-medium">Lead</th>
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Distributed to</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.recentLeads.map((l) => (
                    <tr key={l.id} className="border-t border-white/10">
                      <td className="py-2.5 pr-4">
                        <a
                          href={hubspotContactUrl(l.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white text-sm font-medium hover:underline"
                          title="Open in HubSpot"
                        >
                          {l.name}
                        </a>
                        <p className="text-white/50 text-xs">{l.email || '—'}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-white/75 text-xs">{l.source || '—'}</td>
                      <td className="py-2.5 pr-4 text-xs">
                        {l.distributedTo
                          ? <span className="text-white/85">{l.distributedTo}</span>
                          : <span className="text-amber-400">Unassigned</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-white/75 text-xs">{l.status || '—'}</td>
                      <td className="py-2.5 text-white/55 text-xs text-right whitespace-nowrap">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-white/85 text-[11px] mt-4">
            Data as of {new Date(reports.generatedAt).toLocaleString()}
            {reports.cached ? ' · cached (Refresh for live)' : ' · live'} · signed in as {email}.
            Counts are exact; breakdowns use the period's newest {fmt(reports.sample.size)} leads.
            "Reached out" = a logged Last Contacted date; "Responded" = replied to a sales email
            or an in-touch/qualified/won lead status.
          </p>
        </>
      )}
    </AdminCard>
  );
}
