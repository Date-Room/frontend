import { useState } from "react";
import { ChevronLeft, X, LogOut } from "lucide-react";
import { Chat } from "@/components/Chat";
import { WatchTogether } from "@/components/WatchTogether";
import { ThisOrThat } from "@/components/ThisOrThat";
import { DJ } from "@/components/DJ";
import { QuestionDeck } from "@/components/QuestionDeck";
import { The36 } from "@/components/The36";
import { TwoTruths } from "@/components/TwoTruths";
import { TruthOrDare } from "@/components/TruthOrDare";
import { useRoomSession } from "@/context/RoomSessionContext";

/**
 * Activity tray — mirrors mobile's `activity_tray.dart`: a bottom sheet with
 * three views (category grid → activity list → activity). Categories and
 * taglines match mobile exactly.
 */

type ActivityDef = { id: string; label: string; tagline: string; ready: boolean };
type Category = { id: string; label: string; icon: string; activities: ActivityDef[] };

const CATEGORIES: Category[] = [
  {
    id: "games",
    label: "Games",
    icon: "🎮",
    activities: [
      { id: "questions", label: "21 Questions", tagline: "Pick 24, swap decks, take turns.", ready: true },
      { id: "this_or_that", label: "This or That", tagline: "Pick blind, reveal together.", ready: true },
      { id: "the_36", label: "The 36", tagline: "Three sets of twelve. Get closer.", ready: true },
      { id: "2_truths", label: "2 Truths and a Lie", tagline: "Spot the lie. Swap roles.", ready: true },
      { id: "truth_or_dare", label: "Truth or Dare", tagline: "Three cards each. Two skips. Trades welcome.", ready: true },
    ],
  },
  { id: "watch", label: "Watch", icon: "▶️", activities: [{ id: "watch", label: "Watch", tagline: "Sync up something to watch.", ready: true }] },
  { id: "music", label: "Music", icon: "🎧", activities: [{ id: "dj", label: "Music", tagline: "Take turns picking the soundtrack.", ready: true }] },
  { id: "chat", label: "Chat", icon: "💬", activities: [{ id: "chat", label: "Chat", tagline: "Side chat while you play.", ready: true }] },
  { id: "room", label: "Room", icon: "🚪", activities: [{ id: "room_details", label: "Room Details", tagline: "", ready: true }] },
];

function RoomDetails({ onLeave }: { onLeave: () => void }) {
  const room = useRoomSession();
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">You are</p>
        <p className="font-serif italic text-cream text-lg">{room.isHost ? "Host" : "Guest"} · seat {room.slot.toUpperCase()}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">In the room</p>
        <p className="text-sm text-cream">{room.presence.length} connected</p>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="flex items-center justify-center gap-2 rounded-full border border-destructive/40 text-destructive py-3 text-sm hover:bg-destructive/10 transition"
      >
        <LogOut className="w-4 h-4" /> Leave the room
      </button>
    </div>
  );
}

function ActivityView({ id, onLeave }: { id: string; onLeave: () => void }) {
  switch (id) {
    case "chat":
      return <Chat />;
    case "watch":
      return <WatchTogether />;
    case "this_or_that":
      return <ThisOrThat />;
    case "dj":
      return <DJ watchActive={false} />;
    case "questions":
      return <QuestionDeck />;
    case "the_36":
      return <The36 />;
    case "2_truths":
      return <TwoTruths />;
    case "truth_or_dare":
      return <TruthOrDare />;
    case "room_details":
      return <RoomDetails onLeave={onLeave} />;
    default:
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <p className="font-serif italic text-cream/70 text-sm max-w-xs leading-relaxed">
            This one is coming to the web soon — it's live on the app.
          </p>
        </div>
      );
  }
}

export function ActivityTray({ open, onClose, onLeave }: { open: boolean; onClose: () => void; onLeave: () => void }) {
  const [view, setView] = useState<"menu" | string>("menu");
  const category = CATEGORIES.find((c) => c.id === view);
  const activity = CATEGORIES.flatMap((c) => c.activities).find((a) => a.id === view);

  if (!open) return null;

  const title = activity ? activity.label : category ? category.label : "Activities";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-[78vh] rounded-t-3xl glass-strong border-t border-white/10 flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 shrink-0">
          <div className="mx-auto absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-white/20" aria-hidden />
          {view !== "menu" ? (
            <button
              type="button"
              onClick={() => setView(activity && category ? category.id : "menu")}
              className="text-muted-foreground hover:text-cream"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="flex-1 text-center font-serif italic text-cream">{title}</span>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-cream">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto">
          {view === "menu" ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 p-5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setView(c.activities.length === 1 ? c.activities[0].id : c.id)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-primary/15 to-primary/5 p-4 hover:border-primary/35 transition"
                >
                  <span className="text-2xl" aria-hidden>{c.icon}</span>
                  <span className="text-xs text-cream">{c.label}</span>
                </button>
              ))}
            </div>
          ) : activity ? (
            <div className="h-full">
              <ActivityView id={activity.id} onLeave={onLeave} />
            </div>
          ) : category ? (
            <div className="flex flex-col gap-2 p-4">
              {category.activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setView(a.id)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-left hover:border-primary/30 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cream flex items-center gap-2">
                      {a.label}
                      {!a.ready && <span className="text-[9px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-1.5 py-0.5">soon</span>}
                    </p>
                    {a.tagline && <p className="text-xs text-muted-foreground mt-0.5">{a.tagline}</p>}
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground/40 rotate-180" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
