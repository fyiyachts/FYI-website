import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Anchor, ArrowLeft, Languages, Mail, Phone } from 'lucide-react';
import { memberBySlug, telHref } from './fyiTeam';
import { BrokerAvatar } from './TeamPage';
import { boatNameLine, yachtTitle } from '../../utils/boatTitle';
import { optImg } from '../../utils/img';
import { formatMoney, type Money } from '../../api/_lib/price';

const GOLD = '#D4AF37';

interface BrokerBoat {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  lengthFt?: number;
  priceUsd?: number;
  /** Asking price in the listing's own currency (shown); priceUsd is the USD equivalent. */
  listPrice?: Money;
  city?: string;
  state?: string;
  country?: string;
  image?: string;
  status: string;
}

const usd = (n?: number) =>
  n != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : 'Price on request';

function BoatCard({ boat, sold }: { boat: BrokerBoat; sold?: boolean }) {
  // `name` from the feed is the boat's given name, or year/make/model when it
  // has none — so it is the secondary line only when it says something new.
  const title = yachtTitle(boat.year, boat.make, boat.model) || boat.name;
  const priceText = boat.listPrice ? formatMoney(boat.listPrice) : usd(boat.priceUsd);
  const boatName = boatNameLine(boat.name, title);
  const meta = [
    boat.lengthFt ? `${Math.round(boat.lengthFt)} ft` : null,
    [boat.city, boat.state || boat.country].filter(Boolean).join(', ') || null,
  ].filter(Boolean).join(' · ');

  const inner = (
    <div className="overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm transition group-hover:border-yacht-teal group-hover:shadow-md">
      <div className="relative h-36 w-full bg-yacht-900/5">
        {boat.image ? (
          <img src={optImg(boat.image, 480)} alt={title} loading="lazy" className={`h-full w-full object-cover ${sold ? 'saturate-[0.6]' : ''}`} />
        ) : (
          <div className="flex h-full items-center justify-center"><Anchor className="h-8 w-8 text-yacht-900/25" /></div>
        )}
        {sold && (
          <span className="absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white" style={{ background: '#9d7413' }}>
            Sold
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold text-yacht-900">{title}</p>
        {boatName && <p className="truncate text-[12px] font-light italic text-slate-500">{boatName}</p>}
        <p className="text-[13px] font-bold" style={{ color: sold ? '#64748b' : '#9d7413' }}>
          {sold ? (boat.priceUsd != null ? `Listed at ${priceText}` : 'Sold') : priceText}
        </p>
        {meta && <p className="truncate text-[11.5px] text-slate-500">{meta}</p>}
      </div>
    </div>
  );

  // Sold listings usually have no live detail page — render unlinked.
  return sold ? (
    <div>{inner}</div>
  ) : (
    <Link to={`/app/yacht/${boat.id}`} className="group block">{inner}</Link>
  );
}

export default function BrokerPage() {
  const { slug = '' } = useParams();
  const member = memberBySlug.get(slug);
  const [active, setActive] = useState<BrokerBoat[]>([]);
  const [sold, setSold] = useState<BrokerBoat[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!member) return;
    let alive = true;
    setState('loading');
    fetch(`/api/team/data?rep=${encodeURIComponent(member.feedName || member.name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setActive(Array.isArray(d?.active) ? d.active : []);
        setSold(Array.isArray(d?.sold) ? d.sold : []);
        setState('ready');
      })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [member]);

  if (!member) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">Broker not found.</p>
        <Link to="/app/team" className="mt-2 inline-block text-yacht-teal hover:underline">Back to the team</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/app/team" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-yacht-teal">
        <ArrowLeft className="h-4 w-4" /> Broker Team
      </Link>

      {/* Broker hero */}
      <div className="rounded-none bg-gradient-to-r from-yacht-900 to-yacht-700 p-6 text-white">
        <div className="flex flex-wrap items-center gap-5">
          <BrokerAvatar member={member} size="h-24 w-24 flex-none" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{member.name}</h1>
            <p className="text-sm text-white/70">{member.title}{member.region ? ` · ${member.region}` : ''}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white/80">
              <Languages className="h-4 w-4" style={{ color: GOLD }} />
              Speaks {member.languages.join(', ')}
            </p>
          </div>
          <div className="flex flex-none flex-col gap-2 text-[13px]">
            <a href={member.phone ? telHref(member.phone) : 'tel:+13058546020'} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-medium transition hover:bg-white/20">
              <Phone className="h-4 w-4" style={{ color: GOLD }} /> {member.phone ?? '(305) 854-6020'}
            </a>
            <a href={`mailto:${member.email ?? 'sales@fyiyachts.com'}?subject=${encodeURIComponent(`Inquiry for ${member.name}`)}`} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-medium transition hover:bg-white/20">
              <Mail className="h-4 w-4" style={{ color: GOLD }} /> Contact {member.name.split(' ')[0]}
            </a>
          </div>
        </div>
      </div>

      {state === 'loading' && (
        <div className="py-16 text-center text-sm text-slate-400">Loading {member.name.split(' ')[0]}’s inventory…</div>
      )}
      {state === 'error' && (
        <div className="py-16 text-center text-sm text-slate-500">Couldn’t load listings right now — please try again shortly.</div>
      )}

      {state === 'ready' && (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-yacht-900">
              For Sale <span className="text-sm font-semibold text-slate-400">· {active.length}</span>
            </h2>
            {active.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {active.map((b) => <BoatCard key={b.id} boat={b} />)}
              </div>
            ) : (
              <p className="rounded-none border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                No active listings right now.
              </p>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-yacht-900">
              Sold <span className="text-sm font-semibold text-slate-400">· {sold.length}</span>
            </h2>
            {sold.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {sold.map((b) => <BoatCard key={b.id} boat={b} sold />)}
              </div>
            ) : (
              <p className="rounded-none border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                No recorded sales in the feed yet.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
