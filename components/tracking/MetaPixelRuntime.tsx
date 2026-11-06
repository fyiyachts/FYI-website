import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackMetaPageView } from '../../utils/metaPixel';

/**
 * Meta PageView on the first load and on every client-side route change.
 *
 * Keyed on the pathname only: the inventory filters rewrite the query string
 * on every keystroke, and those are searches (see trackMetaSearch), not new
 * pages. The short delay lets <Navigate replace> redirects settle, so a
 * redirected URL counts once, at its destination. trackMetaPageView ignores a
 * repeat of the same path, so the first load can never fire twice.
 */
export default function MetaPixelRuntime() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = window.setTimeout(() => trackMetaPageView(pathname), 50);
    return () => window.clearTimeout(t);
  }, [pathname]);
  return null;
}
