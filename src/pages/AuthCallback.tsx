import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/authClient";
import { clearPendingReferral, getPendingReferral } from "@/lib/pendingReferral";
import { PageShell } from "@/components/PageShell";

const REDIRECT_KEY = "post_auth_redirect";

/** Best-effort iOS / Android sniff. We don't gate web functionality
 *  on this — we only use it to decide whether to *attempt* the
 *  custom-scheme deep-link bounce into the native app first. */
function looksLikeMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

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
 *
 * Mobile-app bounce: when the page loads on a mobile UA with a token,
 * we try the custom-scheme deep link `io.dateroom.app://login-callback?
 * token=…` FIRST. If the iOS app is installed it catches the URL via
 * its deep-link listener and signs the user in there. If nothing
 * grabs the URL within ~1.5s (no app, or Android), we fall through
 * to the regular web verifyLink flow. This is the safety net for
 * the case where Universal Links don't fire — e.g. the user tapped
 * the email link inside Gmail / Outlook / a webview that doesn't
 * dispatch UL.
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

    /** Try to hand a token off to the native app via custom scheme.
     *  Resolves true when the page becomes hidden (iOS / Android moved
     *  us into the app), false on the timeout fallback. */
    function tryNativeBounce(tok: string): Promise<boolean> {
      return new Promise((resolve) => {
        const url = `io.dateroom.app://login-callback?token=${encodeURIComponent(tok)}`;
        // If we lose page visibility, the OS sent us elsewhere — the
        // app caught the URL. Bail without falling through to web
        // verify so we don't burn the one-time token twice.
        const onHide = () => {
          if (document.visibilityState === "hidden") {
            document.removeEventListener("visibilitychange", onHide);
            window.clearTimeout(timer);
            resolve(true);
          }
        };
        document.addEventListener("visibilitychange", onHide);
        // Navigate to the custom scheme. iOS handles via universal-link
        // or scheme handler; Android via intent matching. Desktops
        // throw a polite "Cannot open URL" we never see because the
        // user isn't there.
        window.location.href = url;
        const timer = window.setTimeout(() => {
          document.removeEventListener("visibilitychange", onHide);
          resolve(false);
        }, 1500);
      });
    }

    function go() {
      let dest = "/home";
      // OAuth path carries the return target as `?next=` (or legacy
      // `?redirect=`); magic-link path stashes it in sessionStorage.
      const nextParam = params.get("next") ?? params.get("redirect");
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
        // Mobile bounce first. The custom-scheme URL is the path most
        // resilient to in-app browsers (Gmail / Outlook / etc.) that
        // strip Universal Links. If a native handler takes it, the
        // page goes hidden and we exit; otherwise we proceed with
        // the web verify.
        if (looksLikeMobile()) {
          const caught = await tryNativeBounce(token);
          if (cancelled || caught) return;
        }
        try {
          await authClient.verifyLink(token, getPendingReferral());
          clearPendingReferral();
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
            <h1 className="font-serif font-semibold text-cream text-2xl">Sign-in didn't complete</h1>
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
