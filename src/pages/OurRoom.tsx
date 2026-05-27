import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Play, Calendar, ChevronRight, Loader2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CardPage } from "@/components/CardPage";
import { listMyRooms } from "@/lib/rooms";

/**
 * Persistent "Our Room" entry. Finds the room in the user's server-side list
 * and lets them re-enter it; richer per-couple history (journal/library) is a
 * future feature backed by /v1/journal.
 */
export default function OurRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 10_000,
  });

  const room = rooms?.find((r) => r.id === id);

  if (isLoading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
      </PageShell>
    );
  }

  return (
    <CardPage title="Our Room" onBack={() => navigate("/home")} maxWidth="sm:max-w-xl" bodyClassName="space-y-4">
        {!room ? (
          <div className="rounded-2xl p-8 glass grain text-center text-muted-foreground">
            This room isn&apos;t in your list anymore.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => navigate(`/room/${room.id}`)}
              className="w-full rounded-3xl p-6 border-gradient grain group hover-lift text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rosegold/10 border border-rosegold/20 flex items-center justify-center">
                  <Play className="w-6 h-6 text-rosegold" />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-cream">Enter your room</h3>
                  <p className="text-sm text-muted-foreground">Code {room.code} · ongoing space</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate("/create")}
              className="w-full rounded-2xl p-4 glass grain flex items-center gap-4 hover-lift"
            >
              <div className="w-10 h-10 rounded-xl bg-champagne/10 border border-champagne/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-champagne" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-cream">Start another date</p>
                <p className="text-xs text-muted-foreground">Create a new room</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        )}
    </CardPage>
  );
}
