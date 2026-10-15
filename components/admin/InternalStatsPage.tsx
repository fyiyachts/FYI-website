import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import { RefreshCw, TrendingUp, Users, PhoneCall, MessageSquare, Tag, Reply, Search, Eye, MousePointerClick, BarChart3, Ruler } from 'lucide-react';
import {
  AdminPageHeader, AdminCard, StatTile, DrillDownPanel, type DrillTarget,
  CHART_COLORS, FUNNEL_RAMP, GOLD, TOOLTIP_STYLE, fmt,
} from './adminUi';
import FyiDashboardSection from './AdminDashboardPage';

interface Stats {
  generatedAt: string;
  cached?: boolean;
  totals: { contacts: number; leadSourceKnown: number };
  sources: { name: string; count: number }[];
  channels: {
    byLeadSource: { website: number; meta: number; google: number };
    byOriginalSource: { google: number; meta: number };
  };
  funnel: {
    allTime: { total: number; reachedOut: number; responded: number };
    last90: { total: number; reachedOut: number; responded: number };
  };
  sizes?: {
    sampled: number;
    truncated: boolean;
    windows: { d30: SizeBuckets; d60: SizeBuckets; d90: SizeBuckets };
  } | null;
}

interface SizeBuckets { total: number; under60: number; s60to89: number; s90plus: number; unknown: number }

const pct = (n: number, base: number) => (base > 0 ? (n / base) * 100 : 0);

// Channel slice → its entity-fixed categorical slot + drill metric.
const CHANNELS = [
  { name: 'Website', color: CHART_COLORS[0], drill: { metric: 'source', value: 'Website', title: 'Website leads' } },
  { name: 'Meta Ads', color: CHART_COLORS[1], drill: { metric: 'metaAds', title: 'Meta Ads leads (FB Paid Ads + Instagram)' } },
  { name: 'Google Ads', color: CHART_COLORS[2], drill: { metric: 'source', value: 'Paid Traffic', title: 'Google Ads leads (Paid Traffic)' } },
] as const;

/**
 * Engagement funnel — ordinal teal ramp (stage order is the meaning), direct
 * % labels, and every stage drills down to the contacts inside it.
 */
