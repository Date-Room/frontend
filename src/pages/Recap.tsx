import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { PageShell, PageStickyHeader } from "@/components/PageShell";
import { getRoomRecap, type ActivityStateResponse } from "@/lib/activities/activityState";

const ACTIVITY_LABELS: Record<string, string> = {
  questions: "21 Questions",
  watch: "Watch",
  dj: "DJ",
  chat: "Chat",
  this_or_that: "This or That",
  capture: "Captures",
};

/** A one-line human summary of an activity's persisted state. */
function summarize(a: ActivityStateResponse): string {
  const s = a.state ?? {};
  switch (a.activity_id) {
    case "chat": {
      const n = Array.isArray(s.messages) ? s.messages.length : 0;
      return `${n} message${n === 1 ? "" : "s"}`;
    }
    case "this_or_that": {
      const i = typeof s.prompt_index === "number" ? s.prompt_index : 0;
      return `${i + 1} round${i === 0 ? "" : "s"}`;
    }
    case "watch":
      return s.video_id ? "Watched a video together" : "Opened";
    case "dj": {
      const np = s.now_playing as { title?: string } | null;
      return np?.title ? `Last track: ${np.title}` : "Took turns on the aux";
    }
    case "questions":
      return typeof s.phase === "string" ? `Phase: ${s.phase}` : "Played";
    default:
      return "Saved";
  }
}

export default function Recap() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const participantId = params.get("participant_id") ?? undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["recap", id],
    enabled: !!id,
    queryFn: () => getRoomRecap(id as string, participantId),
  });

  const activities = (data?.activities ?? []).filter((a) => ACTIVITY_LABELS[a.activity_id]);

  return (
    <PageShell>
      <PageStickyHeader>
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-serif italic text-cream">Tonight</span>
          <button type="button" onClick={() => navigate("/home")} className="btn-ghost text-sm">
            Done
          </button>
        </div>
      </PageStickyHeader>

      <main className="max-w-2xl mx-auto px-6 pt-6 pb-24 relative z-10">
        <div className="text-center mb-10 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
          <h1 className="font-serif text-4xl text-cream italic mb-2">Tonight</h1>
          <p className="text-muted-foreground text-sm">A look back at what you did together</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl p-8 glass grain text-center text-sm text-muted-foreground italic mb-8">
            No activity was saved for this room yet.
          </div>
        ) : (
          <div className="space-y-3 mb-10 animate-fade-in stagger-1">
            {activities.map((a) => (
              <div key={a.activity_id} className="rounded-2xl p-5 glass grain flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-rosegold/10 border border-rosegold/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-rosegold" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-cream">{ACTIVITY_LABELS[a.activity_id]}</p>
                  <p className="text-xs text-muted-foreground">{summarize(a)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate("/create")}
          className="w-full rounded-2xl p-4 glass grain flex items-center gap-4 hover-lift"
        >
          <div className="w-10 h-10 rounded-xl bg-champagne/10 border border-champagne/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-champagne" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-cream">Schedule the next one</p>
            <p className="text-xs text-muted-foreground">Create a fresh room</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        </button>
      </main>
    </PageShell>
  );
}
