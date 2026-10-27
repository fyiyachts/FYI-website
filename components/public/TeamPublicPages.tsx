import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Anchor, ArrowRight, Globe2, Languages, Mail, MapPin, Phone } from 'lucide-react';
import { HomeNav, HomeFooter } from '../home/HomePage';
import BriannaWidget from '../chat/BriannaWidget';
import { FYI_TEAM, memberBySlug, repKey, telHref, type TeamMember } from '../team/fyiTeam';
import { FYI_BIOS } from '../team/fyiBios';
import { usePageMeta } from '../../utils/usePageMeta';
import { PublicInquiryForm } from './PublicPages';
import { resizeBG } from './publicData';

/**
 * Public team pages in the new-site design system, mirroring fyiyachts.com's
 * /our-team and /consultants/:slug URLs. Each consultant profile is fed live
 * from the BoatsGroup feed via /api/team/data (SalesRep-matched active +
 * sold boats) — requested by FYI 2026-07-21: "much more prominent team
 * member profiles with their yachts for sale and yachts sold."
 */

interface RepBoat {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  lengthFt?: number;
  priceUsd?: number;
  city?: string;
  state?: string;
  country?: string;
  image?: string;
  status: string;
}

const usd = (n?: number) =>
  n != null && n > 0
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : 'Price on request';

const firstName = (m: TeamMember) => m.name.split(' ')[0];

function MemberPhoto({ member, className }: { member: TeamMember; className: string }) {
  if (member.photo) {
    return <img src={member.photo} alt={member.name} loading="lazy" className={`${className} object-cover object-top`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-yacht-800`}>
      <span className="text-4xl font-light tracking-widest text-yacht-teal">
        {member.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- roster */

export function OurTeamPage() {
  usePageMeta(
    'Our Team | FYI Yachts — Yacht Consultants in Miami',
    'Meet the FYI Yachts team — yacht consultants with 300+ years of combined brokerage experience, each with live listings and sold history.',
    '/our-team/',
  );
  const [counts, setCounts] = useState<Record<string, { active: number; sold: number }>>({});

  useEffect(() => {
    let alive = true;
    fetch('/api/team/data')
      .then(r => r.json())
      .then(d => { if (alive && d?.counts) setCounts(d.counts); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Fixed roster order from fyiTeam.ts. This used to sort by active/sold counts,
  // which meant the team page reshuffled itself whenever the feed moved.
  const roster = useMemo(
    () => FYI_TEAM.map(m => ({ m, c: counts[repKey(m.feedName || m.name)] })),
    [counts],
  );

  return (
    <div className="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
      <HomeNav />
      <header className="bg-yacht-900 px-6 pb-16 pt-32 lg:pt-40">
        <div className="mx-auto max-w-7xl lg:px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">The People Behind the Passion</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-light leading-snug tracking-wide text-white lg:text-5xl">Our Team</h1>
          <p className="mt-5 max-w-2xl text-[15px] font-light leading-7 text-white/70">
            Three hundred years of combined time on the water, under one roof in Coral Gables.
            Every consultant&rsquo;s current listings and sold history — live from our worldwide feed.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roster.map(({ m, c }) => (
            <a key={m.slug} href={`/consultants/${m.slug}`} className="group bg-white shadow-sm transition-shadow duration-500 hover:shadow-xl">
              <div className="relative aspect-[4/5] overflow-hidden bg-yacht-900/5">
                <MemberPhoto member={m} className="h-full w-full transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yacht-900/85 to-transparent p-5 pt-14">
                  <h2 className="text-lg font-semibold tracking-wide text-white">{m.name}</h2>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yacht-teal">{m.title}</p>
                  {m.languages.length > 0 && (
                    <p className="mt-1 text-[11px] font-light tracking-wide text-white/60">{m.languages.join(' · ')}</p>
                  )}
                </div>
              </div>
              {/* Per-broker listing/sold counts were removed on 2026-07-27:
                  context-free numbers beside a name invite disputes from the
                  team. Each profile page still shows the actual vessels. */}
              <div className="flex items-center justify-between p-5">
                <div className="text-[12px] font-light text-yacht-900/60">
                  <span>{m.region || 'FYI Yachts'}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-yacht-brand opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </a>
          ))}
        </div>
      </main>
      <HomeFooter />
      <BriannaWidget />
    </div>
  );
}

/* -------------------------------------------------------------- profile */

function RepBoatCard({ boat, sold }: { boat: RepBoat; sold?: boolean }) {
  const image = boat.image ? resizeBG(boat.image, 900, 600) : undefined;
  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-yacht-900/5">
        {image ? (
          <img src={image} alt={boat.name} loading="lazy" className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${sold ? 'saturate-[0.55]' : ''}`} />
        ) : (
          <div className="flex h-full items-center justify-center"><Anchor className="h-8 w-8 text-yacht-900/20" /></div>
        )}
        {sold ? (
          <span className="absolute left-4 top-4 bg-yacht-brand px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">Sold</span>
        ) : boat.lengthFt ? (
          <span className="absolute left-4 top-4 bg-yacht-900/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-yacht-cream backdrop-blur-sm">
            {Math.round(boat.lengthFt)}&#39;
          </span>
        ) : null}
      </div>
      <div className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-yacht-brand">
          {[boat.year, boat.make].filter(Boolean).join(' ')}
        </p>
        <h3 className="mt-1 truncate text-[16px] font-light tracking-wide text-yacht-900">{boat.name}</h3>
        <div className="mt-3 flex items-center justify-between border-t border-yacht-900/10 pt-3">
          <span className="flex items-center gap-1.5 truncate text-[12px] font-light text-yacht-900/55">
            {boat.city ? (<><MapPin className="h-3.5 w-3.5 shrink-0" />{[boat.city, boat.state || boat.country].filter(Boolean).join(', ')}</>) : (boat.model || '')}
          </span>
          <span className={`shrink-0 text-sm font-semibold ${sold ? 'text-yacht-900/45' : 'text-yacht-900'}`}>
            {sold ? (boat.priceUsd ? `Listed ${usd(boat.priceUsd)}` : 'Sold') : usd(boat.priceUsd)}
          </span>
        </div>
      </div>
    </>
  );

  // Sold boats have no live detail page — showcase only.
  if (sold) return <article className="group bg-white shadow-sm">{body}</article>;
  return (
    <article className="group bg-white shadow-sm transition-shadow duration-500 hover:shadow-xl">
      <a href={`/listing/${boat.id}`} className="block">{body}</a>
    </article>
  );
}

