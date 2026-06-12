import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "@/lib/authClient";
import { getAdminMe } from "@/lib/admin";
import { ApiError } from "@/lib/api";

/**
 * Protects /admin/* — requires signed-in platform admin.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = authClient.getSession();
      if (!session) {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        await getAdminMe();
        if (!cancelled) setState("ok");
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          if (!cancelled) setState("denied");
          return;
        }
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm tracking-widest uppercase">Loading admin…</p>
      </div>
    );
  }

  if (state === "denied") {
    const session = authClient.getSession();
    if (!session) {
      return (
        <Navigate
          to={`/auth?next=${encodeURIComponent(location.pathname)}`}
          replace
        />
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-slate-200 font-medium text-lg">Admin access required</p>
          <p className="text-slate-500 text-sm mt-2">
            Your account is not authorized for the DateRoom admin portal. Contact the platform team
            if you believe this is an error.
          </p>
          <a href="/home" className="inline-block mt-6 text-amber-400 text-sm hover:underline">
            Back to app
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
