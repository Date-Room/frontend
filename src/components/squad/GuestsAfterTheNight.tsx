/**
 * On the squad page, for whoever runs the squad: guests whose night is
 * over (the server keeps them a day) with "Make Kev a member?". "Not now"
 * hides the ask on this device; the guest leaves the squad on their own a
 * day after their night.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { listGuests, makeGuestMember } from "@/lib/squadGuests";

const DISMISSED = (roomId: string) => `dr:guest-asked:${roomId}`;

function readDismissed(roomId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED(roomId)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function GuestsAfterTheNight({ roomId, canRun }: { roomId: string; canRun: boolean }) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed(roomId));
  const guests = useQuery({
    queryKey: ["squad-guests", roomId],
    queryFn: () => listGuests(roomId),
    enabled: canRun,
    retry: false,
    refetchInterval: 60_000,
  });
  const keep = useMutation({
    mutationFn: (pid: string) => makeGuestMember(roomId, pid),
    onSuccess: () => {
      toast.success("They're in the squad now.");
      void qc.invalidateQueries({ queryKey: ["squad-guests", roomId] });
      void qc.invalidateQueries({ queryKey: ["squad-members", roomId] });
    },
    onError: () => toast.error("That didn't go through. Try again."),
  });

  const asks = (guests.data?.guests ?? []).filter((g) => g.night_over && !dismissed.includes(g.participant_id));
  if (!canRun || asks.length === 0) return null;

  const notNow = (pid: string) => {
    const next = [...dismissed, pid];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED(roomId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="editorial-card space-y-3 p-6">
      {asks.map((g) => {
        const first = (g.display_name || "Your guest").split(" ")[0];
        return (
          <div key={g.participant_id} className="flex flex-wrap items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-cream">
              {first} came as your guest. Make {first} a member?
            </p>
            <button
              type="button"
              onClick={() => notNow(g.participant_id)}
              className="focus-ring rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-cream"
            >
              Not now
            </button>
            <button
              type="button"
              disabled={keep.isPending}
              onClick={() => keep.mutate(g.participant_id)}
              className="btn-primary focus-ring flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              {keep.isPending && keep.variables === g.participant_id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Make {first} a member
            </button>
          </div>
        );
      })}
    </section>
  );
}