function Funnel({ title, sub, data, drills, onDrill }: {
  title: string;
  sub: string;
  data: { total: number; reachedOut: number; responded: number };
  drills: [DrillTarget, DrillTarget, DrillTarget];
  onDrill: (d: DrillTarget) => void;
}) {
  const stages = [
    { name: 'Leads', v: data.total, c: FUNNEL_RAMP[0], drill: drills[0] },
    { name: 'Reached out to', v: data.reachedOut, c: FUNNEL_RAMP[1], drill: drills[1] },
    { name: 'Responded / engaged', v: data.responded, c: FUNNEL_RAMP[2], drill: drills[2] },
  ];
  return (
    <div>
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      <p className="text-white/60 text-xs mb-3">{sub}</p>
      <div className="space-y-2.5">
        {stages.map((s, i) => {
          const p = pct(s.v, data.total);
          const conv = i > 0 ? pct(s.v, stages[i - 1].v) : 100;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onDrill(s.drill)}
              title="See who's behind this number"
              className="group block w-full text-left cursor-pointer"
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/90 group-hover:text-[#D4AF37] transition-colors">{s.name}</span>
                <span className="text-white/70 tabular-nums">{fmt(s.v)} · {p.toFixed(p < 1 ? 1 : 0)}%</span>
              </div>
              <div className="h-7 rounded-md bg-white/[0.08] overflow-hidden ring-1 ring-transparent group-hover:ring-[#D4AF37]/50 transition-all">
                <div
                  className="h-full rounded-md flex items-center pl-2.5 text-[#062026] text-xs font-bold"
                  style={{ width: `${Math.max(p, 4)}%`, background: s.c }}
                >
                  {p >= 8 ? `${p.toFixed(p < 1 ? 1 : 0)}%` : ''}
                </div>
              </div>
              {i > 0 && (
                <div className="text-white/60 text-[11px] mt-0.5">
                  ↳ {conv.toFixed(conv < 1 ? 1 : 0)}% of previous stage
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Leads by boat size -----------------------------------------------------
// 59ft & under / 60–89ft / 90ft+ buckets over a 30/60/90-day window. Sizes are
// parsed server-side out of the free-text lead-ad answers (the forms ask
// "make, model, length" — there is no numeric length field in HubSpot), so
// leads whose answer names no footage land in "size unknown".

const SIZE_WINDOWS = [
  { key: 'd30', label: '30 days' },
  { key: 'd60', label: '60 days' },
  { key: 'd90', label: '90 days' },
] as const;

function LeadsBySizeCard({ sizes }: { sizes: NonNullable<Stats['sizes']> }) {
  const [win, setWin] = useState<(typeof SIZE_WINDOWS)[number]['key']>('d30');
  const b = sizes.windows[win];
  const known = b.total - b.unknown;
  const buckets = [
    { name: '59ft & under', v: b.under60, c: CHART_COLORS[0] },
    { name: '60–89ft', v: b.s60to89, c: CHART_COLORS[2] },
    { name: '90ft & up', v: b.s90plus, c: GOLD },
  ];
  const max = Math.max(...buckets.map((x) => x.v), 1);
  return (
    <AdminCard
      title="Leads by Boat Size"
      subtitle="New leads bucketed by footage — boat of interest first, else the boat they already own · no-size answers shown as unknown"
      className="mb-6"
    >
      <div className="flex items-center gap-1.5 mb-5">
        {SIZE_WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => setWin(w.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              win === w.key
                ? 'text-[#062026] bg-[#D4AF37] border-[#D4AF37]'
                : 'text-white/70 bg-white/[0.04] border-white/15 hover:text-white hover:border-white/30'
            }`}
          >
            Last {w.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-white/60 tabular-nums">
          {fmt(b.total)} leads · {fmt(known)} with a size
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {buckets.map((x) => (
          <StatTile
            key={x.name}
            icon={<Ruler className="w-3.5 h-3.5" />}
            label={x.name}
            value={fmt(x.v)}
            sub={known > 0 ? `${pct(x.v, known).toFixed(0)}% of sized leads` : ''}
            explain={`Leads created in the last ${SIZE_WINDOWS.find((w) => w.key === win)?.label} whose form answer names a boat in this range — the boat they're shopping for, or if they only named the boat they currently own, that one. Share is of the ${fmt(known)} leads where a footage could be read.`}
          />
        ))}
        <StatTile
          icon={<Users className="w-3.5 h-3.5" />}
          label="Size unknown"
          accent="alert"
          value={fmt(b.unknown)}
          sub={b.total > 0 ? `${pct(b.unknown, b.total).toFixed(0)}% of all` : ''}
          explain="Leads in the window whose form answer names no readable footage — e.g. only a model name, or an empty answer. These can't be bucketed."
        />
      </div>

      <div className="space-y-2.5">
        {buckets.map((x) => (
          <div key={x.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/90">{x.name}</span>
              <span className="text-white/70 tabular-nums">
                {fmt(x.v)} · {pct(x.v, known).toFixed(0)}%
              </span>
            </div>
            <div className="h-7 rounded-md bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-md flex items-center pl-2.5 text-[#062026] text-xs font-bold"
                style={{ width: `${Math.max((x.v / max) * 100, 3)}%`, background: x.c }}
              >
                {(x.v / max) * 100 >= 10 ? fmt(x.v) : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {sizes.truncated && (
        <p className="mt-4 text-[11px] text-white/50">
          Computed over the newest {fmt(sizes.sampled)} leads of the window — older ones past the sampling cap aren't counted.
        </p>
      )}
    </AdminCard>
  );
}

export default function InternalStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats${refresh ? '?refresh=1' : ''}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const channelData = stats ? CHANNELS.map((c, i) => ({
    ...c,
    value: [stats.channels.byLeadSource.website, stats.channels.byLeadSource.meta, stats.channels.byLeadSource.google][i],
  })) : [];
  const topSources = stats ? stats.sources.filter(s => s.count > 0).slice(0, 12) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <AdminPageHeader
        title="Internal Stats — FYI"
        subtitle="Live from FYI HubSpot (portal 3826631) · click any number to see who's behind it"
        actions={
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {loading && !stats && (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/70 text-sm">Pulling live HubSpot data…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-none border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* Dashboard 1 — Leads by Source */}
          <AdminCard
            title="Leads by Source"
            subtitle="Every contact, grouped by the Lead Source field · click a tile, slice or bar to drill down"
            className="mb-6"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatTile
                icon={<Users className="w-3.5 h-3.5" />} label="Total contacts"
                value={fmt(stats.totals.contacts)}
                explain="Every contact record in FYI's HubSpot, all time — leads, customers, placeholders and imports alike."
                drill={{ metric: 'total', title: 'All contacts' }} onDrill={setDrill}
              />
              <StatTile
                icon={<Tag className="w-3.5 h-3.5" />} label="Lead Source tagged" accent="teal"
                value={fmt(stats.totals.leadSourceKnown)}
                sub={`${pct(stats.totals.leadSourceKnown, stats.totals.contacts).toFixed(0)}% of contacts`}
                explain="Contacts whose Lead Source field is filled in (set by a broker or an integration), as a share of all contacts."
                drill={{ metric: 'tagged', title: 'Contacts with a Lead Source' }} onDrill={setDrill}
              />
              <StatTile
                icon={<TrendingUp className="w-3.5 h-3.5" />} label="Top source" accent="gold"
                value={topSources[0]?.name || '—'} sub={topSources[0] ? fmt(topSources[0].count) : ''}
                explain="The Lead Source value carried by the most contacts."
                drill={topSources[0] ? { metric: 'source', value: topSources[0].name, title: `${topSources[0].name} leads` } : undefined}
                onDrill={setDrill}
              />
              <StatTile
                icon={<Users className="w-3.5 h-3.5" />} label="Untagged" accent="alert"
                value={fmt(stats.totals.contacts - stats.totals.leadSourceKnown)}
                sub={`${pct(stats.totals.contacts - stats.totals.leadSourceKnown, stats.totals.contacts).toFixed(0)}%`}
                explain="Contacts with an empty Lead Source field — total contacts minus the tagged ones. These can't be attributed to a channel."
                drill={{ metric: 'untagged', title: 'Contacts with no Lead Source' }} onDrill={setDrill}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Channel mix donut */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">Website vs Meta vs Google</h3>
                <p className="text-white/60 text-xs mb-2">By Lead Source field · click a slice to drill down</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={channelData} dataKey="value" nameKey="name"
                      innerRadius={55} outerRadius={85} paddingAngle={2}
                      stroke="#0f2740" strokeWidth={2}
                      onClick={(entry: any) => {
                        const d = entry?.payload?.drill ?? entry?.drill;
                        if (d) setDrill(d);
                      }}
                      className="cursor-pointer"
                    >
                      {channelData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [fmt(Number(v)), n]} contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {channelData.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => setDrill(d.drill)}
                      className="flex items-center gap-1.5 text-xs text-white/80 hover:text-[#D4AF37] transition-colors cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                      {d.name} <span className="text-white font-semibold tabular-nums">{fmt(d.value)}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] px-3 py-2 text-[11px] text-[#e8d28a]">
                  <span>⚠️</span>
                  <span>
                    Google Ads is under-tagged in Lead Source. HubSpot's auto-tracked Original Source shows{' '}
                    <button
                      onClick={() => setDrill({ metric: 'osGoogle', title: 'Original Source: Google (Paid Search)' })}
                      className="font-bold underline decoration-dotted underline-offset-2 hover:text-white transition-colors cursor-pointer"
                    >
                      {fmt(stats.channels.byOriginalSource.google)} Google (Paid Search)
                    </button>{' '}
                    and{' '}
                    <button
                      onClick={() => setDrill({ metric: 'osMeta', title: 'Original Source: Meta (Paid Social)' })}
                      className="font-bold underline decoration-dotted underline-offset-2 hover:text-white transition-colors cursor-pointer"
                    >
                      {fmt(stats.channels.byOriginalSource.meta)} Meta (Paid Social)
                    </button>.
                  </span>
                </div>
              </div>

              {/* Sources bar — nominal single series: one hue, drill per bar */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">All lead sources, ranked</h3>
                <p className="text-white/60 text-xs mb-2">Top 12 by contact count · click a bar to drill down</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topSources} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#cbd5e1', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [fmt(Number(v)), 'Contacts']}
                      cursor={{ fill: 'rgba(212,175,55,0.06)' }}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar
                      dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]}
                      className="cursor-pointer"
                      onClick={(entry: any) => {
                        const name = entry?.payload?.name ?? entry?.name;
                        if (name) setDrill({ metric: 'source', value: name, title: `${name} leads` });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AdminCard>

          {/* Leads by boat size — 30/60/90-day windows */}
          {stats.sizes && <LeadsBySizeCard sizes={stats.sizes} />}

          {/* Dashboard 2 — lead engagement */}
          <AdminCard
            title="Lead Engagement"
            subtitle="Are we working the leads? Reached-out & responded rates · click a tile or funnel stage to drill down"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatTile
                icon={<PhoneCall className="w-3.5 h-3.5" />} label="Reached out (all-time)" accent="alert"
                value={`${pct(stats.funnel.allTime.reachedOut, stats.funnel.allTime.total).toFixed(0)}%`}
                sub={fmt(stats.funnel.allTime.reachedOut)}
                explain={`Contacts with a logged "Last Contacted" date (a call, email or meeting logged in HubSpot) OR at least one note on their record, divided by all ${fmt(stats.funnel.allTime.total)} contacts. ${fmt(stats.funnel.allTime.reachedOut)} ÷ ${fmt(stats.funnel.allTime.total)}.`}
                drill={{ metric: 'reachedOut', title: 'Reached out (all-time)' }} onDrill={setDrill}
              />
              <StatTile
                icon={<MessageSquare className="w-3.5 h-3.5" />} label="Responded / engaged" accent="alert"
                value={`${pct(stats.funnel.allTime.responded, stats.funnel.allTime.total).toFixed(0)}%`}
                sub={fmt(stats.funnel.allTime.responded)}
                explain={`Contacts who replied to a tracked sales email, OR whose Lead Status is an engaged value (In touch w/ broker, Qualified, Deal pending, Purchased with FYI, Listed with FYI, Boat owner, Later Buyer/Seller), OR who have a note indicating two-way communication — voicemail-only / no-answer notes don't count (notes are scanned by an automated classifier every 15 min). ${fmt(stats.funnel.allTime.responded)} ÷ ${fmt(stats.funnel.allTime.total)}.`}
                drill={{ metric: 'responded', title: 'Responded / engaged (all-time)' }} onDrill={setDrill}
              />
              <StatTile
                icon={<Reply className="w-3.5 h-3.5" />} label="Of contacted, replied" accent="teal"
                value={`${pct(stats.funnel.allTime.responded, stats.funnel.allTime.reachedOut).toFixed(0)}%`}
                explain={`Responded/engaged contacts divided by reached-out contacts — of the people we actually contacted, the share who engaged back. ${fmt(stats.funnel.allTime.responded)} ÷ ${fmt(stats.funnel.allTime.reachedOut)}.`}
                drill={{ metric: 'responded', title: 'Contacted leads that replied' }} onDrill={setDrill}
              />
              <StatTile
                icon={<PhoneCall className="w-3.5 h-3.5" />} label="Reached out (90 days)" accent="gold"
                value={`${pct(stats.funnel.last90.reachedOut, stats.funnel.last90.total).toFixed(0)}%`}
                sub={`of ${fmt(stats.funnel.last90.total)} new`}
                explain={`Same rule (logged Last Contacted date OR at least one note), scoped to contacts created in the last 90 days: ${fmt(stats.funnel.last90.reachedOut)} of the ${fmt(stats.funnel.last90.total)} newest contacts have outreach activity.`}
                drill={{ metric: 'reached90', title: 'Reached out (last 90 days)' }} onDrill={setDrill}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Funnel
                title="Lead-engagement funnel — all time"
                sub={`All ${fmt(stats.funnel.allTime.total)} contacts`}
                data={stats.funnel.allTime}
                drills={[
                  { metric: 'total', title: 'All contacts' },
                  { metric: 'reachedOut', title: 'Reached out (all-time)' },
                  { metric: 'responded', title: 'Responded / engaged (all-time)' },
                ]}
                onDrill={setDrill}
              />
              <Funnel
                title="Funnel — leads created in last 90 days"
                sub={`${fmt(stats.funnel.last90.total)} new contacts`}
                data={stats.funnel.last90}
                drills={[
                  { metric: 'total90', title: 'Leads created in the last 90 days' },
                  { metric: 'reached90', title: 'Reached out (last 90 days)' },
                  { metric: 'responded90', title: 'Responded / engaged (last 90 days)' },
                ]}
                onDrill={setDrill}
              />
            </div>

            <div className="mt-5 flex gap-2 rounded-lg border px-3 py-2.5 text-xs text-red-200/90 border-red-500/30 bg-red-500/10">
              <span>🔎</span>
              <span>
                Most leads have <b>no logged outreach</b>, and only a small share ever engage back. This is the biggest
                lever on closing more boats — speed-to-lead and follow-through, not more traffic.
              </span>
            </div>
          </AdminCard>

          <FyiDashboardSection />

          <SearchReviewCard />

        </>
      )}

      <DrillDownPanel target={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

// ---- Search Console + GA4 review -------------------------------------------
// Reads /api/admin/search (service-account-powered, server-side only). Renders
// last-28-day organic search performance and the GA4 channel mix; when a grant
// is missing it shows the exact service-account email to add, so fixing access
// never requires digging through Vercel or Google Cloud.

interface SearchRow { key: string; clicks: number; impressions: number; ctr: number; position: number }
interface SearchData {
  serviceAccount: string;
  searchConsole: { error?: string; site?: string; range?: { startDate: string; endDate: string }; totals?: SearchRow; topQueries?: SearchRow[]; topPages?: SearchRow[] };
  ga4: { error?: string; property?: string; channels?: { channel: string; sessions: number; users: number }[] };
}

function SearchTable({ title, rows, keyLabel }: { title: string; rows: SearchRow[]; keyLabel: string }) {
  return (
    <div>
      <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/60 border-b border-white/10">
              <th className="text-left py-1.5 pr-2 font-medium">{keyLabel}</th>
              <th className="text-right py-1.5 px-2 font-medium">Clicks</th>
              <th className="text-right py-1.5 px-2 font-medium">Impr.</th>
              <th className="text-right py-1.5 px-2 font-medium">CTR</th>
              <th className="text-right py-1.5 pl-2 font-medium">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-white/5 text-white/85">
                <td className="py-1.5 pr-2 max-w-[260px] truncate" title={r.key}>{r.key.replace('https://fyiyachts.com', '') || '/'}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{fmt(r.clicks)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{fmt(r.impressions)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{(r.ctr * 100).toFixed(1)}%</td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{r.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SearchReviewCard() {
  const [data, setData] = useState<SearchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/search', { credentials: 'same-origin' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        setData(body);
      } catch (e: any) {
        setError(e.message || 'Failed to load search data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const gsc = data?.searchConsole;
  const totals = gsc?.totals;

  return (
    <AdminCard
      title="Organic Search & GA4"
      subtitle="Google Search Console (last 28 days) + GA4 channel mix · via the project's Google service account"
      className="mt-6"
    >
      {loading && <p className="text-white/60 text-sm py-6 text-center">Pulling Search Console + GA4…</p>}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">{error}</div>
      )}
      {data && (
        <>
          {gsc?.error ? (
            <div className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] px-3 py-2.5 text-xs text-[#e8d28a] mb-4">
              Search Console: {gsc.error} — grant <b>{data.serviceAccount}</b> access on the property in Search Console → Settings → Users.
            </div>
          ) : totals && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatTile icon={<MousePointerClick className="w-3.5 h-3.5" />} label="Clicks (28d)" value={fmt(totals.clicks)} explain={`Organic Google clicks to ${gsc?.site} between ${gsc?.range?.startDate} and ${gsc?.range?.endDate}.`} />
                <StatTile icon={<Eye className="w-3.5 h-3.5" />} label="Impressions (28d)" value={fmt(totals.impressions)} accent="teal" explain="How often the site appeared in Google results in the window." />
                <StatTile icon={<Search className="w-3.5 h-3.5" />} label="Avg CTR" value={`${((totals.ctr || 0) * 100).toFixed(1)}%`} accent="gold" explain="Clicks divided by impressions." />
                <StatTile icon={<BarChart3 className="w-3.5 h-3.5" />} label="Avg position" value={(totals.position || 0).toFixed(1)} explain="Average Google ranking across all queries (lower is better)." />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                <SearchTable title="Top queries" keyLabel="Query" rows={gsc?.topQueries || []} />
                <SearchTable title="Top pages" keyLabel="Page" rows={gsc?.topPages || []} />
              </div>
            </>
          )}

          {data.ga4?.error ? (
            <div className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] px-3 py-2.5 text-xs text-[#e8d28a]">
              GA4: {data.ga4.error} — add <b>{data.serviceAccount}</b> as a Viewer in GA4 Admin → Property access management to light this up.
            </div>
          ) : (
            <div>
              <h3 className="text-white font-semibold text-sm mb-2">GA4 sessions by channel — last 28 days{data.ga4?.property ? ` · ${data.ga4.property}` : ''}</h3>
              <div className="space-y-1.5">
                {(data.ga4?.channels || []).map((c) => {
                  const max = Math.max(...(data.ga4?.channels || []).map((x) => x.sessions), 1);
                  return (
                    <div key={c.channel} className="flex items-center gap-2 text-xs">
                      <span className="w-36 text-white/80 truncate">{c.channel}</span>
                      <div className="flex-1 h-4 bg-white/[0.08] rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${(c.sessions / max) * 100}%`, background: GOLD }} />
                      </div>
                      <span className="w-20 text-right text-white/70 tabular-nums">{fmt(c.sessions)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </AdminCard>
  );
}
