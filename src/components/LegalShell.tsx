/*
 * Shared layout for the legal pages (Privacy, Terms). Provides:
 *   - back link
 *   - eyebrow + title + last-updated
 *   - desktop: sticky left-rail table of contents, prose column to the right
 *   - mobile/tablet: collapsed <details> ToC above the prose
 *   - footer cross-link between Privacy and Terms
 *
 * Each section consumer passes is rendered with an `id` anchor so the ToC
 * links jump cleanly. Active-section highlighting uses an IntersectionObserver
 * — small, dependency-free.
 */

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";

export type LegalSection = {
  id: string;
  title: string;
  body: React.ReactNode;
};

type LegalShellProps = {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  lastUpdated: string;
  sections: LegalSection[];
  /** Footer cross-link target: `/privacy` from Terms, `/terms` from Privacy. */
  crossLink: { to: string; label: string };
};

export function LegalShell({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
  crossLink,
}: LegalShellProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // pick the section closest to the top that is currently intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Trigger as a section's top crosses ~25% down the viewport.
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <PageShell>
      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-12 pb-28 relative z-10 animate-fade-in">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-muted-foreground hover:text-cream hover:bg-white/[0.06] transition-colors mb-8 text-sm border border-transparent hover:border-white/[0.08]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Back
        </Link>

        <header className="mb-10 lg:mb-12 max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground mb-4 flex items-center gap-3">
            <span
              className="h-px w-8 bg-gradient-to-r from-transparent via-primary/55 to-primary rounded-full shrink-0"
              aria-hidden
            />
            {eyebrow}
          </p>
          <h1 className="font-serif font-semibold text-3xl md:text-4xl lg:text-[2.75rem] text-cream mb-3 tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{intro}</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-muted-foreground/80">
            Last updated &middot; <span className="text-cream/85">{lastUpdated}</span>
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-16">
          {/* Mobile / tablet: inline collapsible ToC */}
          <details className="group lg:hidden mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-sm">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-muted-foreground hover:text-cream transition-colors">
              <span>Contents</span>
              <span className="text-cream/60 group-open:rotate-180 transition-transform" aria-hidden>
                v
              </span>
            </summary>
            <nav className="px-4 pb-4 pt-1">
              <ol className="space-y-1.5 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block py-1 text-muted-foreground hover:text-cream transition-colors"
                    >
                      <span className="text-muted-foreground/60 tabular-nums mr-2">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>

          {/* Desktop: sticky left-rail ToC */}
          <aside className="hidden lg:block">
            <nav
              aria-label="Table of contents"
              className="lg:sticky lg:top-24 lg:self-start"
            >
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/80 mb-4">
                Contents
              </p>
              <ol className="space-y-0.5 border-l border-white/[0.07]">
                {sections.map((s) => {
                  const active = s.id === activeId;
                  return (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={[
                          "block pl-4 pr-2 py-1.5 -ml-px border-l text-[13px] leading-snug transition-colors",
                          active
                            ? "border-rosegold/80 text-cream"
                            : "border-transparent text-muted-foreground hover:text-cream/90 hover:border-white/20",
                        ].join(" ")}
                      >
                        {s.title}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>

          {/* Prose column */}
          <article className="max-w-prose text-sm text-cream/90 leading-relaxed">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className={[
                  "scroll-mt-28",
                  i === 0 ? "" : "pt-8 mt-8 border-t border-white/[0.06]",
                ].join(" ")}
              >
                <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70 mb-2 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="font-serif font-semibold text-cream text-xl md:text-2xl tracking-tight mb-4">
                  {s.title}
                </h2>
                <div className="space-y-3 text-muted-foreground">{s.body}</div>
              </section>
            ))}
          </article>
        </div>

        <footer className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-muted-foreground/70 max-w-prose lg:ml-[calc(14rem+3rem)] xl:ml-[calc(16rem+4rem)]">
          <span>{lastUpdated}</span>
          <Link to={crossLink.to} className="hover:text-cream transition-colors">
            {crossLink.label} &rarr;
          </Link>
        </footer>
      </main>
    </PageShell>
  );
}
