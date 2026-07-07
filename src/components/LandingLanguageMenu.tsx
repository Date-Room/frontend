import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe } from "lucide-react";
import { APP_LOCALES, setStoredLocale, type AppLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Open the panel above the trigger (for footer placement). */
  align?: "down" | "up";
  /** Anchor the panel to the left edge of the trigger (default: right). */
  panelSide?: "left" | "right";
  /** Show only the globe icon, hiding the current-language label + chevron. */
  iconOnly?: boolean;
};

/**
 * Language picker styled for the marketing landing page (warm `lp*` palette).
 * Distinct from {@link LanguageSwitcher}, which uses the in-app dark theme.
 */
export function LandingLanguageMenu({
  className,
  align = "down",
  panelSide = "right",
  iconOnly = false,
}: Props) {
  const { i18n } = useTranslation();
  const current = i18n.language as AppLocale;
  const active = APP_LOCALES.find((loc) => loc.code === current) ?? APP_LOCALES[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(code: AppLocale) {
    void i18n.changeLanguage(code);
    setStoredLocale(code);
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={iconOnly ? `Language: ${active.nativeLabel}` : undefined}
        className={cn(
          "flex items-center rounded-full border border-lpborder/60 text-lpmuted transition hover:border-lpborder hover:text-lpcream",
          iconOnly ? "gap-0 p-2" : "gap-1.5 px-3 py-1.5 text-sm",
        )}
      >
        <Globe className="h-4 w-4" />
        {!iconOnly && (
          <>
            <span>{active.nativeLabel}</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
            />
          </>
        )}
      </button>
      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute z-50 min-w-[10rem] overflow-hidden rounded-xl border border-lpborder/60 bg-lpcard shadow-xl",
            panelSide === "left" ? "left-0" : "right-0",
            align === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {APP_LOCALES.map((loc, i) => (
            <li key={loc.code}>
              <button
                type="button"
                role="option"
                aria-selected={current === loc.code}
                onClick={() => pick(loc.code)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-lpcream/85 transition hover:bg-lpcream/[0.06] hover:text-lpcream",
                  i > 0 && "border-t border-lpborder/40",
                )}
              >
                <span className="flex-1">{loc.nativeLabel}</span>
                <span className="text-xs text-lpmuted">{loc.label}</span>
                {current === loc.code && <Check className="h-4 w-4 text-lppeach" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
