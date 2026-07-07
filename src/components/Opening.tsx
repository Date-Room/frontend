import { BRAND_NAME } from "@/lib/constants";

export function Opening({ name, onEnter }: { name: string; onEnter: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative">
      <div className="vignette" aria-hidden />

      <div className="text-center relative z-10 flex flex-col items-center gap-8 animate-fade-in">
        {/* Candle */}
        <span
          className="w-2.5 h-2.5 rounded-full bg-rosegold animate-candle-flicker"
          style={{ boxShadow: "0 0 24px hsl(16 52% 62% / 0.5), 0 0 80px hsl(16 52% 62% / 0.15)" }}
          aria-hidden
        />

        <div className="space-y-3 max-w-sm">
          <h1 className="font-serif font-semibold text-cream text-3xl sm:text-4xl leading-snug">
            Welcome, {name}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The room is ready. Take a moment, then step inside.
          </p>
        </div>

        <button
          onClick={onEnter}
          className="btn-primary text-base px-10 py-4 animate-breathe"
        >
          Enter the room
        </button>

        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
          {BRAND_NAME}
        </p>
      </div>
    </div>
  );
}
