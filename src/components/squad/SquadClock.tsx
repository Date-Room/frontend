/**
 * Tonight's time left, as a small pill. Shares the nights query with the
 * call, so it costs nothing extra.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { getSquadNights } from "@/lib/squad";
import { nearTheEnd, timeLeft } from "@/lib/squadCall";
import { cn } from "@/lib/utils";

export function SquadClock({ roomId }: { roomId: string }) {
  const nights = useQuery({
    queryKey: ["squad-nights", roomId],
    queryFn: () => getSquadNights(roomId),
    refetchInterval: 30_000,
  });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const endsAt = nights.data?.active_night?.ends_at;
  const left = timeLeft(endsAt, now);
  if (!left) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        nearTheEnd(endsAt, now) ? "bg-primary text-primary-foreground" : "bg-black/45 text-cream/85",
      )}
    >
      <Clock className="h-3 w-3" aria-hidden /> {left}
    </span>
  );
}
