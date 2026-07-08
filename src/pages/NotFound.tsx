import { Link } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell className="flex flex-col items-center justify-center px-6 py-16">
      <div className="text-center relative z-10 animate-fade-in max-w-lg w-full space-y-8">
        <div className="relative mx-auto w-[5rem] h-[5rem]">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl motion-reduce:blur-none" aria-hidden />
          <div className="relative flex h-full w-full items-center justify-center rounded-[1.35rem] border border-white/[0.1] bg-card/50 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]">
            <span className="font-serif text-4xl gradient-text select-none">404</span>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/[0.08] bg-card/35 backdrop-blur-xl px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.05] space-y-3">
          <h1 className="font-serif text-2xl md:text-3xl text-cream italic tracking-tight">This room doesn&apos;t exist</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The page you&apos;re looking for has either moved or was never here. Let&apos;s get you somewhere cozy.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="rounded-[1.1rem] px-6 py-3.5 text-sm font-medium border border-white/[0.12] bg-white/[0.04] text-cream hover:bg-white/[0.08] transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" aria-hidden /> Marketing site
          </Link>
          <Link to="/home" className="btn-primary rounded-[1.1rem] py-3.5 px-8 inline-flex items-center justify-center gap-2 shadow-[0_12px_40px_rgba(232,166,83,0.25)]">
            <ArrowLeft className="w-4 h-4 opacity-90" aria-hidden /> My dashboard
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
