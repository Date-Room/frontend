import { cn } from "@/lib/utils";

/** Basic shadcn skeleton — left in place for any existing call sites. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

/**
 * Shimmer skeleton — a rounded rectangle with an accent-tinted highlight
 * sweeping across it on a ~1400ms loop. Matches the mobile `DrSkeleton`.
 * Use anywhere a value is loading so the page doesn't reflow on data
 * landing.
 *
 * Tuned for dark surfaces: base is the muted card colour, highlight is
 * a warm cream pulse that reads like a candle reflection on glass.
 */
function ShimmerSkeleton({
  className,
  width,
  height = 14,
  rounded = "rounded-lg",
  circle,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  width?: number | string;
  height?: number | string;
  rounded?: string;
  /** Render a perfect circle (sets width=height=size, ignores rounded). */
  circle?: number;
}) {
  const style: React.CSSProperties = circle
    ? { width: circle, height: circle, ...props.style }
    : { width, height, ...props.style };
  return (
    <div
      {...props}
      style={style}
      className={cn(
        "shimmer-skeleton relative overflow-hidden bg-secondary/50",
        circle ? "rounded-full" : rounded,
        className,
      )}
    />
  );
}

export { Skeleton, ShimmerSkeleton };
