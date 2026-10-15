import { Link } from 'react-router-dom';
import { Heart, Sparkles } from 'lucide-react';
import { toggleWishlist, useWishlist } from '../public/Wishlist';

// "Create Yacht Profile" opens the site's own Yacht Match quiz (/quiz).
// `name` is kept for call-site compatibility.
export function CreateYachtProfileCta({ id }: { id: string; name: string }) {
  const saved = useWishlist().includes(id);

  return (
    <>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Link
          to="/quiz"
          className="flex flex-col items-center justify-center gap-1.5 bg-yacht-gold py-3 text-center text-[12px] font-semibold uppercase tracking-[0.15em] text-yacht-900 transition-colors hover:bg-yacht-gold-dark"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Create Yacht Profile</span>
        </Link>
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => toggleWishlist(id)}
          className="flex flex-col items-center justify-center gap-1.5 border border-yacht-900/15 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.15em] text-yacht-900/70 transition-colors hover:border-yacht-brand hover:text-yacht-brand"
        >
          <Heart className={`h-4 w-4 shrink-0 ${saved ? 'fill-yacht-brand text-yacht-brand' : ''}`} />
          <span>{saved ? 'Saved' : 'Add To Wishlist'}</span>
        </button>
      </div>
    </>
  );
}
