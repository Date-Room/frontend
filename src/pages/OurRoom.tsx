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
    <CardPage
      title="Our Room"
      onBack={() => navigate("/home")}
      maxWidth="sm:max-w-xl"
      bodyClassName="space-y-4 animate-float-up"
    >
      {!room ? (
        <div className="editorial-card grain p-8 text-center text-muted-foreground">
          This room isn&apos;t in your list anymore.
        </div>
      ) : (
        <div className="stagger-children space-y-4">
          <button
            type="button"
            onClick={() => navigate(`/room/${room.id}`)}
            className="focus-ring group w-full text-left rounded-[1.5rem] p-6 border border-primary/30 bg-gradient-to-br from-primary/[0.10] to-transparent shadow-[0_22px_60px_-20px_rgba(212,130,106,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover-lift-strong"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rosegold/15 border border-rosegold/25 flex items-center justify-center ring-1 ring-rosegold/20">
                <Play className="w-6 h-6 text-rosegold" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl text-cream">Enter your room</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="pill-rose">Perm</span>
                  <span className="truncate">Code {room.code} · ongoing space</span>
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/create")}
            className="editorial-card hover-lift focus-ring w-full flex items-center gap-4 p-4"
          >
            <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-cream">Start another date</p>
              <p className="text-xs text-muted-foreground">Create a new room</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </CardPage>
  );
}
