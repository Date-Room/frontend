/**
 * Changing the squad's usual night size, for the owner and co-hosts (or
 * everyone, when the room lets everyone manage). Friend groups grow and
 * shrink, so the size isn't fixed: the balance is seats, and this only
 * changes how it splits into nights ("15 seats: 5 nights for 3, or 3
 * nights + 3 spare for 4"). A seat costs the same at every size. Tonight,
 * if a night is on, keeps its seats.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { nightsAndSpare, setSquadNightSize, squadErrorText, type SquadNights } from "@/lib/squad";
import { cn } from "@/lib/utils";

export function SquadNightSize({ roomId, nights }: { roomId: string; nights: SquadNights }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: (seats: number) => setSquadNightSize(roomId, seats),
    onSuccess: (n) => {
      qc.setQueryData(["squad-nights", roomId], n);
      void qc.invalidateQueries({ queryKey: ["squad-prices", roomId] });
      toast.success(`Nights are for ${n.seats} now.`);
      setOpen(false);
    },
    onError: (e) => toast.error(squadErrorText(e, "That didn't save. Try again.")),
  });
  const sizes = nights.by_size ?? [];
  if (sizes.length < 2) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="focus-ring rounded text-primary hover:underline">
          Change
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>How many for a night?</DialogTitle>
          <DialogDescription>
            Your {nights.seat_nights} seat{nights.seat_nights === 1 ? "" : "s"} stay the same; this changes how
            they split into nights. You can still start a smaller night when not everyone's free.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Night size" className="space-y-2">
          {sizes.map((b) => {
            const current = b.seats === nights.seats;
            return (
              <button
                key={b.seats}
                type="button"
                role="radio"
                aria-checked={current}
                disabled={save.isPending}
                onClick={() => (current ? setOpen(false) : save.mutate(b.seats))}
                className={cn(
                  "focus-ring flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                  current ? "border-primary/50 bg-primary/10" : "border-white/[0.1] hover:border-primary/30",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-cream">{b.seats} people</span>
                  <span className={cn("block text-xs", b.nights === 0 ? "text-amber-300" : "text-muted-foreground")}>
                    {b.nights === 0
                      ? `Not a full night yet (${b.spare} spare). Top up, or start smaller nights.`
                      : nightsAndSpare(nights.seat_nights, b.seats)}
                  </span>
                </span>
                {current && <Check className="h-4 w-4 text-primary" aria-hidden />}
                {save.isPending && save.variables === b.seats && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        {nights.active_night && (
          <p className="text-xs text-muted-foreground">Tonight keeps its {nights.active_night.seats} seats.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
