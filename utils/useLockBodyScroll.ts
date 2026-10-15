import { useEffect } from 'react';

/**
 * Locks page scrolling while a modal/overlay is open, so interacting inside
 * the dialog can't scroll the page behind it (FYI bug report 2026-07-17: the
 * create-your-profile modal appeared to strand users on a blank page because
 * the background had scrolled). Restores the previous overflow value on close.
 */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}
