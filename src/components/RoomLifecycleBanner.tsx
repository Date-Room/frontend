import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, DoorClosed, Download, Flame, Hourglass, Loader2, Moon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  cancelRoomClosing,
  confirmRoomDestroy,
  exportRoom,
  renewRoom,
  requestRoomDestroyOtp,
  type Room,
} from "@/lib/rooms";
import {
  downloadBlob,
  isSnoozed,
  lifecycleView,
  snooze,
  type LifecycleTone,
  type LifecycleView,
} from "@/lib/roomLifecycle";

/**
 * The room speaking about its own lifecycle: month ended, gone quiet,
 * kept safe, closing, closed. One warm ramp losing light from stage to
 * stage; never a second hue, never "account" or "non-payment".
 *
 * `expanded` (default) is the full card for the pre-room, lobby and
 * sheets. `compact` is a single row for the top of the live room so the
 * wall stays above the fold; tapping it opens the full card.
 */

const TONE: Record<
  LifecycleTone,
  { border: string; bar: string; icon: string; button: string; Icon: typeof Flame }
> = {
  notice: {
    border: "border-amber/45",
    bar: "bg-amber",
    icon: "text-amber bg-amber/15 border-amber/30",
    button: "bg-amber text-slate-950 hover:bg-amber/90",
    Icon: Flame,
  },
  quiet: {
    border: "border-amber/25",
    bar: "bg-amber/60",
    icon: "text-amber/80 bg-amber/10 border-amber/20",
    button: "bg-amber/75 text-slate-950 hover:bg-amber/65",
    Icon: Moon,
  },
  keepsake: {
    border: "border-[#d9c58a]/30",
    bar: "bg-[#d9c58a]/70",
    icon: "text-[#d9c58a] bg-[#d9c58a]/10 border-[#d9c58a]/25",
    button: "bg-[#d9c58a] text-slate-950 hover:bg-[#d9c58a]/90",
    Icon: BookOpen,
  },
  closing: {
    border: "border-white/[0.14]",
    bar: "bg-white/40",
    icon: "text-cream/80 bg-white/[0.06] border-white/[0.12]",
    button: "bg-[#f3eadd] text-slate-950 hover:bg-[#f3eadd]/90",
    Icon: Hourglass,
  },
  closed: {
    border: "border-white/[0.08]",
    bar: "",
    icon: "text-muted-foreground bg-white/[0.04] border-white/[0.08]",
    button: "bg-white/[0.12] text-cream hover:bg-white/[0.18]",
    Icon: DoorClosed,
  },
};

type Props = {
  room: Room;
  meId?: string | null;
  partnerName?: string | null;
  variant?: "expanded" | "compact";
  className?: string;
  /** Called after a keep/cancel succeeds, with the fresh room. */
  onChanged?: (room: Room) => void;
};

export function RoomLifecycleBanner({
  room,
  meId,
  partnerName,
  variant = "expanded",
  className,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => isSnoozed(room.id));
  const view = lifecycleView(room, { meId, partnerName });
  if (!view) return null;
  if (hidden && view.tone === "notice") return null;

  if (variant === "compact" && !open) {
    return (
      <CompactRow view={view} className={className} onOpen={() => setOpen(true)} />
    );
  }

  const card = (
    <Card
      room={room}
      view={view}
      className={className}
      onChanged={onChanged}
      onSnooze={() => {
        snooze(room.id);
        setHidden(true);
        setOpen(false);
      }}
    />
  );

  if (variant === "compact") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-3 backdrop-blur-sm sm:items-center"
        onClick={() => setOpen(false)}
        role="presentation"
      >
        <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()} role="presentation">
          {card}
        </div>
      </div>
    );
  }
  return card;
}

function CompactRow({
  view,
  className,
  onOpen,
}: {
  view: LifecycleView;
  className?: string;
  onOpen: () => void;
}) {
  const t = TONE[view.tone];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "focus-ring relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-[#100e14]/85 px-3.5 py-2.5 text-left backdrop-blur-md",
        t.border,
        className,
      )}
    >
      {view.progress !== null && (
        <span className="absolute inset-x-0 top-0 h-[2px] bg-white/[0.06]" aria-hidden>
          <span className={cn("block h-full", t.bar)} style={{ width: `${(1 - view.progress) * 100}%` }} />
        </span>
      )}
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", t.icon)}>
        <t.Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-body italic text-cream">{view.headline}</span>
        <span className="block truncate text-label uppercase tracking-[0.18em] text-muted-foreground">
          {view.eyebrow}
        </span>
      </span>
      {view.showKeep && (
        <span className={cn("shrink-0 rounded-full px-3 py-1.5 text-label font-semibold", t.button)}>
          Keep the room
        </span>
      )}
    </button>
  );
}

