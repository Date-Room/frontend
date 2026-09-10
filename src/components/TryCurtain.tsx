import { Sparkles } from "lucide-react";

/**
 * The upgrade curtain — shown in Try rooms at a game's chunk boundary,
 * in place of the next-round control. Warm, one line, and deliberately
 * NOT a navigation (leaving a live call to a checkout would kill the
 * date); it plants the wish, the room's end screen does the selling.
 */
export function TryCurtain({ line }: { line?: string }) {
  return (
    <div
      className="flex max-w-sm flex-col items-center gap-2 rounded-2xl border px-5 py-4 text-center animate-fade-in"
      style={{
        borderColor: "color-mix(in srgb, var(--room-accent) 45%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--room-accent) 10%, transparent)",
      }}
    >
      <Sparkles className="h-4 w-4" style={{ color: "var(--room-accent)" }} aria-hidden />
      <p className="font-serif text-base italic text-cream">That's the free taste.</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {line ?? "The whole night lives in a date room — plan one after this call."}
      </p>
    </div>
  );
}
