import { useEffect, useState, type ReactNode } from 'react';
import { X, ExternalLink, ShieldAlert, ChevronRight, Info } from 'lucide-react';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';

/**
 * Shared UI kit for the admin surfaces (Internal Stats, FYI Dashboard,
 * FYI Leads) — FYI's look: deep navy surfaces, a gold hairline accent
 * (from the brand's email styling), serif headings, and a single validated
 * chart palette so every admin chart reads the same.
 */

/* ------------------------------------------------------------------ */
/*  Palette — validated with the dataviz six-checks against #0f2740   */
/* ------------------------------------------------------------------ */

/** Categorical series colors, FIXED order — assign in sequence, never cycle. */
export const CHART_COLORS = ['#3987e5', '#b3861f', '#2ea6ad', '#cf4537', '#9d7bde'] as const;

/** Ordinal ramp (funnel stages, tiers) — one teal hue, light→dark. */
export const FUNNEL_RAMP = ['#8fd8dc', '#4CBBC2', '#2e8f96', '#1d6167'] as const;

/** Gold is a UI accent (rules, highlights) — never a data color. */
export const GOLD = '#D4AF37';

export const TOOLTIP_STYLE = {
  background: '#11142a',
  border: '1px solid rgba(212,175,55,0.35)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
} as const;

const HUBSPOT_PORTAL_ID = '3826631';
export const hubspotContactUrl = (id: string) =>
  `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${id}`;

export const fmt = (n: number) => n.toLocaleString();

/* ------------------------------------------------------------------ */
/*  Page header                                                        */
/* ------------------------------------------------------------------ */

export function AdminPageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-none border border-white/10 px-5 py-4 mb-6"
      style={{ background: 'linear-gradient(135deg, #11142a 0%, #0f2740 60%, #072748 100%)' }}
    >
      {/* Gold hairline — the FYI brand rule */}
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${GOLD}, rgba(212,175,55,0.15))` }} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif font-bold text-xl text-white leading-tight">{title}</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#e8cf7a] uppercase">
              <ShieldAlert className="w-3 h-3" /> Admins only
            </span>
          </div>
          {subtitle && <p className="text-white/55 text-xs mt-1">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section card                                                       */
/* ------------------------------------------------------------------ */

export function AdminCard({ title, subtitle, children, className = '' }: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-none border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ${className}`}>
      {title && (
        <div className="mb-4 border-b border-white/10 pb-3">
          <h2 className="font-serif font-bold text-lg text-white" style={{ borderBottom: `2px solid ${GOLD}`, display: 'inline-block', paddingBottom: 4, marginBottom: -14 }}>
            {title}
          </h2>
          {subtitle && <p className="text-white/55 text-xs mt-4">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI stat tile — optionally drillable                               */
/* ------------------------------------------------------------------ */

export interface DrillTarget {
  metric: string;
  value?: string;
  /** Panel heading, e.g. "Reached out (all-time)". */
  title: string;
}

export function StatTile({ icon, label, value, sub, accent = 'neutral', drill, onDrill, explain }: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  /** neutral = navy · gold = highlight · alert = needs attention */
  accent?: 'neutral' | 'gold' | 'alert' | 'teal';
  drill?: DrillTarget;
  onDrill?: (d: DrillTarget) => void;
  /** How this number is calculated — shown in a hover popover on the ⓘ icon. */
  explain?: string;
}) {
  const accents = {
    neutral: { ring: 'border-white/12', iconBg: 'bg-white/10 text-white/80', valueCls: 'text-white' },
    gold:    { ring: 'border-[#D4AF37]/35', iconBg: 'bg-[#D4AF37]/15 text-[#D4AF37]', valueCls: 'text-white' },
    teal:    { ring: 'border-[#4CBBC2]/35', iconBg: 'bg-[#4CBBC2]/15 text-[#4CBBC2]', valueCls: 'text-white' },
    alert:   { ring: 'border-red-500/40', iconBg: 'bg-red-500/15 text-red-300', valueCls: 'text-red-200' },
  }[accent];

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${accents.iconBg}`}>{icon}</span>
        <span className="text-white/70 text-xs font-semibold leading-tight">{label}</span>
        <span className="ml-auto flex items-center gap-1">
          {explain && (
            <span className="group/info relative inline-flex" onClick={(e) => e.stopPropagation()}>
              <Info className="w-3.5 h-3.5 text-white/35 hover:text-[#D4AF37] transition-colors cursor-help" />
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-6 z-30 hidden w-64 rounded-lg border border-[#D4AF37]/35 bg-yacht-800 p-3 text-left text-[11px] font-normal leading-relaxed text-white/80 shadow-xl group-hover/info:block"
              >
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">How this is calculated</span>
                {explain}
              </span>
            </span>
          )}
          {drill && <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-[#D4AF37] group-hover:translate-x-0.5 transition-all" />}
        </span>
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${accents.valueCls}`}>{value}</div>
      {sub && <div className="text-white/55 text-xs mt-0.5">{sub}</div>}
    </>
  );

  if (drill && onDrill) {
    return (
      <button
        type="button"
        onClick={() => onDrill(drill)}
        title={`See who's behind this number`}
        className={`group text-left rounded-none p-4 border bg-white/[0.05] hover:bg-white/[0.09] hover:border-[#D4AF37]/50 transition-all cursor-pointer ${accents.ring}`}
      >
        {body}
      </button>
    );
  }
  return <div className={`rounded-none p-4 border bg-white/[0.05] ${accents.ring}`}>{body}</div>;
}

