import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/authClient";
import { PageShell } from "@/components/PageShell";

const REDIRECT_KEY = "post_auth_redirect";

/**
 * Landing page for the magic-link click. The email's link points here
 * with `?token=<opaque>`; we hand the token to authClient.verifyLink and
 * route the user onward.
 *
 * Same-device enforcement: /v1/auth/request-otp sets an HttpOnly cookie
 * scoped to /v1/auth on the requesting browser. authClient.verifyLink
 * sends the cookie via `credentials: "include"`; the backend checks it
 * against the OTP row. If the link is opened on a different browser/
 * device the cookie is missing → the user gets nudged to use the code.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = params.get("token");
    const hash = window.location.hash;
    const looksLikeOauthFragment = hash.includes("at=") && hash.includes("rt=");

    function go() {
      let dest = "/home";
      // OAuth path carries the return target as `?next=`; magic-link path
      // historically stashed it in sessionStorage. Honour both, with the
      // URL param winning when present.
      const nextParam = params.get("next");
      if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
        dest = nextParam;
      } else {
        try {
          const stashed = sessionStorage.getItem(REDIRECT_KEY);
          if (stashed && stashed.startsWith("/") && !stashed.startsWith("//")) dest = stashed;
          sessionStorage.removeItem(REDIRECT_KEY);
        } catch {
          /* ignore */
        }
      }
      // Clear the fragment so a refresh doesn't try to re-ingest.
      window.history.replaceState(null, "", window.location.pathname);
      navigate(dest, { replace: true });
    }

    void (async () => {
      // 1) Magic-link path: `?token=…`.
      if (token) {
        try {
          await authClient.verifyLink(token);
          if (cancelled) return;
          go();
        } catch (err) {
          if (cancelled) return;
          setFailed(err instanceof Error ? err.message : "Sign-in link is invalid.");
        }
        return;
      }

      // 2) OAuth path: `#at=…&rt=…&expires_in=…`.
      if (looksLikeOauthFragment) {
        try {
          await authClient.ingestFragment(hash);
          if (cancelled) return;
          go();
        } catch (err) {
          if (cancelled) return;
          setFailed(err instanceof Error ? err.message : "Sign-in didn't complete.");
        }
        return;
      }

      // 3) Bare landing — if signed in, home; else /auth.
      if (cancelled) return;
      if (authClient.getSession()) navigate("/home", { replace: true });
      else navigate("/auth", { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <PageShell className="flex items-center justify-center">
      <div className="text-center relative z-10 animate-fade-in px-6">
        <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
        {failed ? (
          <div className="space-y-3 max-w-md">
            <h1 className="font-serif italic text-cream text-2xl">Sign-in didn't complete</h1>
            <p className="text-muted-foreground text-sm">{failed}</p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:scale-[1.03] transition-transform"
            >
              Try again
            </Link>
          </div>
        ) : (
          <p className="font-serif italic text-cream text-xl">Signing you in…</p>
        )}
      </div>
    </PageShell>
  );
}
