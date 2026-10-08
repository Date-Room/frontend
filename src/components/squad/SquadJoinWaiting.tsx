/**
 * Opening a squad link when the squad lets people in by approval: until
 * the owner or a co-host says yes, you see only the invite card (the
 * squad's name, its host, who's in) and wait. Checks every few seconds;
 * approved -> `onApproved` (the lobby joins again, now for real). Also the
 * screens for "not this time", a locked room, and having been removed.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getMyJoinRequest } from "@/lib/squad";
import type { InviteCard } from "@/lib/rooms";

export type JoinGateState = "awaiting_approval" | "declined" | "room_locked" | "removed";

export function SquadJoinWaiting({
  invite,
  state,
  onApproved,
}: {
  invite: InviteCard;
  state: JoinGateState;
  onApproved: () => void;
}) {
  const [status, setStatus] = useState<JoinGateState>(state);
  // The lobby re-renders every second (its clock); keep the poll steady.
  const approved = useRef(onApproved);
  approved.current = onApproved;
  const host = (invite.host_display_name || "the host").split(" ")[0];
  const squad = invite.greeting_headline?.trim() || `${host}'s squad`;
  const faces = invite.participants.slice(0, 6);

  useEffect(() => setStatus(state), [state]);

  // Waiting: ask every few seconds whether we've been let in.
  useEffect(() => {
    if (status !== "awaiting_approval") return;
    let stop = false;
    const check = () =>
      void getMyJoinRequest(invite.id)
        .then((r) => {
          if (stop) return;
          if (r.status === "approved" || r.status === "member" || !r.approval_needed) approved.current();
          else if (r.status === "declined") setStatus("declined");
        })
        .catch(() => {});
    const t = window.setInterval(check, 5_000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [status, invite.id]);

  const copy: Record<JoinGateState, { title: string; body: string }> = {
    awaiting_approval: {
      title: `Waiting for ${host} to let you in`,
      body: "They'll see you're here. This page opens the squad as soon as they say yes.",
    },
    declined: {
      title: "Not this time",
      body: `${host} didn't let you in this time. You can ask again tomorrow.`,
    },
    room_locked: {
      title: "The room's locked for tonight",
      body: "The squad locked it for now. Try the link again later.",
    },
    removed: {
      title: "You're no longer in this squad",
      body: "The squad removed you, so this link doesn't open it any more.",
    },
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-[1.75rem] border border-white/[0.08] bg-card/40 p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06] backdrop-blur-xl">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary/85">Squad room</p>
        <h1 className="font-serif text-3xl font-semibold text-cream">{squad}</h1>
      </div>
      {faces.length > 0 && (
        <div className="flex justify-center -space-x-2" aria-label={`${invite.participants.length} in the squad`}>
          {faces.map((p) =>
            p.photo_url ? (
              <img
                key={p.participant_id}
                src={p.photo_url}
                alt={p.display_name}
                className="h-10 w-10 rounded-full border-2 border-background object-cover"
              />
            ) : (
              <span
                key={p.participant_id}
                title={p.display_name}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-primary/25 text-sm font-bold text-cream"
              >
                {(p.display_name || "?").charAt(0).toUpperCase()}
              </span>
            ),
          )}
        </div>
      )}
      <div className="space-y-2">
        <p className="flex items-center justify-center gap-2 text-lg font-semibold text-cream">
          {status === "awaiting_approval" && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />}
          {copy[status].title}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy[status].body}</p>
      </div>
    </div>
  );
}
