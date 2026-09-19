/**
 * "X has a chaperon on" — what the OTHER person sees when someone in the room
 * turned on a chaperon and chose to say so. This is the consent promise on
 * the setup sheet ("they'll see a small badge") made true.
 *
 * Seeded from the room experience payload (`chaperon_announcements`) and kept
 * live by the server's `chaperon.announce` broadcast, so a chaperon switched
 * on or off mid-call shows within a second. Says presence for a named person
 * and nothing else: never the mode, the checks, or anything it noticed.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, X } from "lucide-react";
import { useRoomSession } from "@/context/RoomSessionContext";
import type { ChaperonAnnouncement } from "@/lib/rooms";
import { cn } from "@/lib/utils";

/** Pure: apply one announce broadcast to the current list. */
export function applyAnnounce(
  list: ChaperonAnnouncement[],
  payload: Record<string, unknown>,
  selfUserId: string | null,
): ChaperonAnnouncement[] {
  const userId = typeof payload.user_id === "string" ? payload.user_id : null;
  if (!userId || userId === selfUserId) return list;
  const rest = list.filter((a) => a.user_id !== userId);
  if (payload.active !== true) return rest;
  const display_name =
    typeof payload.display_name === "string" && payload.display_name.trim()
      ? payload.display_name.trim()
      : "Your date";
  return [...rest, { user_id: userId, display_name }];
}

export function ChaperonAnnounceBadge({
  initial,
  className,
}: {
  /** From the room experience payload; re-fetched on its own poll. */
  initial: ChaperonAnnouncement[];
  className?: string;
}) {
  const session = useRoomSession();
  const [list, setList] = useState<ChaperonAnnouncement[]>(initial);
  const [open, setOpen] = useState(false);
  // A guest's senderId is "guest-<participantId>", never a user id.
  const selfUserId = session.participantId ? null : session.senderId;
  const isGuest = Boolean(session.participantId);

  // The poll can lag a broadcast; a fresh payload wins only when it differs.
  useEffect(() => {
    setList((cur) => {
      const same =
        cur.length === initial.length && cur.every((a, i) => a.user_id === initial[i]?.user_id);
      return same ? cur : initial;
    });
  }, [initial]);

  useEffect(() => {
    return session.channel.onBroadcast((e) => {
      if (e.kind !== "chaperon.announce") return;
      setList((cur) => applyAnnounce(cur, e.payload, selfUserId));
    });
  }, [session.channel, selfUserId]);

  const names = useMemo(() => list.map((a) => a.display_name), [list]);
  if (names.length === 0) return null;
  const who = names.length === 1 ? names[0] : `${names[0]} and ${names.length - 1} more`;

  return (
    <div className={cn("pointer-events-none fixed left-1/2 top-16 z-30 -translate-x-1/2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${who} has a chaperon on`}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-black/50 px-3 py-1.5 text-label font-medium text-cream/85 backdrop-blur transition hover:bg-black/70"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
        <span className="truncate">{who} has a chaperon on</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="About the chaperon"
          className="pointer-events-auto mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-card/95 p-4 text-body leading-relaxed text-cream/85 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <p>
              A chaperon is on for {who}. It listens for safety only, never speaks, and
              nothing it notices is shown to you or kept about you.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="focus-ring -mr-1 -mt-1 rounded-full p-1 text-cream/60 hover:text-cream"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {isGuest && (
            <p className="mt-3 text-label text-muted-foreground">
              Want one watching out for you?{" "}
              <Link to="/auth?src=badge" className="text-primary hover:underline">
                Sign in to get yours
              </Link>{" "}
              for your next date.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
