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
        // Soft profile-complete gate. Once signed in, a user with an
        // incomplete profile (no display name, no DOB on file) gets
        // funnelled through /profile/complete with the original
        // target stashed as ?next= for post-completion routing.
        // Excluded paths: the completion page itself, auth pages,
        // settings (where they can edit anyway), and the lobby
        // (perm-room nudge already routes there).
        const exempt =
          isAuthPath ||
          path === "/profile/complete" ||
          path === "/settings" ||
          path.startsWith("/i/");
        if (!current.user.profile_complete && !exempt) {
          const after = `${path}${window.location.search}${window.location.hash}`;
          navigate(`/profile/complete?next=${encodeURIComponent(after)}`, {
            replace: true,
          });
          return;
        }
        if (isAuthPath) navigate("/home", { replace: true });
      } else if (requireAuth && path !== "/auth" && !hasGuestPass) {
        // Preserve the original deep link as ?next= so post-auth lands
        // back here. Big one: a guest tapping a recap link to an
        // ended room signs in and gets routed to that exact recap —
        // doubling as a sign-up funnel since the room shows up on
        // their Recap tab going forward.
        const after = `${path}${window.location.search}${window.location.hash}`;
        const safe = after.startsWith("/") && !after.startsWith("//");
        navigate(
          safe ? `/auth?next=${encodeURIComponent(after)}` : "/auth",
          { replace: true },
        );
      }
    }

    return unsubscribe;
  }, [navigate, requireAuth, guestParam]);

  return <>{children}</>;
};
