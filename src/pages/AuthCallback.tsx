import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/PageShell";

const REDIRECT_KEY = "post_auth_redirect";

/**
 * Landing page for Supabase magic-link / OAuth redirects. supabase-js
 * (detectSessionInUrl + PKCE) exchanges the code in the URL automatically on
 * client init; we wait for the resulting session, then route the user onward.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;

    function go() {
      if (done) return;
      done = true;
      let dest = "/home";
      try {
        const stashed = sessionStorage.getItem(REDIRECT_KEY);
        if (stashed && stashed.startsWith("/") && !stashed.startsWith("//")) dest = stashed;
        sessionStorage.removeItem(REDIRECT_KEY);
      } catch {
        /* ignore */
      }
      navigate(dest, { replace: true });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go();
    });

    // Cover the case where the session is already present by the time we mount.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });

    // If nothing resolves, surface a retry path rather than hanging forever.
    const timer = window.setTimeout(() => {
      if (!done) setFailed(true);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <PageShell className="flex items-center justify-center">
      <div className="text-center relative z-10 animate-fade-in px-6">
        <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
        {failed ? (
          <>
            <p className="font-serif italic text-cream text-xl mb-2">This link didn't sign you in</p>
            <p className="text-sm text-muted-foreground mb-4">
              It may have expired or already been used.
            </p>
            <button type="button" className="auth-mode-switch" onClick={() => navigate("/auth")}>
              Back to sign in
            </button>
          </>
        ) : (
          <p className="font-serif italic text-cream text-xl">Signing you in…</p>
        )}
      </div>
    </PageShell>
  );
}
