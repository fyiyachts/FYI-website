// Shared listing-page pieces: the spec table and the photo lightbox.
//
// These used to live in PublicListingPage.tsx, but CharterPages (in the eager
// public bundle) imports them — which dragged the whole listing-detail page
// into the JS every SEO landing page parses, defeating the route-level code
// split in App.tsx. They live alone here so the eager graph gets only these
// two components. PublicListingPage re-exports them for compatibility.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { optImg } from '../../utils/img';
import { useLockBodyScroll } from '../../utils/useLockBodyScroll';

// Label/value spec row — renders every row and shows "--" when unknown.
export function SpecSection({ heading, rows }: { heading: string; rows: [string, string | undefined][] }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">{heading}</h2>
      <dl className="mt-4 border-t border-yacht-900/10">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-yacht-900/10 py-3.5 text-[14px]">
            <dt className="font-light text-yacht-900/55">{k}</dt>
            <dd className={`text-right ${v ? 'font-medium text-yacht-900' : 'font-light text-yacht-900/35'}`}>{v || '--'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Lightbox({ images, title, start, onClose }: { images: string[]; title: string; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const touchX = useRef<number | null>(null);
  useLockBodyScroll(true);
  const next = () => setI((n) => (n + 1) % images.length);
  const prev = () => setI((n) => (n - 1 + images.length) % images.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, onClose]);
  // Swipe navigation for touch devices.
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchX.current = null;
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-yacht-900/97 backdrop-blur-sm" role="dialog" aria-label={`${title} photos`}>
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.25em] text-white/70">{title}</p>
        <div className="flex items-center gap-5">
          <span className="text-[12px] font-light tracking-widest text-white/60">{i + 1} / {images.length}</span>
          <button type="button" onClick={onClose} aria-label="Close photos" className="text-white/70 transition-colors hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
      {/* min-h-0 is load-bearing: a flex child defaults to min-height:auto, so
          without it this pane grows to the photo's intrinsic height instead of
          the viewport's, `max-h-full` on the img then resolves against that
          overgrown box and never clamps, and the overlay's scroll lock means
          the overflow can't be scrolled to. Portrait shots on a 16:9 screen
          lost ~1500px off the bottom, arrows included. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Full view: ~1800px is sharp on a large screen without pulling the original. */}
        <img src={optImg(images[i], 1800)} alt={`${title} — photo ${i + 1}`} className="max-h-full max-w-full select-none object-contain" />
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => setI((n) => (n - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 flex h-20 w-12 -translate-y-1/2 items-center justify-center text-white/60 transition-colors hover:text-yacht-brand">
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => setI((n) => (n + 1) % images.length)}
              className="absolute right-2 top-1/2 flex h-20 w-12 -translate-y-1/2 items-center justify-center text-white/60 transition-colors hover:text-yacht-brand">
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