/* ------------------------------------------------------------------ */
/*  Drill-down slide-over — the contacts behind a KPI number           */
/* ------------------------------------------------------------------ */

interface DrillLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  distributedTo: string | null;
  status: string | null;
  createdAt: string | null;
  lastActivityAt: string | null;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export function DrillDownPanel({ target, onClose }: {
  target: DrillTarget | null;
  onClose: () => void;
}) {
  const [leads, setLeads] = useState<DrillLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLeads([]);
    const qs = new URLSearchParams({ metric: target.metric });
    if (target.value) qs.set('value', target.value);
    fetch(`/api/admin/drill?${qs}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setLeads(data.leads ?? []);
        setTotal(data.total ?? data.leads?.length ?? 0);
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target]);

  // Esc closes.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  useLockBodyScroll(Boolean(target));

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      {/* Slide-over */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-yacht-800 border-l border-white/10 shadow-2xl flex flex-col">
        <div className="relative shrink-0 px-5 py-4 border-b border-white/10">
          <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${GOLD}, rgba(212,175,55,0.1))` }} />
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-serif font-bold text-white text-lg leading-tight">{target.title}</h3>
              <p className="text-white/55 text-xs mt-0.5">
                {loading
                  ? 'Pulling contacts from HubSpot…'
                  : error
                    ? ' '
                    : `Showing newest ${fmt(leads.length)} of ${fmt(total)} · click a name to open in HubSpot`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="p-5 text-sm text-red-300">{error}</p>
          ) : leads.length === 0 ? (
            <p className="p-5 text-sm text-white/55">No contacts match this metric.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {leads.map((l) => (
                <li key={l.id} className="px-5 py-3 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-baseline justify-between gap-3">
                    <a
                      href={hubspotContactUrl(l.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm text-white hover:text-[#D4AF37] hover:underline inline-flex items-center gap-1.5"
                    >
                      {l.name}
                      <ExternalLink className="w-3 h-3 opacity-40" />
                    </a>
                    <span className="shrink-0 text-xs text-white/45 whitespace-nowrap">{formatDate(l.createdAt)}</span>
                  </div>
                  <p className="text-xs text-white/55 mt-0.5">
                    {l.email || '—'}{l.phone ? ` · ${l.phone}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                    {l.source && <span className="rounded-full bg-[#3987e5]/15 text-[#7db4ee] px-2 py-0.5 font-medium">{l.source}</span>}
                    <span className={l.distributedTo ? 'text-white/65' : 'text-amber-400'}>
                      {l.distributedTo ? `→ ${l.distributedTo}` : 'Unassigned'}
                    </span>
                    {l.status && <span className="text-white/45">{l.status}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
