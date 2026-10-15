import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  RefreshCw, Search, Download, BellRing, Check, Inbox,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { AdminPageHeader, hubspotContactUrl } from './adminUi';

// Admin-only FYI leads table — a port of the Valhalla dealer portal's
// /portal/leads page onto FYI's HubSpot (portal 3826631). Every lead, newest
// first, with who it was distributed to, stale-lead colouring, source filter,
// search, CSV export, pagination and a per-lead "Nudge owner" action.

interface FyiLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  distributedTo: string | null;
  ownerId: string | null;
  status: string | null;
  createdAt: string | null;
  lastActivityAt: string | null;
  state: string | null;
  brand: string | null;
}

/**
 * Lead "staleness" colouring for the contact name (same rules as Valhalla):
 *   - green  — any activity has been logged (the lead is being worked);
 *   - amber  — no activity yet and 12h+ since it came in;
 *   - red    — no activity yet and 24h+ since it came in;
 *   - normal — no activity yet but still fresh (<12h).
 */
type Staleness = 'active' | 'fresh' | 'warn' | 'stale';

function staleness(lead: FyiLead): { level: Staleness; hours: number } {
  if (lead.lastActivityAt) return { level: 'active', hours: 0 };
  if (!lead.createdAt) return { level: 'fresh', hours: 0 };
  const ms = Date.now() - new Date(lead.createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return { level: 'fresh', hours: 0 };
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return { level: 'stale', hours };
  if (hours >= 12) return { level: 'warn', hours };
  return { level: 'fresh', hours };
}

const STALE_NAME_CLASS: Record<Staleness, string> = {
  active: 'text-emerald-400',
  fresh: 'text-white',
  warn: 'text-amber-400',
  stale: 'text-red-400',
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const PAGE_SIZE = 25;

// Filterable Lead Source values — mirror of api/admin/stats.ts SOURCE_VALUES.
const SOURCE_OPTIONS = [
  'Website', 'YachtWorld', 'Boat Trader', 'FB Paid Ads', 'Answer Connect', 'Boats.com',
  'Website Chat Bot', 'Email Blast', 'Phone Call', 'Yatco', 'Paid Traffic', 'Instagram',
  'Whatsapp Business', 'Walk In', 'AI Engine', 'Charters Landing Page', 'Event', 'Other',
];

/** RFC-4180 field quoting: wrap in quotes and double any embedded quotes. */
const csvCell = (value: string | null | undefined): string => {
  const s = value ?? '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CSV_COLUMNS: Array<[string, (l: FyiLead) => string | null]> = [
  ['Name', (l) => l.name],
  ['Email', (l) => l.email],
  ['Phone', (l) => l.phone],
  ['Source', (l) => l.source],
  ['Distributed To', (l) => l.distributedTo ?? 'Unassigned'],
  ['Status', (l) => l.status],
  ['State', (l) => l.state],
  ['Brand Interested', (l) => l.brand],
  ['Created', (l) => l.createdAt],
  ['Last Activity', (l) => l.lastActivityAt],
];

/** Download the given leads as a CSV — exactly what's on screen (post-filter). */
function exportLeadsCsv(leads: FyiLead[]): void {
  const header = CSV_COLUMNS.map(([h]) => csvCell(h)).join(',');
  const rows = leads.map((l) => CSV_COLUMNS.map(([, get]) => csvCell(get(l))).join(','));
  const csv = [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fyi-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Lead-source reference tree (FYI's channels — keep accurate)        */
/* ------------------------------------------------------------------ */

interface SourceNode {
  label: string;
  detail?: string;
  children?: SourceNode[];
}

const LEAD_SOURCE_TREE: SourceNode[] = [
  {
    label: 'Website',
    detail: 'fyiyachts.com forms + this yacht-search portal',
    children: [
      { label: 'Contact Broker form', detail: 'Portal inquiry → SMTP to sales@ + CRM webhook → HubSpot contact (owner preserved, else Ralph)' },
      { label: 'Jotform forms', detail: 'Form fill → CRM webhook → HubSpot; re-fills task the current owner' },
      { label: 'Market-alert subscribers', detail: 'Saved boats/searches → HubSpot as marketing subscribers (Market Alert Setters segment) — become sales leads once they inquire' },
    ],
  },
  {
    label: 'Listing marketplaces',
    detail: 'Buyer inquiries on FYI listings',
    children: [
      { label: 'YachtWorld / Boat Trader / Boats.com', detail: 'BoatsGroup → HubSpot integration' },
      { label: 'Yatco', detail: 'Marketplace lead emails' },
    ],
  },
  {
    label: 'Paid ads',
    children: [
      { label: 'FB Paid Ads / Instagram', detail: 'Meta lead ads → CRM (LeadsBridge / webhook) → HubSpot' },
      { label: 'Paid Traffic (Google)', detail: 'Under-tagged in Lead Source — check Original Source for the true count' },
    ],
  },
  {
    label: 'Phone & chat',
    children: [
      { label: 'Answer Connect', detail: 'Phone answering service → HubSpot integration; callers without an email get an @noemail.com placeholder (non-marketing)' },
      { label: 'Website Chat Bot / WhatsApp / AI Engine', detail: 'Conversational channels, synced by their integrations' },
    ],
  },
];

function SourceTreeRow({ node, depth, path, expanded, onToggle }: {
  node: SourceNode; depth: number; path: string;
  expanded: Set<string>; onToggle: (path: string) => void;
}) {
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(path);
  return (
    <div>
      <div
        className="flex items-start gap-2 border-b border-white/10 py-2.5"
        style={{ paddingLeft: `${depth * 22}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(path)}
            aria-expanded={isOpen}
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="mt-0.5 inline-block h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <span className={depth === 0 ? 'font-semibold text-white text-sm' : 'font-medium text-white/90 text-sm'}>
            {node.label}
          </span>
          {node.detail && <p className="mt-0.5 text-xs text-white/55">{node.detail}</p>}
        </div>
      </div>
      {hasChildren && isOpen && node.children!.map((child, i) => (
        <SourceTreeRow
          key={`${path}/${i}`}
          node={child}
          depth={depth + 1}
          path={`${path}/${i}`}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function LeadSourceTree() {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(LEAD_SOURCE_TREE.map((_, i) => String(i)))
  );
  const onToggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  return (
    <div>
      {LEAD_SOURCE_TREE.map((node, i) => (
        <SourceTreeRow key={String(i)} node={node} depth={0} path={String(i)} expanded={expanded} onToggle={onToggle} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminLeadsPage() {
  const { email } = useAuth();
  const [leads, setLeads] = useState<FyiLead[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Nudge state: per-lead in-flight/success/error.
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  const load = useCallback(async (source: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = source !== 'all' ? `?source=${encodeURIComponent(source)}` : '';
      const res = await fetch(`/api/admin/leads${qs}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setLeads(data.leads ?? []);
      setTruncated(!!data.truncated);
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(sourceFilter); }, [sourceFilter, load]);
  useEffect(() => setPage(1), [search, sourceFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.email, l.phone, l.distributedTo].some((v) => v?.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageLeads = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const nudge = async (lead: FyiLead) => {
    setNudging(lead.id);
    setNudgeError(null);
    try {
      const res = await fetch('/api/admin/nudge-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ contactId: lead.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setNudgedIds((prev) => new Set(prev).add(lead.id));
    } catch (e: any) {
      setNudgeError(lead.id);
      console.error('nudge failed:', e?.message);
    } finally {
      setNudging(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <AdminPageHeader
        title="FYI Leads"
        subtitle="Live from FYI HubSpot (portal 3826631)"
        actions={
          <button
            onClick={() => load(sourceFilter)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg hover:bg-[#D4AF37]/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <p className="text-white/70 text-sm mb-1">
        Every lead in FYI's HubSpot, newest first, and the broker each was <strong>distributed to</strong> (the
        contact owner). Filter by Lead Source or search by name, email, phone or rep.
      </p>
      <p className="text-white/50 text-xs mb-4">
        A lead's name shows <span className="font-medium text-emerald-400">green</span> once it has logged
        activity, <span className="font-medium text-amber-400">amber</span> after 12 hours with no activity, and{' '}
        <span className="font-medium text-red-400">red</span> after 24 hours. Use <strong>Nudge owner</strong> on
        a stale lead to add a HubSpot task for its owner and email them.
      </p>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            placeholder="Search name, email, phone or rep…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.07] border border-white/15 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-9 w-full sm:w-52 px-2.5 rounded-lg bg-white/[0.07] border border-white/15 text-white text-sm focus:outline-none focus:border-white/30 [&>option]:bg-yacht-900"
        >
          <option value="all">All sources</option>
          {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => exportLeadsCsv(filtered)}
          disabled={filtered.length === 0}
          title="Download the currently filtered leads as a CSV"
          className="flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-bold text-white/85 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-none border border-white/15 bg-white/[0.04]">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="text-white/55 text-xs border-b border-white/10">
                <th className="py-2.5 pl-5 pr-4 font-medium">Lead</th>
                <th className="py-2.5 pr-4 font-medium">Source</th>
                <th className="py-2.5 pr-4 font-medium">Distributed to</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 pr-4 font-medium">Last activity</th>
                <th className="py-2.5 pr-5 font-medium text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-3 pl-5 pr-5" colSpan={6}>
                      <div className="h-8 rounded bg-white/[0.06] animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-red-300 text-sm">{error}</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Inbox className="w-8 h-8 text-white/25 mx-auto mb-2" />
                    <p className="text-white/55 text-sm">
                      {search || sourceFilter !== 'all' ? 'No leads match your filters.' : 'No leads found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                pageLeads.map((lead) => {
                  const stale = staleness(lead);
                  const justNudged = nudgedIds.has(lead.id);
                  return (
                    <tr key={lead.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-3 pl-5 pr-4">
                        <a
                          href={hubspotContactUrl(lead.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`font-medium text-sm hover:underline ${STALE_NAME_CLASS[stale.level]}`}
                          title={
                            stale.level === 'warn' || stale.level === 'stale'
                              ? `No activity in ~${stale.hours}h · open in HubSpot`
                              : stale.level === 'active'
                                ? 'Has logged activity · open in HubSpot'
                                : 'Open in HubSpot'
                          }
                        >
                          {lead.name}
                        </a>
                        <p className="text-xs text-white/50">
                          {lead.email || '—'}
                          {lead.phone ? ` · ${lead.phone}` : ''}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        {lead.source ? (
                          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300">
                            {lead.source}
                          </span>
                        ) : (
                          <span className="text-white/35 text-xs">Untagged</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {lead.distributedTo ? (
                          <span className="text-white/90">{lead.distributedTo}</span>
                        ) : (
                          <span className="text-amber-400">Unassigned</span>
                        )}
                        {(lead.state || lead.brand) && (
                          <p className="mt-0.5 text-xs text-white/45">
                            {[lead.state, lead.brand].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {/* Nudge owner — only for stale leads (amber/red) that have an owner. */}
                        {(stale.level === 'warn' || stale.level === 'stale' || justNudged) && lead.ownerId && (
                          <div className="mt-1.5">
                            {justNudged ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                                <Check className="w-3.5 h-3.5" /> Owner notified
                              </span>
                            ) : (
                              <button
                                disabled={nudging === lead.id}
                                onClick={() => nudge(lead)}
                                title="Create a HubSpot task for the owner and email them"
                                className="inline-flex items-center gap-1 h-7 px-2 text-xs font-semibold text-white/85 bg-white/10 border border-white/15 rounded-md hover:bg-white/15 transition-colors disabled:opacity-50"
                              >
                                <BellRing className={`w-3 h-3 ${nudging === lead.id ? 'animate-pulse' : ''}`} />
                                {nudging === lead.id ? 'Nudging…' : 'Nudge owner'}
                              </button>
                            )}
                            {nudgeError === lead.id && (
                              <p className="mt-0.5 text-xs text-red-400">Couldn't notify — try again.</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm text-white/70">{lead.status || '—'}</td>
                      <td className="py-3 pr-4 text-sm">
                        {lead.lastActivityAt ? (
                          <span className="text-white/70">{formatDate(lead.lastActivityAt)}</span>
                        ) : (
                          <span
                            className={
                              stale.level === 'stale'
                                ? 'text-red-400'
                                : stale.level === 'warn'
                                  ? 'text-amber-400'
                                  : 'text-white/35'
                            }
                          >
                            No activity
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-5 text-sm text-white/50 text-right whitespace-nowrap">
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer + pagination */}
      {!error && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-3">
          <p className="text-xs text-white/55">
            {filtered.length === 0
              ? 'No leads'
              : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} lead${filtered.length === 1 ? '' : 's'}`}
            {truncated ? ' — most recent only; filter by source to narrow further.' : ''}
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 text-xs font-semibold text-white/85 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                Previous
              </button>
              <span className="whitespace-nowrap text-xs text-white/55">
                Page {currentPage} of {pageCount}
              </span>
              <button
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="h-8 px-3 text-xs font-semibold text-white/85 bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lead sources & ingestion reference */}
      <section className="mt-6 rounded-none border border-white/15 bg-white/[0.04] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
          Lead sources we consume
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-white/50">
          Every channel flowing into FYI's HubSpot today and how each is ingested. Expand a channel
          to see its sub-types. Keep this accurate as sources change.
        </p>
        <div className="mt-4">
          <LeadSourceTree />
        </div>
      </section>

      <p className="text-white/60 text-[11px] mt-4">Signed in as {email}.</p>
    </div>
  );
}
