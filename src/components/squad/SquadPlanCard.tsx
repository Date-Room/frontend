/**
 * Planning the next night, between nights. Anyone suggests 1 to 3 times;
 * everyone ticks what works; the plan decides when everyone has answered
 * (or after 24 hours). Every time shows in the viewer's own clock with the
 * squad's other clocks underneath. The decided time starts the night on
 * its own once two people are in (SquadRoom does that).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  answerSquadPlan,
  browserTimeZone,
  getSquadPlan,
  proposeSquadPlan,
  squadErrorText,
  type SquadPlanView,
} from "@/lib/squad";
import { dayTime, otherClocks, suggestedTime, toLocalInput } from "@/lib/squadRoom";
import { cn } from "@/lib/utils";

export function SquadPlanCard({ roomId, selfParticipantId }: { roomId: string; selfParticipantId: string | null }) {
  const qc = useQueryClient();
  const key = ["squad-plan", roomId];
  const plan = useQuery({ queryKey: key, queryFn: () => getSquadPlan(roomId), refetchInterval: 30_000 });
  const [proposing, setProposing] = useState(false);
  const myTz = browserTimeZone();

  const setView = (v: SquadPlanView) => qc.setQueryData(key, v);
  const answer = useMutation({
    mutationFn: (ids: string[]) => answerSquadPlan(roomId, ids),
    onSuccess: setView,
    onError: (e) => toast.error(squadErrorText(e, "That didn't save. Try again.")),
  });

  const v = plan.data;
  if (!v) {
    return (
      <section className="editorial-card flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading the plan" />
      </section>
    );
  }
  const poll = v.plan?.status === "open" ? v.plan : null;
  const clocks = (iso: string) => otherClocks(iso, v.members, myTz, selfParticipantId);

  return (
    <section className="editorial-card space-y-4 p-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="flex-1 whitespace-nowrap font-serif text-2xl text-cream">Next night</h2>
        {!proposing && (
          <button
            type="button"
            onClick={() => setProposing(true)}
            className="focus-ring rounded-full border border-white/[0.12] px-3 py-1.5 text-sm text-cream hover:bg-white/[0.06]"
          >
            {v.next_night_at || poll ? "New times" : "Plan it"}
          </button>
        )}
      </div>

      {proposing ? (
        <ProposeForm
          roomId={roomId}
          onDone={(view) => {
            if (view) setView(view);
            setProposing(false);
          }}
        />
      ) : poll ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Tick every time that works for you.</p>
          <ul className="space-y-2">
            {poll.options.map((o) => {
              const on = poll.my_option_ids.includes(o.id);
              const names = o.ticked_by
                .map((pid) => v.members.find((m) => m.participant_id === pid)?.display_name)
                .filter(Boolean);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={answer.isPending}
                    onClick={() =>
                      answer.mutate(on ? poll.my_option_ids.filter((x) => x !== o.id) : [...poll.my_option_ids, o.id])
                    }
                    className={cn(
                      "focus-ring flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                      on ? "border-primary/60 bg-primary/15" : "border-white/[0.08] bg-card/30 hover:border-primary/25",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        on ? "border-primary bg-fill text-primary-foreground" : "border-white/25",
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-cream">{dayTime(o.starts_at)}</span>
                      {clocks(o.starts_at).map((line) => (
                        <span key={line} className="block text-xs text-muted-foreground">
                          {line}
                        </span>
                      ))}
                      {names.length > 0 && (
                        <span className="mt-1 block text-xs text-primary/90">Works for {names.join(", ")}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {poll.answered.length} of {v.members.length} answered · decides when everyone has, or{" "}
              {dayTime(poll.locks_at)}
            </span>
            {poll.my_option_ids.length > 0 || !poll.answered.includes(selfParticipantId ?? "") ? (
              <button
                type="button"
                onClick={() => answer.mutate([])}
                className="focus-ring rounded text-cream/80 underline-offset-2 hover:underline"
              >
                None of these work
              </button>
            ) : null}
          </div>
        </div>
      ) : v.next_night_at ? (
        <div className="space-y-1">
          <p className="text-lg font-semibold text-cream">{dayTime(v.next_night_at)}</p>
          {clocks(v.next_night_at).map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            It starts on its own at that time once two of you are in the room.
          </p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {v.plan?.status === "no_time"
            ? "No time worked for everyone last round. Suggest a few more."
            : "Nothing planned yet. Suggest up to three times and everyone ticks what works."}
        </p>
      )}
    </section>
  );
}

function ProposeForm({ roomId, onDone }: { roomId: string; onDone: (v: SquadPlanView | null) => void }) {
  const [times, setTimes] = useState<string[]>(() => [toLocalInput(suggestedTime(new Date()))]);
  const propose = useMutation({
    mutationFn: () =>
      proposeSquadPlan(
        roomId,
        times.filter(Boolean).map((t) => new Date(t).toISOString()),
      ),
    onSuccess: (v) => {
      toast.success("Sent to the squad.");
      onDone(v);
    },
    onError: (e) => toast.error(squadErrorText(e, "Those times didn't save. Try again.")),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        propose.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">Up to three times, in your own clock.</p>
      {times.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="datetime-local"
            aria-label={`Time ${i + 1}`}
            value={t}
            min={toLocalInput(new Date())}
            onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
            className="auth-input focus-ring flex-1"
          />
          {times.length > 1 && (
            <button
              type="button"
              aria-label="Remove this time"
              onClick={() => setTimes(times.filter((_, j) => j !== i))}
              className="focus-ring rounded-full p-2 text-muted-foreground hover:text-cream"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      ))}
      {times.length < 3 && (
        <button
          type="button"
          onClick={() => setTimes([...times, ""])}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-primary hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden /> Another time
        </button>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onDone(null)}
          className="focus-ring flex-1 rounded-full border border-white/[0.12] py-3 text-sm text-cream hover:bg-white/[0.06]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={propose.isPending || !times.some(Boolean)}
          className="btn-primary focus-ring flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-40"
        >
          {propose.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Send to the squad
        </button>
      </div>
    </form>
  );
}
