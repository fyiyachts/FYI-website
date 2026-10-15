import { useCallback, useEffect, useRef, useState } from 'react';
import { Anchor, ArrowUpRight, Check, ChevronDown, Search, Send, X } from 'lucide-react';
import {
  streamBriannaReply,
  submitBriannaLead,
  type ChatTurn,
  type YachtCard,
  type Understood,
  type LeadFormRequest,
} from './briannaClient';
import { toChips } from './briannaFilters';
import { track } from '../../utils/analytics';

const GOLD = '#D4AF37';
// Brianna's persona avatar — headshot supplied by FYI, served from this app.
const AVATAR = '/brianna-avatar.webp';

const GREETING =
  "Welcome aboard — I'm Brianna, your FYI Yachts concierge. Tell me what you're after and I'll pull matching yachts from our live inventory.";

// Concrete, product-relevant example prompts for the hero composer.
const EXAMPLES = [
  'Vessels under $2M in Florida',
  'Boats under 50 feet',
  'Boats over 50 feet',
  "I'd like to sell my yacht",
];

interface Bubble {
  role: 'user' | 'assistant';
  content: string;
  yachts?: YachtCard[];
  understood?: Understood;
  form?: LeadFormRequest;
}

// The in-chat mini contact form. Rendered when Brianna calls the
// show_contact_form tool (or the visitor taps "Have a broker contact me" on a
// yacht card). Submits to /api/chat/brianna-lead — same delivery pipeline as
// the conversational capture (HubSpot + sales desk + CRM broker SMS).
function LeadMiniForm({
  request,
  done,
  onDone,
}: {
  request: LeadFormRequest;
  done: boolean;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState(''); // honeypot — visually hidden
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (done || submitted) {
    return (
      <div className="flex items-center gap-2 rounded-none border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12.5px] font-medium text-emerald-800">
        <Check className="h-4 w-4 flex-none" /> Details sent — a broker will reach out shortly.
      </div>
    );
  }

  const field =
    'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-yacht-teal placeholder:text-slate-400';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (!/.+@.+\..+/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    setError(null);
    setSending(true);
    const res = await submitBriannaLead({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      interest: request.interest,
      company: company || undefined,
    });
    setSending(false);
    if (!res.ok) { setError(res.error || 'Something went wrong — please try again.'); return; }
    setSubmitted(true);
    onDone(name.trim());
  };

  return (
    <form
      onSubmit={submit}
      className="relative rounded-none border bg-white p-3 shadow-sm motion-safe:animate-fade-in-up"
      style={{ borderColor: `${GOLD}66` }}
    >
      <p className="text-[12.5px] font-semibold text-yacht-900">Where should our broker reach you?</p>
      {request.reason && <p className="mt-0.5 text-[11.5px] text-slate-500">{request.reason}</p>}
      <div className="mt-2.5 space-y-2">
        <div>
          <label htmlFor="bl-name" className="mb-0.5 block text-[11px] font-medium text-slate-500">Name</label>
          <input id="bl-name" className={field} autoComplete="name" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
        </div>
        <div>
          <label htmlFor="bl-email" className="mb-0.5 block text-[11px] font-medium text-slate-500">Email</label>
          <input id="bl-email" className={field} type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div>
          <label htmlFor="bl-phone" className="mb-0.5 block text-[11px] font-medium text-slate-500">
            Phone <span className="font-normal text-slate-400">— for a faster callback</span>
          </label>
          <input id="bl-phone" className={field} type="tel" autoComplete="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="(305) 555-0100" />
        </div>
        {/* Honeypot: hidden from humans (incl. screen readers), tempting to bots. */}
        <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="bl-company">Company</label>
          <input id="bl-company" tabIndex={-1} autoComplete="off" value={company}
            onChange={(e) => setCompany(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="mt-2.5 min-h-[44px] w-full rounded-lg bg-yacht-900 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-yacht-700 disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Request broker contact'}
      </button>
      <p className="mt-1.5 text-center text-[10.5px] text-slate-400">
        Only used by FYI Yachts to follow up — never shared.
      </p>
    </form>
  );
}

function YachtCardRow({ card, onContact }: { card: YachtCard; onContact: (card: YachtCard) => void }) {
  const [open, setOpen] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const meta = [
    card.year ? String(card.year) : null,
    card.lengthFt ? `${Math.round(card.lengthFt)} ft` : null,
    card.location,
  ].filter(Boolean).join(' · ');
  const gallery = (card.images && card.images.length ? card.images : card.image ? [card.image] : []);
  const specs: [string, string][] = [
    card.year ? ['Year', String(card.year)] : null,
    card.lengthFt ? ['Length', `${Math.round(card.lengthFt)} ft`] : null,
    card.make ? ['Builder', card.make] : null,
    card.model ? ['Model', card.model] : null,
    card.condition ? ['Condition', card.condition] : null,
    card.cabins ? ['Cabins', String(card.cabins)] : null,
    card.location ? ['Location', card.location] : null,
    card.engines ? ['Engines', card.engines] : null,
    card.cruiseSpeed ? ['Cruise', card.cruiseSpeed] : null,
  ].filter(Boolean) as [string, string][];

  // Clicking the boat opens it in the site's yacht feed. New tab on purpose:
  // it works identically inside the fyiyachts.com embed iframe (where an
  // in-frame navigation would trap the listing in a 400px panel) and it keeps
  // the conversation alive behind the listing.
  const listingUrl = `/listing/${encodeURIComponent(card.id)}`;

  return (
    <div className="overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm">
      {/* Collapsed row: the boat itself opens the listing; the chevron on the
          right expands photos/specs inline without leaving the chat. */}
      <div className="flex items-stretch gap-3 p-2.5">
        <a
          href={listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('chat_listing_open', { listing_id: card.id })}
          className="flex min-w-0 flex-1 items-stretch gap-3 text-left transition hover:opacity-90"
        >
          {card.image ? (
            <img src={card.image} alt={card.title} className="h-20 w-28 flex-none rounded-lg object-cover" loading="lazy" />
          ) : (
            <div className="flex h-20 w-28 flex-none items-center justify-center rounded-lg bg-yacht-900/5">
              <Anchor className="h-6 w-6 text-yacht-900/30" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-yacht-900">{card.title}</p>
            <p className="text-[13px] font-bold" style={{ color: '#9d7413' }}>{card.price}</p>
            {meta && <p className="truncate text-[11px] text-slate-500">{meta}</p>}
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-yacht-teal">
              Open listing
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </a>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Hide details' : 'Show details'}
          title={open ? 'Hide details' : 'Show details'}
          className="flex w-9 flex-none items-center justify-center self-stretch rounded-lg text-slate-400 transition hover:bg-yacht-cream/60 hover:text-yacht-900"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded detail — THIS boat's photos + specs + description. No re-search. */}
      {open && (
        <div className="border-t border-slate-100 px-2.5 pb-3 pt-2.5 motion-safe:animate-fade-in-up">
          {gallery.length > 0 && (
            <>
              <img
                src={gallery[activeImg]}
                alt={`${card.title} — photo ${activeImg + 1}`}
                className="mb-2 h-40 w-full rounded-lg object-cover"
                loading="lazy"
              />
              {gallery.length > 1 && (
                <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
                  {gallery.map((src, i) => (
                    <button
                      key={src + i}
                      type="button"
                      onClick={() => setActiveImg(i)}
                      aria-label={`Photo ${i + 1}`}
                      className={`h-12 w-16 flex-none overflow-hidden rounded-md ${i === activeImg ? 'ring-2 ring-yacht-teal' : 'opacity-70'}`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {specs.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-slate-100 py-0.5">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="truncate font-medium text-yacht-900" title={v}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {card.description && (
            <p className="mt-2 line-clamp-4 text-[12px] leading-relaxed text-slate-600">{card.description}</p>
          )}
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('chat_listing_open', { listing_id: card.id })}
            className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-yacht-900/20 px-3 py-2 text-[12.5px] font-semibold text-yacht-900 transition hover:border-yacht-brand hover:text-yacht-brand"
          >
            View full listing <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => onContact(card)}
            className="mt-2 min-h-[40px] w-full rounded-lg bg-yacht-900 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-yacht-700"
          >
            Have a broker contact me
          </button>
        </div>
      )}
    </div>
  );
}

export default function BriannaChatPanel({ onClose, initialQuery }: { onClose?: () => void; initialQuery?: string }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const userTurns = bubbles.reduce((n, b) => n + (b.role === 'user' ? 1 : 0), 0);
  let lastUserIndex = -1;
  for (let i = bubbles.length - 1; i >= 0; i--) { if (bubbles[i].role === 'user') { lastUserIndex = i; break; } }

  // On each NEW question, bring the visitor's message to the top of the panel
  // so the answer (and any yacht cards) builds in view below it — instead of
  // yanking them to the bottom of a long list of results. We deliberately do
  // NOT auto-scroll as the reply/cards stream in, so their scroll position is
  // respected while they read.
  useEffect(() => {
    if (userTurns === 0) return;
    lastUserRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [userTurns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const isEmpty = bubbles.length === 1 && !busy;

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    setBusy(true);
    if (liveRef.current) liveRef.current.textContent = 'Brianna is searching…';

    const nextBubbles: Bubble[] = [...bubbles, { role: 'user', content: trimmed }];
    setBubbles([...nextBubbles, { role: 'assistant', content: '' }]);

    const history: ChatTurn[] = nextBubbles.map(({ role, content }) => ({ role, content }));
    const controller = new AbortController();
    abortRef.current = controller;

    const patchLast = (fn: (b: Bubble) => Bubble) =>
      setBubbles((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

    streamBriannaReply(history, {
      onText: (delta) => patchLast((b) => ({ ...b, content: b.content + delta })),
      onYachts: (yachts) => patchLast((b) => ({ ...b, yachts: [...(b.yachts ?? []), ...yachts] })),
      onUnderstood: (u) => patchLast((b) => ({ ...b, understood: u })),
      onForm: (f) => patchLast((b) => ({ ...b, form: f })),
      onLead: () => setLeadCaptured(true),
      onError: (message) => patchLast((b) => ({ ...b, content: b.content || message })),
      onDone: () => {
        setBusy(false);
        setBubbles((prev) => {
          const last = prev[prev.length - 1];
          const empty = last.role === 'assistant' && !last.content && !last.yachts?.length && !last.understood && !last.form;
          const result = empty ? prev.slice(0, -1) : prev;
          const a = result[result.length - 1];
          if (liveRef.current) {
            liveRef.current.textContent = a?.understood
              ? `${a.understood.count} yachts shown.`
              : 'Brianna replied.';
          }
          return result;
        });
      },
    }, controller.signal);
  }, [bubbles, busy]);

  // Auto-send a query handed in from another surface (homepage hero AI
  // search) exactly once, when the panel mounts with one.
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialQuery && !initialSentRef.current) {
      initialSentRef.current = true;
      send(initialQuery);
    }
  }, [initialQuery, send]);

  // The visitor submitted the mini form. Confirm in-chat AS an assistant turn
  // so the model sees it in history on later turns and never re-asks.
  const onFormDone = useCallback((name: string) => {
    const first = name.split(/\s+/)[0];
    setLeadCaptured(true);
    setBubbles((prev) => [...prev, {
      role: 'assistant',
      content: `Perfect, ${first} — you're all set. A broker from FYI Yachts will reach out shortly. Anything else I can help you find in the meantime?`,
    }]);
    if (liveRef.current) liveRef.current.textContent = 'Contact details sent. A broker will follow up.';
  }, []);

  // "Have a broker contact me" on a yacht card — open the mini form right in
  // the conversation, prefilled with that yacht as the interest. No model
  // round-trip needed; the onFormDone confirmation keeps history coherent.
  const requestBrokerContact = useCallback((card: YachtCard) => {
    setBubbles((prev) => [
      ...prev,
      leadCaptured
        ? {
            role: 'assistant' as const,
            content: `You're already set — a broker will reach out shortly, and I've noted your interest in the ${card.title} too.`,
          }
        : {
            role: 'assistant' as const,
            content: `Great eye — the ${card.title} is a lovely one. Drop your details below and a broker will be in touch about it.`,
            form: {
              reason: `About the ${card.title} (${card.price})`,
              interest: `Interested in the ${card.title} (${card.price}) — asked for broker contact from the yacht card in chat.`,
            },
          },
    ]);
    // Deliberate exception to the "never yank" scroll rule: the visitor just
    // asked for this form, so bring it into view.
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [leadCaptured]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const startOver = () => {
    abortRef.current?.abort();
    setBusy(false);
    setLeadCaptured(false);
    setBubbles([{ role: 'assistant', content: GREETING }]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-yacht-cream font-sans">
      {/* Header */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-yacht-900 to-yacht-700 px-4 py-3">
        <img
          src={AVATAR}
          alt="Brianna"
          className="h-10 w-10 flex-none rounded-full bg-white object-cover"
          style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-wide text-white">Brianna</p>
          <p className="flex items-center gap-1.5 text-[11px] text-white/70">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            FYI Yachts Concierge
          </p>
        </div>
        {leadCaptured && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: GOLD, border: `1px solid ${GOLD}55`, background: `${GOLD}1a` }}
          >
            Broker notified
          </span>
        )}
        {!isEmpty && (
          <button
            type="button"
            onClick={startOver}
            className="rounded-full px-2 py-1 text-[11px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Start over
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ARIA live region for status/result announcements */}
      <div ref={liveRef} aria-live="polite" className="sr-only" />

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          // Hero empty state — one unmistakable entry point.
          <div className="motion-safe:animate-fade-in-up">
            <div className="mb-3 rounded-none rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-800 shadow-sm">
              {GREETING}
            </div>
            <p className="mb-2 flex items-center gap-2 px-1 text-[12px] font-semibold text-yacht-900">
              <img src={AVATAR} alt="" className="h-5 w-5 rounded-full object-cover" /> Try one of these
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="min-h-[44px] rounded-none border border-yacht-900/15 bg-white px-3 py-2 text-left text-[12.5px] font-medium text-yacht-900 shadow-sm transition hover:border-yacht-teal hover:text-yacht-teal"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          bubbles.map((b, i) => (
            <div
              key={i}
              ref={i === lastUserIndex ? lastUserRef : undefined}
              style={i === lastUserIndex ? { scrollMarginTop: 12 } : undefined}
              className={`motion-safe:animate-fade-in-up ${b.role === 'user' ? 'flex justify-end' : ''}`}
            >
              {b.role === 'user' ? (
                <div className="max-w-[85%] rounded-none rounded-br-sm bg-yacht-900 px-3.5 py-2 text-[13px] leading-relaxed text-white shadow-sm">
                  {b.content}
                </div>
              ) : (
                <div className="max-w-[92%] space-y-2">
                  {(b.content || (busy && i === bubbles.length - 1)) && (
                    <div className="rounded-none rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2 text-[13px] leading-relaxed text-slate-800 shadow-sm whitespace-pre-wrap">
                      {b.content || (
                        <span className="inline-flex gap-1 py-1" aria-label="Brianna is typing">
                          {[0, 1, 2].map((d) => (
                            <span
                              key={d}
                              className="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce"
                              style={{ animationDelay: `${d * 0.15}s` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                  {/* "Here's what I understood" — editable filter chips */}
                  {b.understood && (
                    <div className="rounded-none border border-yacht-900/10 bg-white/70 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Here’s what I understood
                          <span className="text-slate-400"> · {b.understood.count} of {b.understood.total} active</span>
                        </p>
                        {toChips(b.understood.filters).length > 0 && (
                          <button
                            type="button"
                            onClick={() => send('Clear all my filters and show a broad selection again.')}
                            className="flex-none rounded px-1.5 py-0.5 text-[11px] font-medium text-yacht-teal hover:underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                      {toChips(b.understood.filters).length === 0 ? (
                        <p className="text-[12px] text-slate-500">Searching across all active listings — add a budget, size, or brand to narrow it.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {toChips(b.understood.filters).map((chip) => (
                            <span
                              key={chip.key}
                              className="inline-flex items-center gap-1 rounded-full border border-yacht-900/15 bg-white py-1 pl-2.5 pr-1 text-[11.5px] text-yacht-900"
                            >
                              <span className="text-slate-400">{chip.group}:</span> {chip.label}
                              <button
                                type="button"
                                onClick={() => send(chip.removalPhrase)}
                                aria-label={`Remove ${chip.group} filter ${chip.label}`}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-yacht-brand/10 hover:text-yacht-brand"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {b.yachts && b.yachts.length > 0 && (
                    <div className="space-y-2">
                      {b.yachts.map((card) => (
                        <YachtCardRow key={card.id} card={card} onContact={requestBrokerContact} />
                      ))}
                    </div>
                  )}
                  {b.form && (
                    <LeadMiniForm request={b.form} done={leadCaptured} onDone={onFormDone} />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Composer — always prominent, incl. on mobile */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-slate-200 bg-white px-3 py-2.5"
      >
        <label htmlFor="brianna-input" className="sr-only">Ask Brianna what you’re looking for</label>
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-none border border-slate-300 bg-yacht-cream px-3 py-1.5 focus-within:border-yacht-teal">
            <Search className="h-4 w-4 flex-none text-slate-400" />
            <textarea
              id="brianna-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={isEmpty ? 'What are you looking for?' : 'Refine your search or ask a question…'}
              maxLength={2000}
              className="max-h-28 min-h-[24px] w-full resize-none bg-transparent py-1 text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-yacht-900 text-white transition enabled:hover:bg-yacht-700 disabled:opacity-40"
          >
            <Send className="h-4 w-4" style={{ color: GOLD }} />
          </button>
        </div>
      </form>
    </div>
  );
}
