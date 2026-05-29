import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient, type Session } from "@/lib/authClient";

/**
 * Sentinel that drives the public-vs-protected redirect dance.
 *
 * Reads the current session synchronously from authClient (which has
 * already hydrated from localStorage on construction), so there's no
 * loading flash. Listens for changes (sign-in, sign-out, failed
 * refresh) so a token that goes stale mid-session sends the user back
 * to /auth.
 */
export const AuthGuard = ({
  children,
  requireAuth = true,
  /** Allow unauthenticated access when this query param is present —
   * used by /room/:id so anonymous guests with a participant_id from
   * /join can render the room. */
  guestParam,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  guestParam?: string;
}) => {
  const navigate = useNavigate();
  const [, setSession] = useState<Session | null>(authClient.getSession());

  useEffect(() => {
    redirectForSession(authClient.getSession());
    const unsubscribe = authClient.onAuthStateChange((next) => {
      setSession(next);
      redirectForSession(next);
    });

    function redirectForSession(current: Session | null) {
      const path = window.location.pathname;
      const isAuthPath = path === "/auth" || path === "/" || path === "/invite";
      const hasGuestPass = guestParam
        ? new URLSearchParams(window.location.search).has(guestParam)
        : false;

      if (current) {
        if (isAuthPath) navigate("/home", { replace: true });
      } else if (requireAuth && path !== "/auth" && !hasGuestPass) {
        navigate("/auth", { replace: true });
      }
    }

    return unsubscribe;
  }, [navigate, requireAuth, guestParam]);

  return <>{children}</>;
};