function Card({
  room,
  view,
  className,
  onChanged,
  onSnooze,
}: {
  room: Room;
  view: LifecycleView;
  className?: string;
  onChanged?: (room: Room) => void;
  onSnooze: () => void;
}) {
  const t = TONE[view.tone];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<null | "keep" | "copy" | "cancel" | "close">(null);
  const [closeStep, setCloseStep] = useState<null | "request" | "code">(null);
  const [code, setCode] = useState("");

  async function refresh(fresh?: Room) {
    await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
    await queryClient.invalidateQueries({ queryKey: ["entitlement"] });
    if (fresh) onChanged?.(fresh);
  }

  async function keep() {
    setBusy("keep");
    try {
      const fresh = await renewRoom(room.id);
      await refresh(fresh);
      toast.success("The room is back.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't keep the room.";
      if (/subscription|credit|402/i.test(msg)) {
        navigate(`/paywall?room=${room.id}`);
        return;
      }
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function saveCopy() {
    setBusy("copy");
    try {
      const blob = await exportRoom(room.id);
      downloadBlob(blob, `dateroom-${room.code}.zip`);
      toast.success("Your copy is downloading.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save a copy.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelClose() {
    setBusy("cancel");
    try {
      const fresh = await cancelRoomClosing(room.id);
      await refresh(fresh);
      toast.success("The room is staying open.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't keep the room.");
    } finally {
      setBusy(null);
    }
  }

  async function sendCloseCode() {
    setBusy("close");
    try {
      await requestRoomDestroyOtp(room.id);
      setCloseStep("code");
      toast.success("We emailed you a code.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmClose() {
    if (code.trim().length < 4) return;
    setBusy("close");
    try {
      await confirmRoomDestroy(room.id, code.trim());
      await refresh();
      toast.success("The room has closed.");
      navigate("/home");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't close the room.");
    } finally {
      setBusy(null);
    }
  }

  const otherAskedToClose = view.closing && !view.closing.requestedByMe;

  return (
    <section
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-[1.35rem] border bg-[#100e14]/85 px-5 py-5 backdrop-blur-xl sm:px-6",
        t.border,
        className,
      )}
    >
      {view.progress !== null && (
        <span className="absolute inset-x-0 top-0 h-[3px] bg-white/[0.06]" aria-hidden>
          <span
            className={cn("block h-full transition-[width] duration-700", t.bar)}
            style={{ width: `${(1 - view.progress) * 100}%` }}
          />
        </span>
      )}
      <p className="text-label font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {view.eyebrow}
      </p>
      <span
        className={cn(
          "mt-3 flex h-10 w-10 items-center justify-center rounded-full border",
          t.icon,
        )}
      >
        <t.Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
      </span>
      <h2 className="mt-3 font-serif text-2xl italic leading-tight text-cream sm:text-[1.7rem]">
        {view.headline}
      </h2>
      <p className="mt-2 max-w-prose text-body leading-relaxed text-muted-foreground">{view.body}</p>

      {closeStep === "code" ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-full border border-white/10 bg-black/30 px-4 py-2.5 text-body text-cream placeholder:text-muted-foreground/50 sm:max-w-[200px]"
          />
          <button
            type="button"
            onClick={() => void confirmClose()}
            disabled={busy !== null || code.trim().length < 4}
            className="rounded-full bg-white/[0.12] px-4 py-2.5 text-body font-semibold text-cream hover:bg-white/[0.18] disabled:opacity-50"
          >
            {busy === "close" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Close the room"}
          </button>
          <button
            type="button"
            onClick={() => setCloseStep(null)}
            className="rounded-full px-4 py-2.5 text-body text-muted-foreground hover:text-cream"
          >
            Never mind
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {view.tone === "closed" ? (
            <button
              type="button"
              onClick={() => navigate("/create")}
              className={cn("rounded-full px-5 py-2.5 text-body font-semibold transition", t.button)}
            >
              Open a new room
            </button>
          ) : null}
          {view.showKeep && view.tone !== "closing" && (
            <button
              type="button"
              onClick={() => void keep()}
              disabled={busy !== null}
              className={cn("rounded-full px-5 py-2.5 text-body font-semibold transition disabled:opacity-60", t.button)}
            >
              {busy === "keep" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Keep the room"}
            </button>
          )}
          {view.tone === "closing" && (
            <button
              type="button"
              onClick={() => void cancelClose()}
              disabled={busy !== null}
              className={cn("rounded-full px-5 py-2.5 text-body font-semibold transition disabled:opacity-60", t.button)}
            >
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Keep the room"}
            </button>
          )}
          {view.showSaveCopy && (
            <button
              type="button"
              onClick={() => void saveCopy()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-body text-cream/85 hover:bg-white/[0.05] disabled:opacity-60"
            >
              {busy === "copy" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              )}
              Save a copy
            </button>
          )}
          {view.showSnooze && (
            <button
              type="button"
              onClick={onSnooze}
              className="rounded-full px-4 py-2.5 text-body text-muted-foreground hover:text-cream"
            >
              Remind me later
            </button>
          )}
          {otherAskedToClose && closeStep === null && (
            <button
              type="button"
              onClick={() => void sendCloseCode()}
              disabled={busy !== null}
              className="ml-auto rounded-full px-4 py-2.5 text-body text-muted-foreground hover:text-cream disabled:opacity-60"
            >
              {busy === "close" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Close it now"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
