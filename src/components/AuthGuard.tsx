import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

export const AuthGuard = ({ children, requireAuth = true }: { children: React.ReactNode; requireAuth?: boolean }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data: { session: local } } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(local);
      setLoading(false);
      redirectForSession(local);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      redirectForSession(nextSession);
    });

    function redirectForSession(currentSession: unknown) {
      const path = window.location.pathname;
      const isAuthPath = path === "/auth" || path === "/" || path === "/invite";

      if (currentSession) {
        if (isAuthPath) navigate("/home", { replace: true });
      } else if (requireAuth && path !== "/auth") {
        navigate("/auth", { replace: true });
      }
    }

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, requireAuth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="vignette" aria-hidden />
        <div className="page-grain" aria-hidden />
        <div className="text-center relative z-10 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
          <p className="font-serif italic text-cream text-xl">Entering the space…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
