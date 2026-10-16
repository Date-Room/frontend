import { Link } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell className="flex flex-col items-center justify-center px-6 py-16">
      <div className="text-center relative z-10 animate-fade-in max-w-lg w-full space-y-8">
        <div className="relative mx-auto w-[5rem] h-[5rem]">
          <div className="absolute inset-0 rounded-full bg-fill/15 blur-2xl motion-reduce:blur-none" aria-hidden />
          <div className="surface-panel elev-tile relative flex h-full w-full items-center justify-center rounded-[1.35rem] border border-hairline backdrop-blur-md">
            <span className="font-serif text-4xl gradient-text select-none">404</span>
          </div>
        </div>

        <div className="surface-panel elev-card rounded-[1.75rem] border border-hairline backdrop-blur-xl px-8 py-10 space-y-3">
          <h1 className="font-serif text-2xl md:text-3xl text-cream italic tracking-tight">This room doesn&apos;t exist</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The page you&apos;re looking for has either moved or was never here. Let&apos;s get you somewhere cozy.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="rounded-[1.1rem] px-6 py-3.5 text-sm font-medium border border-hairline bg-secondary/60 text-cream transition-colors hover:border-primary/25 inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" aria-hidden /> Marketing site
          </Link>
          <Link to="/home" className="btn-primary elev-cta rounded-[1.1rem] py-3.5 px-8 inline-flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4 opacity-90" aria-hidden /> My dashboard
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
