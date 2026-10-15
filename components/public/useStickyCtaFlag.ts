import { useEffect } from 'react';

/**
 * Marks the document while a sticky mobile CTA bar is mounted, so other
 * bottom-anchored UI can get out of its way.
 *
 * The Brianna launcher is `fixed bottom-6 right-4` at 56px tall, i.e. it
 * occupies 24–80px from the bottom edge — directly on top of a ~68px sticky
 * bar. That collision already existed on listing and charter-vessel pages
 * (the only two that had a sticky bar); rolling the bar out site-wide would
 * have spread it to every public page, so it is fixed here rather than
 * inherited. The offset itself lives in index.css under `.has-sticky-cta`,
 * scoped to below `lg` because the bar is `lg:hidden`.
 *
 * Reference-counted: charter-vessel pages mount a sticky bar *and* live under
 * a shell, and a page could legitimately end up with two mounts during a
 * transition. Removing the class on the first unmount would drop the offset
 * while a bar was still on screen.
 */

const CLASS = 'has-sticky-cta';
let mounted = 0;

export function useStickyCtaFlag(): void {
  useEffect(() => {
    mounted += 1;
    document.documentElement.classList.add(CLASS);
    return () => {
      mounted -= 1;
      if (mounted <= 0) {
        mounted = 0;
        document.documentElement.classList.remove(CLASS);
      }
    };
  }, []);
}
