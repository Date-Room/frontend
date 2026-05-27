import { useState } from "react";
import { ChevronLeft, ChevronRight, X, LogOut, Gamepad2, Play, Headphones, MessageCircle, DoorOpen, type LucideIcon } from "lucide-react";
import { Chat } from "@/components/Chat";
import { WatchTogether } from "@/components/WatchTogether";
import { ThisOrThat } from "@/components/ThisOrThat";
import { DJ } from "@/components/DJ";
import { QuestionDeck } from "@/components/QuestionDeck";
import { The36 } from "@/components/The36";
import { TwoTruths } from "@/components/TwoTruths";
import { TruthOrDare } from "@/components/TruthOrDare";
import { useRoomSession } from "@/context/RoomSessionContext";
import { cn } from "@/lib/utils";

/**
 * Activity tray — mobile's category model (Games/Watch/Music/Chat/Room), made
 * web-smart: a docked side panel on desktop / bottom sheet on mobile, and
 * per-activity sizing — "media" activities (Watch, DJ) open WIDE so the video
 * has room, while conversation/games use the standard column.
 */

type ActivityDef = { id: string; label: string; tagline: string; ready: boolean; wide?: boolean };
type Category = { id: string; label: string; Icon: LucideIcon; activities: ActivityDef[] };

const CATEGORIES: Category[] = [
  {
    id: "games",
    label: "Games",
    Icon: Gamepad2,
    activities: [
      { id: "questions", label: "21 Questions", tagline: "Pick 24, swap decks, take turns.", ready: true },
      { id: "this_or_that", label: "This or That", tagline: "Pick blind, reveal together.", ready: true },
      { id: "the_36", label: "The 36", tagline: "Three sets of twelve. Get closer.", ready: true },
      { id: "2_truths", label: "2 Truths and a Lie", tagline: "Spot the lie. Swap roles.", ready: true },
      { id: "truth_or_dare", label: "Truth or Dare", tagline: "Three cards each. Two skips. Trades welcome.", ready: true },
    ],
  },
  { id: "watch", label: "Watch", Icon: Play, activities: [{ id: "watch", label: "Watch", tagline: "Sync up something to watch.", ready: true, wide: true }] },
  { id: "music", label: "Music", Icon: Headphones, activities: [{ id: "dj", label: "Music", tagline: "Take turns picking the soundtrack.", ready: true, wide: true }] },
  { id: "chat", label: "Chat", Icon: MessageCircle, activities: [{ id: "chat", label: "Chat", tagline: "Side chat while you play.", ready: true }] },
  { id: "room", label: "Room", Icon: DoorOpen, activities: [{ id: "room_details", label: "Room Details", tagline: "", ready: true }] },
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
          <p className="font-serif italic text-cream/70 text-sm max-w-xs leading-relaxed">Coming to the web soon.</p>
        </div>
      );
  }
}

export function ActivityTray({ open, onClose, onLeave }: { open: boolean; onClose: () => void; onLeave: () => void }) {
  // Separate category vs. activity ids so single-activity categories (Watch,
  // Chat) whose ids match their activity can't collide and break "back".
  const [catId, setCatId] = useState<string | null>(null);
  const [actId, setActId] = useState<string | null>(null);

  const category = CATEGORIES.find((c) => c.id === catId);
  const activity = CATEGORIES.flatMap((c) => c.activities).find((a) => a.id === actId);
  const wide = !!activity?.wide;
  const isMenu = !catId && !actId;

  function openCategory(c: Category) {
    if (c.activities.length === 1) {
      setCatId(c.id);
      setActId(c.activities[0].id);
    } else {
      setCatId(c.id);
      setActId(null);
    }
  }
  function back() {
    if (actId) {
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (cat && cat.activities.length > 1) {
        setActId(null); // back to the category list
      } else {
        setActId(null);
        setCatId(null); // single-activity category → back to menu
      }
    } else {
      setCatId(null);
    }
  }
  function close() {
    setActId(null);
    setCatId(null);
    onClose();
  }

  const title = activity ? activity.label : category ? category.label : "Activities";

  return (
    <>
      {open && (
        <button type="button" aria-label="Close" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "z-50 flex flex-col glass-strong",
          "fixed inset-x-0 bottom-0 h-[80vh] rounded-t-3xl border-t border-white/10 transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
          // Desktop docked column; widens for media activities.
          "lg:static lg:z-auto lg:translate-y-0 lg:h-full lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l transition-[width]",
          wide ? "lg:w-[46vw] xl:w-[42vw]" : "lg:w-[340px] xl:w-[400px]",
        )}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 px-4 py-3 border-b border-border/30 shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-white/20 lg:hidden" aria-hidden />
          {!isMenu ? (
            <button type="button" onClick={back} className="text-muted-foreground hover:text-cream" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="flex-1 text-center font-serif italic text-cream">{title}</span>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-cream lg:hidden" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isMenu ? (
            <div className="flex flex-col gap-2 p-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openCategory(c)}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-card/40 p-4 text-left hover:border-primary/35 hover:bg-white/[0.04] transition"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25 text-primary">
                    <c.Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 text-cream font-medium">{c.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              ))}
            </div>
          ) : actId ? (
            <div className="h-full">
              <ActivityView id={actId} onLeave={onLeave} />
            </div>
          ) : category ? (
            <div className="flex flex-col gap-2 p-4">
              {category.activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActId(a.id)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-left hover:border-primary/30 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-cream flex items-center gap-2">
                      {a.label}
                      {!a.ready && <span className="text-[9px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-1.5 py-0.5">soon</span>}
                    </p>
                    {a.tagline && <p className="text-xs text-muted-foreground mt-0.5">{a.tagline}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
