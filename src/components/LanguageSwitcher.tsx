import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe } from "lucide-react";
import { APP_LOCALES, setStoredLocale, type AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Compact row for settings list */
  variant?: "row" | "list";
  /** List variant starts collapsed when true (default). */
  defaultCollapsed?: boolean;
  onPicked?: () => void;
};

export function LanguageSwitcher({
  className,
  variant = "list",
  defaultCollapsed = true,
  onPicked,
}: Props) {
  const { i18n, t } = useTranslation();
  const current = i18n.language as AppLocale;
  const [open, setOpen] = useState(!defaultCollapsed);
  const active = APP_LOCALES.find((loc) => loc.code === current) ?? APP_LOCALES[0];

  function pick(code: AppLocale) {
    void i18n.changeLanguage(code);
    setStoredLocale(code);
    onPicked?.();
  }

  if (variant === "row") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {APP_LOCALES.map((loc) => (
          <button
            key={loc.code}
            type="button"
            onClick={() => pick(loc.code)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition",
              current === loc.code
                ? "border-amber/50 bg-amber/15 text-cream"
                : "border-white/10 bg-white/[0.03] text-cream/70 hover:border-white/20 hover:text-cream",
            )}
          >
            {loc.nativeLabel}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card/40 px-4 py-3.5 text-left transition hover:bg-white/[0.025]"
      >
        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("language.title")}
        </span>
        <span className="ml-auto text-[15px] text-cream">{active.nativeLabel}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          {APP_LOCALES.map((loc, i) => (
            <button
              key={loc.code}
              type="button"
              onClick={() => pick(loc.code)}
              className={cn(
                "flex w-full items-center px-4 py-3.5 text-left transition hover:bg-white/[0.025]",
                i > 0 && "border-t border-border/60",
              )}
            >
              <span className="flex-1 text-[15px] text-cream">{loc.nativeLabel}</span>
              <span className="mr-3 text-xs text-muted-foreground">{loc.label}</span>
              {current === loc.code && <Check className="h-4 w-4 text-amber" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
