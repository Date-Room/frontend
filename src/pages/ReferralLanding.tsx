import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Sparkles, Smartphone } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { setPendingReferral } from "@/lib/pendingReferral";

/**
 * Referral landing — entry point for `dateroom.io/r/{code}` URLs that
 * someone got from a friend. We stash the code in localStorage so it
 * rides along the next /auth attempt, then show app badges + a
 * "Continue on web" CTA. The pitch is intentionally short — the friend
 * already sold the app, this page just exists to capture the code and
 * funnel onward.
 */
export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (code) setPendingReferral(code);
  }, [code]);

  return (
    <PageShell className="flex items-center justify-center px-6 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="/lobby-hero.png"
          alt=""
          className="w-full h-full object-cover opacity-30 scale-110 blur-sm"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/80 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-md text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rosegold/30 bg-rosegold/10 px-4 py-1.5 text-xs uppercase tracking-widest text-rosegold">
          <Sparkles className="h-3 w-3" /> Invitation
        </div>
        <h1 className="text-4xl font-serif italic text-cream md:text-5xl">
          A friend invited you to DateRoom.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-cream/80">
          Virtual rooms for two — show up, sit together, do something. Bring
          a date. Catch up. Watch a movie. The room is the point.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            to="/auth"
            className="lp-btn inline-flex items-center justify-center"
          >
            Continue on the web
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {[
              { top: "Coming soon on", bot: "App Store" },
              { top: "Coming soon on", bot: "Google Play" },
            ].map((b) => (
              <div
                key={b.bot}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-lpborder bg-lpcard/60 px-5 py-3 text-left opacity-70"
              >
                <Smartphone className="h-5 w-5 text-lpmuted" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-lpmuted">
                    {b.top}
                  </div>
                  <div className="font-serif text-base italic text-lpcream">
                    {b.bot}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {code && (
          <p className="mt-10 text-xs uppercase tracking-widest text-cream/40">
            Invite code: <span className="text-rosegold">{code.toUpperCase()}</span>
          </p>
        )}
      </div>
    </PageShell>
  );
}
