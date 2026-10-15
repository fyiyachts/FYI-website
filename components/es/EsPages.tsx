import { ArrowRight, Handshake, MapPin, Phone, Ship, TrendingUp } from 'lucide-react';
import { PublicShell, PageHero, PublicInquiryForm, TieredInventory } from '../public/PublicPages';
import { FYI_TEAM } from '../team/fyiTeam';
import { usePageMeta } from '../../utils/usePageMeta';

/**
 * Spanish-language tier (/es) — half our consultants and a large share of
 * the Miami / Latin American market operate in Spanish, and virtually no
 * Florida competitor localizes. Copy written natively, not machine-mirrored.
 * hreflang pairs connect each page to its English counterpart.
 */

const ES_ALTS = (en: string, es: string) => [
  { hreflang: 'en', path: en },
  { hreflang: 'es', path: es },
  { hreflang: 'x-default', path: en },
];

function EsInquiryBand({ heading, sub, context }: { heading: string; sub: string; context: string }) {
  return (
    <section className="bg-yacht-900 px-6 py-16">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="text-2xl font-light tracking-wide text-white lg:text-3xl">{heading}</h2>
          <p className="mt-4 text-[15px] font-light leading-7 text-white/70">{sub}</p>
          <a href="tel:+13058546020" className="mt-8 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.25em] text-yacht-teal transition-colors hover:text-white">
            <Phone className="h-4 w-4" /> 305-854-6020 — hablamos español
          </a>
        </div>
        <PublicInquiryForm context={context} dark messagePlaceholder="Su mensaje (opcional)" />
      </div>
    </section>
  );
}

