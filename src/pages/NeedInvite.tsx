import { Link } from "react-router-dom";
import { Shield, Lock, ArrowRight, MessageSquare } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { PageShell } from "@/components/PageShell";
import { authClient } from "@/lib/authClient";
import { useEffect, useState } from "react";

export default function NeedInvite() {
  const [hasSession, setHasSession] = useState(authClient.getSession() != null);

  useEffect(() => {
    return authClient.onAuthStateChange((s) => setHasSession(s != null));
  }, []);

  return (
    <PageShell orbs={false} className="flex items-center justify-center px-6 py-16 overflow-hidden">
      {/* Abstract romantic background elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-rosegold/5 rounded-full blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-romantic/5 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />

      <div className="max-w-md w-full relative z-10 text-center animate-scale-in">
        <div className="mb-8 relative inline-block">
          <div className="w-20 h-20 rounded-3xl border border-white/10 bg-secondary/70 flex items-center justify-center mx-auto relative z-10 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Lock className="w-8 h-8 text-rosegold/80" />
          </div>
          <div className="absolute -inset-4 bg-rosegold/20 rounded-full blur-2xl opacity-20 animate-pulse" />
        </div>

        <h1 className="font-serif italic text-cream text-3xl sm:text-4xl mb-4 tracking-tight">
          A private space
        </h1>

        <p className="text-muted-foreground text-sm leading-relaxed mb-10 max-w-xs mx-auto">
          {BRAND_NAME} rooms are personal and secure. To join this date, you'll need the unique invitation link from your partner.
        </p>

        <div className="space-y-4">
          <div className="editorial-card p-5 text-left">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rosegold/10 border border-rosegold/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-rosegold" />
              </div>
              <div>
                <h2 className="text-cream text-sm font-medium mb-1">Check your messages</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Look for an invitation link starting with <code className="text-rosegold/80 italic">/i/...</code> shared by your host.
                </p>
              </div>
            </div>
          </div>

          {hasSession ? (
            <Link
              to="/home"
              className="btn-primary focus-ring flex w-full items-center justify-center gap-2 py-4 group"
            >
              Go to my dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <Link
              to="/"
              className="btn-primary focus-ring flex w-full items-center justify-center gap-2 py-4 group"
            >
              Go to homepage <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            <Shield className="w-3 h-3" /> Encrypted
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            <Lock className="w-3 h-3" /> Private
          </div>
        </div>
      </div>
    </PageShell>
  );
}
