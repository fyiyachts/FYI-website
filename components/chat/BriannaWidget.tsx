import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import BriannaChatPanel from './BriannaChatPanel';

const GOLD = '#D4AF37';
const AVATAR = '/brianna-avatar.webp';

// Other surfaces (the homepage hero AI search) open Brianna with a query
// pre-sent by dispatching this event with the query as `detail`.
export const ASK_BRIANNA_EVENT = 'fyi:ask-brianna';

// Floating Brianna launcher for the portal itself. The WordPress site gets the
// same experience via public/brianna-embed.js + the /brianna iframe route.
export default function BriannaWidget() {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>();

  useEffect(() => {
    const onAsk = (e: Event) => {
      setInitialQuery((e as CustomEvent<string>).detail || undefined);
      setOpen(true);
    };
    window.addEventListener(ASK_BRIANNA_EVENT, onAsk);
    return () => window.removeEventListener(ASK_BRIANNA_EVENT, onAsk);
  }, []);

  return (
    <>
      {open && (
        <div
          className="brianna-panel fixed bottom-24 right-4 z-50 flex h-[560px] max-h-[calc(100dvh-7rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-none shadow-2xl ring-1 ring-black/10 animate-fade-in-up"
        >
          <BriannaChatPanel onClose={() => setOpen(false)} initialQuery={initialQuery} />
        </div>
      )}
      {/* "Discover" pill launcher — Brianna's headshot + CTA, not a chat bubble. */}
      <button
        type="button"
        onClick={() => { setInitialQuery(undefined); setOpen((v) => !v); }}
        aria-label={open ? 'Close Brianna' : 'Discover yachts with Brianna'}
        className={`brianna-launcher fixed bottom-6 right-4 z-50 flex h-14 items-center rounded-full bg-yacht-900 shadow-xl transition hover:scale-105 ${open ? 'w-14 justify-center' : 'gap-2.5 pl-1.5 pr-5'}`}
        style={{ boxShadow: `0 0 0 2px ${GOLD}, 0 10px 25px rgba(15,39,64,0.4)` }}
      >
        {open ? (
          <X className="h-6 w-6" style={{ color: GOLD }} />
        ) : (
          <>
            <img
              src={AVATAR}
              alt="Brianna"
              className="h-11 w-11 flex-none rounded-full bg-white object-cover"
              style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
            />
            <span className="text-sm font-semibold tracking-wide text-white">Discover</span>
          </>
        )}
      </button>
    </>
  );
}
