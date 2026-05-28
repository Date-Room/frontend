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
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
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

      if (current) {
        if (isAuthPath) navigate("/home", { replace: true });
      } else if (requireAuth && path !== "/auth") {
        navigate("/auth", { replace: true });
      }
    }

    return unsubscribe;
  }, [navigate, requireAuth]);

  return <>{children}</>;
};
