import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Languages, Sailboat, Tag } from 'lucide-react';
import { FYI_TEAM, repKey, type TeamMember } from './fyiTeam';

const GOLD = '#D4AF37';

interface RepCounts { rep: string; active: number; sold: number }

export function BrokerAvatar({ member, size }: { member: TeamMember; size: string }) {
  const initials = member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return member.photo ? (
    <img
      src={member.photo}
      alt={member.name}
      loading="lazy"
      className={`${size} rounded-full object-cover bg-white`}
      style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
    />
  ) : (
    <div
      className={`${size} rounded-full bg-yacht-900 flex items-center justify-center text-white font-bold`}
      style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
    >
      {initials}
    </div>
  );
}

export default function TeamPage() {
  const [counts, setCounts] = useState<Record<string, RepCounts>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/team/data')
      .then((r) => r.json())
      .then((d) => { if (alive && d?.counts) setCounts(d.counts); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  // Brokers with listings float to the top, most active book first.
  const members = [...FYI_TEAM].sort((a, b) => {
    const ca = counts[repKey(a.feedName || a.name)];
    const cb = counts[repKey(b.feedName || b.name)];
    return ((cb?.active ?? 0) * 100 + (cb?.sold ?? 0)) - ((ca?.active ?? 0) * 100 + (ca?.sold ?? 0));
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-yacht-900">Broker Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          FYI Yachts brokers with their live and sold inventory. Click a broker to see every boat they list.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => {
          const c = counts[repKey(m.feedName || m.name)];
          return (
            <Link
              key={m.slug}
              to={`/app/team/${m.slug}`}
              className="group rounded-none border border-slate-200 bg-white p-5 shadow-sm transition hover:border-yacht-teal hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <BrokerAvatar member={m} size="h-16 w-16 flex-none" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-yacht-900 group-hover:text-yacht-teal">{m.name}</p>
                  <p className="text-[12.5px] text-slate-500">{m.title}{m.region ? ` · ${m.region}` : ''}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-400">
                    <Languages className="h-3.5 w-3.5" /> {m.languages.join(', ')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-yacht-teal/10 px-2.5 py-1 text-[11.5px] font-semibold text-yacht-teal">
                  <Sailboat className="h-3.5 w-3.5" />
                  {loaded ? `${c?.active ?? 0} for sale` : '… for sale'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: `${GOLD}1a`, color: '#9d7413' }}>
                  <Tag className="h-3.5 w-3.5" />
                  {loaded ? `${c?.sold ?? 0} sold` : '… sold'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