export function ConsultantPage() {
  const { slug = '' } = useParams();
  const member = memberBySlug.get(slug);
  const [boats, setBoats] = useState<{ active: RepBoat[]; sold: RepBoat[] } | null>(null);
  const [soldShown, setSoldShown] = useState(9);

  usePageMeta(
    member ? `${member.name} — ${member.title} | FYI Yachts` : 'Our Team | FYI Yachts',
    member
      ? `${member.name}, ${member.title} at FYI Yachts in ${member.region || 'Miami'} — current yachts for sale and sold history.`
      : 'FYI Yachts consultants.',
    member ? `/consultants/${member.slug}/` : '/our-team/',
  );

  useEffect(() => {
    if (!member) return;
    let alive = true;
    setBoats(null);
    fetch(`/api/team/data?rep=${encodeURIComponent(member.feedName || member.name)}`)
      .then(r => r.json())
      .then(d => { if (alive) setBoats({ active: d?.active ?? [], sold: d?.sold ?? [] }); })
      .catch(() => { if (alive) setBoats({ active: [], sold: [] }); });
    return () => { alive = false; };
  }, [member]);

  if (!member) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-yacht-900 px-6 text-center">
        <Anchor className="h-10 w-10 text-white/30" />
        <p className="text-lg font-light text-white/80">We couldn&rsquo;t find that consultant.</p>
        <a href="/our-team" className="mt-2 bg-yacht-brand px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light">
          Meet the team
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yacht-cream font-sans text-yacht-900 antialiased">
      <HomeNav />

      {/* Profile hero */}
      <header className="bg-yacht-900 px-6 pb-16 pt-28 lg:pt-36">
        <div className="mx-auto grid max-w-7xl items-end gap-10 lg:grid-cols-[280px_1fr] lg:px-2">
          <div className="aspect-[4/5] w-56 overflow-hidden border border-white/10 lg:w-auto">
            <MemberPhoto member={member} className="h-full w-full" />
          </div>
          <div className="pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">{member.title}</p>
            <h1 className="mt-3 text-4xl font-light tracking-wide text-white lg:text-5xl">{member.name}</h1>
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px] font-light text-white/65">
              {member.region && <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-yacht-teal" />{member.region}</span>}
              {member.languages.length > 0 && (
                <span className="flex items-center gap-2"><Languages className="h-4 w-4 text-yacht-teal" />{member.languages.join(' · ')}</span>
              )}
              <span className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-yacht-teal" />Worldwide inventory access</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact-broker" className="bg-yacht-brand px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light">
                Work with {firstName(member)}
              </a>
              <a href={member.phone ? telHref(member.phone) : 'tel:+13058546020'} className="flex items-center gap-2 border border-white/30 px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:border-yacht-brand">
                <Phone className="h-4 w-4" /> {member.phone ?? '305-854-6020'}
              </a>
              {member.email && (
                <a href={`mailto:${member.email}`} className="flex items-center gap-2 border border-white/30 px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:border-yacht-brand">
                  <Mail className="h-4 w-4" /> {member.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        {/* Bio — captured from the consultant's fyiyachts.com page */}
        {FYI_BIOS[member.slug] && (
          <section className="mb-14 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">About {firstName(member)}</p>
            <p className="mt-5 whitespace-pre-line text-[15px] font-light leading-8 text-yacht-900/75">
              {FYI_BIOS[member.slug]}
            </p>
          </section>
        )}

        {/* Active listings */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Current Listings</p>
          <h2 className="mt-3 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">
            Yachts for sale with {firstName(member)}
          </h2>
          {boats === null ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="animate-pulse bg-white shadow-sm">
                  <div className="aspect-[4/3] bg-yacht-900/10" />
                  <div className="space-y-3 p-5"><div className="h-3 w-24 bg-yacht-900/10" /><div className="h-4 w-2/3 bg-yacht-900/10" /></div>
                </div>
              ))}
            </div>
          ) : boats.active.length > 0 ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {boats.active.map(b => <RepBoatCard key={b.id} boat={b} />)}
            </div>
          ) : (
            <p className="mt-6 max-w-xl text-[15px] font-light leading-7 text-yacht-900/60">
              {firstName(member)} is currently between exclusive listings — but sources vessels
              worldwide. Tell {firstName(member)} what you&rsquo;re looking for below.
            </p>
          )}
        </section>

        {/* Sold history */}
        {boats && (boats.sold.length > 0 || !!member.additionalPrivateSales) && (
          <section className="mt-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">Track Record</p>
            <h2 className="mt-3 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">
              A selection of {firstName(member)}&rsquo;s sold boats
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {boats.sold.slice(0, soldShown).map(b => <RepBoatCard key={b.id} boat={b} sold />)}
              {/* Sales with no public listing behind them, so they can never be
                  cards. Sits last in the grid at card height, stated as a count
                  rather than a headline number (client, 2026-08-21). */}
              {!!member.additionalPrivateSales && (
                <article className="flex min-h-[16rem] flex-col items-center justify-center border border-dashed border-yacht-900/20 bg-yacht-cream/60 px-6 py-10 text-center">
                  <p className="text-3xl font-light text-yacht-900">+{member.additionalPrivateSales}</p>
                  <p className="mt-3 text-[13px] font-light leading-6 text-yacht-900/70">
                    additional recent private sales
                  </p>
                  <p className="mt-4 text-[11px] font-light leading-5 text-yacht-900/45">
                    Closed without a public listing
                  </p>
                </article>
              )}
            </div>
            {boats.sold.length > soldShown && (
              <button
                type="button"
                onClick={() => setSoldShown(n => n + 9)}
                className="mt-8 border border-yacht-900/20 px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand"
              >
                Show more sold yachts ({boats.sold.length - soldShown} remaining)
              </button>
            )}
          </section>
        )}

        {/* Contact */}
        <section id="contact-broker" className="mt-16 bg-yacht-900 px-6 py-14 lg:px-14">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-teal">Direct Line</p>
              <h2 className="mt-4 text-2xl font-light tracking-wide text-white lg:text-3xl">
                Work with {member.name}
              </h2>
              <p className="mt-4 text-[15px] font-light leading-7 text-white/70">
                Buying, selling, or just exploring — {firstName(member)} responds within one business day.
              </p>
            </div>
            <PublicInquiryForm context={`Contact ${member.name}`} dark messagePlaceholder="Your message (optional)" />
          </div>
        </section>

        <nav aria-label="More consultants" className="mt-10 text-center">
          <a href="/our-team" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-yacht-brand transition-colors hover:text-yacht-900">
            Meet the whole team <ArrowRight className="h-4 w-4" />
          </a>
        </nav>
      </main>
      <HomeFooter />
      <BriannaWidget />
    </div>
  );
}
