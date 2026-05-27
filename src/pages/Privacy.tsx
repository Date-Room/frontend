import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { BRAND_NAME } from "@/lib/constants";
import { PageShell } from "@/components/PageShell";

export default function Privacy() {
  return (
    <PageShell>
      <main className="max-w-xl mx-auto px-6 pt-12 pb-28 relative z-10 animate-fade-in">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-muted-foreground hover:text-cream hover:bg-white/[0.06] transition-colors mb-10 text-sm border border-transparent hover:border-white/[0.08]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Back to settings
        </Link>

        <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground mb-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-primary/55 to-primary rounded-full shrink-0" aria-hidden />
          Legal preview
        </p>

        <h1 className="font-serif italic text-3xl md:text-4xl text-cream mb-3 tracking-tight">Privacy &amp; safety</h1>
        <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
          How {BRAND_NAME} treats your account data in this local-first preview build.
        </p>

        <div className="relative rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-card/95 via-card/45 to-primary/[0.05] backdrop-blur-xl p-7 md:p-8 space-y-8 text-sm text-cream/90 leading-relaxed shadow-[0_28px_90px_rgba(0,0,0,0.38)] ring-1 ring-white/[0.06]">
          <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl opacity-70 hidden md:block" aria-hidden />

          <section className="relative space-y-2">
            <h2 className="font-semibold text-cream text-[15px] tracking-tight">Account data</h2>
            <p className="text-muted-foreground">
              Your email, password hash, and optional profile fields (display name, country, notification preference,
              theme, profile photo as you upload it) are stored in the app&apos;s SQLite database by the API server you
              run. Nothing here is sent to Supabase.
            </p>
          </section>
          <section className="relative space-y-2 pt-6 border-t border-white/[0.07]">
            <h2 className="font-semibold text-cream text-[15px] tracking-tight">Rooms &amp; invites</h2>
            <p className="text-muted-foreground">
              Invites you create are tied to your account. Deleting your account removes those invites from this
              database. Video sessions use LiveKit only with tokens minted by your server—refer to LiveKit&apos;s policy
              for what they retain.
            </p>
          </section>
          <section className="relative space-y-2 pt-6 border-t border-white/[0.07]">
            <h2 className="font-semibold text-cream text-[15px] tracking-tight">Deleting your account</h2>
            <p className="text-muted-foreground">
              You can delete your account from Settings. That clears your login session on this device and removes your
              user row plus invites created under your account from the local database.
            </p>
          </section>
          <section className="relative space-y-2 pt-6 border-t border-white/[0.07]">
            <h2 className="font-semibold text-cream text-[15px] tracking-tight">Questions</h2>
            <p className="text-muted-foreground">
              This page is a concise summary for development builds. Before production launch, replace it with counsel-reviewed legal copy.
            </p>
          </section>
        </div>
      </main>
    </PageShell>
  );
}
