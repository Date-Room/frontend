import { Plus } from "lucide-react";

/**
 * Big, expressive activity empty state — an oversized line-art illustration and
 * the activity name in an exaggerated serif, with a single "+" to start.
 */

type Variant = "vision" | "fridge" | "music" | "watch" | "bookshelf";

const svgProps = {
  className: "h-28 w-auto text-primary sm:h-32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ILLUSTRATIONS: Record<Variant, JSX.Element> = {
  vision: (
    <svg viewBox="0 0 120 88" {...svgProps}>
      <rect x="10" y="14" width="46" height="34" rx="4" />
      <path d="M10 40l12-10 9 8 8-6 17 12" />
      <circle cx="23" cy="24" r="3.2" />
      <rect x="68" y="20" width="40" height="52" rx="4" />
      <path d="M68 60l11-9 8 7 7-5 14 10" />
      <circle cx="79" cy="32" r="2.6" />
      <path d="M18 60h30M18 70h18" className="text-primary/45" />
    </svg>
  ),
  fridge: (
    <svg viewBox="0 0 88 108" {...svgProps}>
      <rect x="20" y="6" width="48" height="96" rx="9" />
      <path d="M20 40h48" />
      <path d="M30 18v10" />
      <path d="M30 52v18" />
      {/* heart magnet */}
      <path
        d="M52 60c0-3 2.4-5 5-5 1.8 0 3.2 1 3.8 2.4.6-1.4 2-2.4 3.8-2.4 2.6 0 5 2 5 5 0 4-4.5 7-8.8 10-4.3-3-8.8-6-8.8-10z"
        className="text-primary/55"
      />
    </svg>
  ),
  music: (
    <svg viewBox="0 0 110 96" {...svgProps}>
      <path d="M46 66V20l40-10v46" />
      <circle cx="34" cy="70" r="12" />
      <circle cx="86" cy="60" r="12" />
      <path d="M20 44h14M20 56h10" className="text-primary/45" />
    </svg>
  ),
  watch: (
    <svg viewBox="0 0 120 88" {...svgProps}>
      <rect x="12" y="12" width="96" height="58" rx="7" />
      <path d="M50 32l22 13-22 13V32z" className="text-primary/60" />
      <path d="M44 82h32" />
    </svg>
  ),
  bookshelf: (
    <svg viewBox="0 0 110 96" {...svgProps}>
      <rect x="20" y="14" width="16" height="60" rx="2" />
      <rect x="40" y="22" width="16" height="52" rx="2" />
      <path d="M62 74l10-52 15 4-10 52z" />
      <path d="M14 78h84" strokeWidth={3} />
      <path d="M26 26h4M46 34h4" className="text-primary/45" />
    </svg>
  ),
};

export function EmptyState({
  variant,
  title,
  subtitle,
  onAdd,
  addLabel = "Add",
}: {
  variant: Variant;
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="opacity-90">{ILLUSTRATIONS[variant]}</div>
      <h2 className="font-serif text-5xl font-medium italic leading-[0.92] text-cream drop-shadow-[0_2px_18px_hsl(var(--primary)/0.35)] sm:text-6xl">
        {title}
      </h2>
      {subtitle && <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          className="mt-1 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-[0_14px_38px_-10px_hsl(var(--primary)/0.6)] transition hover:scale-105 hover:opacity-95 active:scale-95"
          style={{ backgroundColor: "var(--room-accent)" }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
