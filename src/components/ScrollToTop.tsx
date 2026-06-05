import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets window scroll to the top whenever the route pathname changes.
 *
 * Mount once inside <BrowserRouter>, above <Routes>. React Router preserves
 * the window scroll position across navigations by default; users browsing a
 * long page (e.g. Landing) and clicking a footer link to Privacy/Terms land
 * mid-page and have to scroll up. This restores the standard cross-page
 * behaviour.
 *
 * Hash anchors (e.g. /privacy#data-retention) are intentionally left alone so
 * the browser's native anchor scrolling — and in-page ToC jumps within the
 * same pathname — keep working.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default ScrollToTop;