export function EsHomePage() {
  usePageMeta(
    'FYI Yachts — Compra, Venta y Chárter de Yates en Miami',
    'Florida Yachts International — corretaje de yates en Miami desde 1994. Compra, venta, chárter y financiamiento de yates, con consultores que hablan español.',
    '/es/',
    ES_ALTS('/', '/es/'),
  );
  const services = [
    { icon: Ship, title: 'Comprar un yate', text: 'Inventario mundial de unos 140 yates en vivo — desde center consoles hasta superyates — con consultores expertos que lo guían de la búsqueda al cierre.', href: '/yachts-for-sale' },
    { icon: TrendingUp, title: 'Vender su yate', text: 'Marketing a medida, una red mundial de compradores y brokers que negocian por oficio. Solicite una valoración gratuita.', href: '/es/vender' },
    { icon: Handshake, title: 'Chárter de lujo', text: 'Chárters con tripulación desde Miami — capitán, tripulación, combustible y aprovisionamiento organizados por FYI.', href: '/es/charter' },
  ];
  return (
    <PublicShell>
      <PageHero
        eyebrow="Desde 1994 · Miami"
        h1="Su brokerage de yates en Miami"
        intro="Florida Yachts International — más de 300 años de experiencia combinada en compra, venta y chárter de yates. Atención completa en español."
      />
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {services.map((s) => (
            <a key={s.href} href={s.href} className="group block bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <s.icon className="h-7 w-7 text-yacht-brand" />
              <h2 className="mt-5 text-xl font-light tracking-wide text-yacht-900">{s.title}</h2>
              <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">{s.text}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-brand">
                Ver más <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
        <div className="mt-14 border-t border-yacht-900/10 pt-10 text-center">
          <p className="flex items-center justify-center gap-2 text-[14px] font-light text-yacht-900/70">
            <MapPin className="h-4 w-4 text-yacht-teal" />
            2424 Coral Way, Miami, FL 33145 — sobre Coral Way, a minutos de Coral Gables y Coconut Grove
          </p>
          <p className="mt-3 text-[14px] font-light text-yacht-900/70">
            Nuestros consultores atienden a compradores y vendedores de Latinoamérica, España y todo el mundo hispanohablante.
          </p>
        </div>
      </section>
      <EsInquiryBand
        heading="Hable con un broker"
        sub="Un especialista le responde dentro de un día hábil — en español o inglés."
        context="Consulta en español (página /es)"
      />
    </PublicShell>
  );
}

export function EsSellPage() {
  usePageMeta(
    'Venda su Yate en Miami | FYI Yachts',
    'Venda su yate con Florida Yachts International — marketing a medida, red mundial de compradores y cierre completo (fideicomiso, documentación y titulación) gestionado por FYI.',
    '/es/vender/',
    ES_ALTS('/sell/', '/es/vender/'),
  );
  return (
    <PublicShell>
      <PageHero
        eyebrow="Venda con FYI"
        h1="Venda su yate con quien más vende en Miami"
        intro="Tres décadas de cierres, una red mundial de compradores y consultores que negocian por oficio — con todo el proceso disponible en español."
      />
      <article className="mx-auto max-w-3xl px-6 py-14 lg:px-0">
        <section>
          <h2 className="text-xl font-light tracking-wide text-yacht-900 lg:text-2xl">Marketing que mueve embarcaciones</h2>
          <p className="mt-4 text-[15px] font-light leading-8 text-yacht-900/75">
            Su embarcación se comercializa con fotografía y video profesional en nuestros canales, que alcanzan a más de 50.000 personas por día. Calificamos a cada comprador antes de subir a bordo, y nuestro equipo de cierre maneja fideicomiso, documentación y titulación de principio a fin.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-light tracking-wide text-yacht-900 lg:text-2xl">Resultados comprobados</h2>
          <p className="mt-4 text-[15px] font-light leading-8 text-yacht-900/75">
            Vea nuestros cierres recientes en la página de <a href="/sold-yachts" className="text-yacht-brand underline decoration-yacht-brand/30 underline-offset-2">yates vendidos</a> — actualizada en vivo con cada venta. Cuando esté listo, un consultor le prepara una valoración de mercado gratuita y sin compromiso.
          </p>
        </section>
      </article>
      <EsInquiryBand
        heading="Solicite su valoración gratuita"
        sub="Cuéntenos sobre su embarcación y un consultor le responde dentro de un día hábil."
        context="Vender mi yate (página /es/vender)"
      />
    </PublicShell>
  );
}

export function EsCharterPage() {
  usePageMeta(
    'Chárter de Yates en Miami | FYI Yachts',
    'Chárters de lujo con tripulación desde Miami — capitán, tripulación, combustible y aprovisionamiento organizados por Florida Yachts International. Atención en español.',
    '/es/charter/',
    ES_ALTS('/charter/', '/es/charter/'),
  );
  return (
    <PublicShell>
      <PageHero
        eyebrow="Chárter de Lujo"
        h1="Miami desde el agua"
        intro="Chárters con tripulación de 72 a 105 pies desde Miami — un día en Biscayne Bay, un fin de semana en las Bahamas o una temporada completa, todo organizado por FYI."
      />
      <article className="mx-auto max-w-3xl px-6 py-14 lg:px-0">
        <section>
          <h2 className="text-xl font-light tracking-wide text-yacht-900 lg:text-2xl">Todo incluido, todo organizado</h2>
          <p className="mt-4 text-[15px] font-light leading-8 text-yacht-900/75">
            Cada chárter incluye capitán y tripulación profesional, combustible y aprovisionamiento a su gusto — desde $3,600, con impuestos incluidos en todas las tarifas. Nuestros consultores diseñan el programa según su grupo: celebraciones, pesca deportiva, o simplemente un día perfecto en el agua.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-light tracking-wide text-yacht-900 lg:text-2xl">De chárter a propietario</h2>
          <p className="mt-4 text-[15px] font-light leading-8 text-yacht-900/75">
            ¿Le gustó la experiencia? Pregunte por nuestro programa <a href="/lease-to-own" className="text-yacht-brand underline decoration-yacht-brand/30 underline-offset-2">lease-to-own</a> y el <a href="/yacht-financing" className="text-yacht-brand underline decoration-yacht-brand/30 underline-offset-2">financiamiento marino</a> — caminos flexibles hacia la propiedad, incluso con pagos en criptomonedas.
          </p>
        </section>
      </article>
      <EsInquiryBand
        heading="Reserve su chárter"
        sub="Díganos la fecha y el tamaño de su grupo, y armamos las opciones."
        context="Chárter (página /es/charter)"
      />
    </PublicShell>
  );
}

/* ----------------------------------------------- expanded tier (2026-07-28) */

export function EsInventoryPage() {
  usePageMeta(
    'Yates en Venta | Inventario Mundial | FYI Yachts',
    'Explore el inventario mundial de Florida Yachts International — yates a motor, deportivos, pesca deportiva y superyates, con consultores que hablan español.',
    '/es/inventario/',
    ES_ALTS('/yachts-for-sale/', '/es/inventario/'),
  );
  return (
    <PublicShell>
      <PageHero
        eyebrow="Inventario Mundial"
        h1="Yates en venta"
        intro="Alrededor de 140 embarcaciones en vivo — desde center consoles hasta superyates — y acceso a miles más a través de nuestra red mundial. Los datos de cada yate se muestran tal como los publica el astillero o el broker."
      />
      {/* The grid itself (filters, cards) is shared with the English tier — the
          specs are language-neutral, and duplicating the whole search UI in
          Spanish would fork it. The wrapper copy is what gets localized. */}
      <TieredInventory
        filter={() => true}
        emptyNote="No hay resultados en este momento — díganos qué busca y lo encontramos en el mercado mundial."
      />
      <EsInquiryBand
        heading="¿No encuentra lo que busca?"
        sub="Describa la embarcación — astillero, eslora, presupuesto — y un consultor le presenta opciones dentro de un día hábil, incluyendo yates que nunca llegan a publicarse."
        context="Búsqueda de yate (página /es/inventario)"
      />
    </PublicShell>
  );
}

export function EsFinancingPage() {
  usePageMeta(
    'Financiamiento de Yates | FYI Yachts',
    'Financiamiento marino con Florida Yachts International — préstamos para yates nuevos y usados, seguros y titulación, explicados en español.',
    '/es/financiamiento/',
    ES_ALTS('/yacht-financing/', '/es/financiamiento/'),
  );
  const steps: [string, string][] = [
    ['Precalificación', 'Revisamos su perfil y el tipo de embarcación para orientarle sobre montos, plazos y tasas realistas antes de comprometerse con nada.'],
    ['La solicitud', 'Trabajamos con prestamistas marinos especializados — la documentación difiere de una hipoteca, y nuestro equipo la prepara con usted.'],
    ['El cierre', 'Seguro vigente al cierre, fideicomiso, documentación y titulación — todo coordinado por FYI, en español si así lo prefiere.'],
  ];
  return (
    <PublicShell>
      <PageHero
        eyebrow="Financiamiento Marino"
        h1="Financie su yate con expertos"
        intro="Un préstamo marino no es una hipoteca: el tipo de embarcación, su uso (privado o chárter) y dónde se registre cambian las condiciones. Le explicamos todo en su idioma."
      />
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map(([title, body]) => (
            <div key={title} className="border-t-2 border-yacht-brand pt-5">
              <h2 className="text-lg font-light tracking-wide text-yacht-900">{title}</h2>
              <p className="mt-3 text-[14px] font-light leading-7 text-yacht-900/70">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-3xl text-[15px] font-light leading-8 text-yacht-900/75">
          También ofrecemos caminos flexibles hacia la propiedad — incluyendo{' '}
          <a href="/lease-to-own" className="text-yacht-brand underline decoration-yacht-brand/30 underline-offset-2">lease-to-own</a>{' '}
          y pagos en criptomonedas. Use la{' '}
          <a href="/yacht-financing" className="text-yacht-brand underline decoration-yacht-brand/30 underline-offset-2">calculadora de financiamiento</a>{' '}
          para estimar su pago mensual.
        </p>
      </section>
      <EsInquiryBand
        heading="Hable con nuestro equipo de financiamiento"
        sub="Cuéntenos qué embarcación tiene en mente y le orientamos sin compromiso."
        context="Financiamiento (página /es/financiamiento)"
      />
    </PublicShell>
  );
}

export function EsTeamPage() {
  usePageMeta(
    'Nuestro Equipo | FYI Yachts',
    'Conozca a los consultores de Florida Yachts International — 300+ años de experiencia combinada, muchos de ellos con atención completa en español.',
    '/es/equipo/',
    ES_ALTS('/our-team/', '/es/equipo/'),
  );
  // Spanish speakers first — the reason a Spanish-speaking visitor is on this
  // page is to find someone to call in their own language.
  const roster = [...FYI_TEAM].sort(
    (a, b) => Number(b.languages.includes('Spanish')) - Number(a.languages.includes('Spanish')),
  );
  return (
    <PublicShell>
      <PageHero
        eyebrow="Nuestro Equipo"
        h1="Consultores que hablan su idioma"
        intro="Trescientos años de experiencia combinada bajo un mismo techo en Miami. Los consultores marcados «Español» le atienden de principio a fin en español."
      />
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roster.map((m) => (
            <a key={m.slug} href={`/consultants/${m.slug}`} className="group bg-white shadow-sm transition-shadow duration-500 hover:shadow-xl">
              <div className="relative aspect-[4/5] overflow-hidden bg-yacht-900/5">
                {m.photo && (
                  <img
                    src={m.photo}
                    alt={m.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yacht-900/85 to-transparent p-5 pt-14">
                  <h2 className="text-lg font-semibold tracking-wide text-white">{m.name}</h2>
                  {m.languages.includes('Spanish') && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yacht-teal">Español</p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>
      <EsInquiryBand
        heading="¿No sabe con quién empezar?"
        sub="Cuéntenos qué busca y lo conectamos con el consultor indicado — en español."
        context="Consulta de equipo (página /es/equipo)"
      />
    </PublicShell>
  );
}

export function EsContactPage() {
  usePageMeta(
    'Contacto | FYI Yachts',
    'Contacte a Florida Yachts International en Miami — teléfono, WhatsApp y formulario, con atención completa en español.',
    '/es/contacto/',
    ES_ALTS('/contact/', '/es/contacto/'),
  );
  return (
    <PublicShell>
      <PageHero
        eyebrow="Contacto"
        h1="Hablemos de su próximo yate"
        intro="Llámenos, escríbanos por WhatsApp o deje sus datos — un consultor le responde dentro de un día hábil, en español o inglés."
      />
      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/50">Teléfono</h2>
            <a href="tel:+13058546020" className="mt-2 block text-lg font-light text-yacht-900 hover:text-yacht-brand">305-854-6020</a>
          </div>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/50">WhatsApp</h2>
            <a href="https://wa.me/17863538073" className="mt-2 block text-lg font-light text-yacht-900 hover:text-yacht-brand">+1 786-353-8073</a>
          </div>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/50">Oficina</h2>
            <p className="mt-2 text-[15px] font-light leading-7 text-yacht-900/75">2424 Coral Way<br />Miami, FL 33145</p>
          </div>
        </div>
      </section>
      <EsInquiryBand
        heading="Escríbanos"
        sub="Compra, venta, chárter o financiamiento — díganos en qué le ayudamos."
        context="Contacto (página /es/contacto)"
      />
    </PublicShell>
  );
}
