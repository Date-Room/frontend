import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { CardPage } from "@/components/CardPage";
import {
  getRoomRecap,
  type ActivityEventResponse,
  type ActivityStateResponse,
} from "@/lib/activities/activityState";

const ACTIVITY_LABELS: Record<string, string> = {
  questions: "21 Questions",
  watch: "Watch",
  dj: "DJ",
  chat: "Chat",
  this_or_that: "This or That",
  the_36: "The 36",
  "2_truths": "Two Truths and a Lie",
  truth_or_dare: "Truth or Dare",
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

/** One-line label for a timeline event. Activities own their event
 *  vocab; we render a sensible default and let the payload show
 *  through if it has a `text` field. */
function eventLabel(e: ActivityEventResponse): string {
  const t = e.event_type.replace(/_/g, " ");
  const payloadText =
    typeof e.payload?.text === "string" ? ` — ${e.payload.text as string}` : "";
  return `${t}${payloadText}`;
}

function formatRelativeTime(then: string): string {
  const ms = Date.now() - new Date(then).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
  const events = data?.events ?? [];

  return (
    <CardPage
      maxWidth="sm:max-w-2xl lg:max-w-3xl"
      headerRight={
        <button type="button" onClick={() => navigate("/home")} className="btn-ghost focus-ring text-sm">
          Done
        </button>
      }
    >
      <div className="text-center mb-10 animate-float-up">
        <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
        <h1 className="font-serif text-3xl sm:text-4xl text-cream italic mb-2">Tonight</h1>
        <p className="text-muted-foreground text-sm">A look back at what you did together</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
        </div>
      ) : activities.length === 0 && events.length === 0 ? (
        <div className="editorial-card grain p-8 text-center text-sm text-muted-foreground italic mb-8">
          No activity was saved for this room yet.
        </div>
      ) : (
        <>
          {/* Per-activity summary cards */}
          {activities.length > 0 && (
            <section className="space-y-3 mb-10 stagger-children">
              <p className="px-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Activities</p>
              {activities.map((a) => (
                <div key={a.activity_id} className="editorial-card hover-lift flex items-center gap-4 p-5">
                  <div className="w-10 h-10 rounded-xl bg-rosegold/10 border border-rosegold/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-rosegold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-cream">{ACTIVITY_LABELS[a.activity_id]}</p>
                    <p className="text-xs text-muted-foreground">{summarize(a)}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Chronological timeline — sourced from the events log. */}
          {events.length > 0 && (
            <section className="mb-10">
              <p className="mb-4 px-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Timeline</p>
              <ol className="relative ml-3 border-l border-white/[0.08] pl-5 space-y-4">
                {events.map((e) => (
                  <li key={e.id} className="relative animate-float-up">
                    <span
                      className="absolute -left-[1.55rem] top-1.5 h-2 w-2 rounded-full bg-primary/60 ring-4 ring-background"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm text-cream">
                        <span className="text-cream/80">{e.actor_display_name || "Guest"}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-muted-foreground/90">{eventLabel(e)}</span>
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                        {ACTIVITY_LABELS[e.activity_id] ?? e.activity_id} · {formatRelativeTime(e.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => navigate("/create")}
        className="w-full editorial-card hover-lift focus-ring flex items-center gap-4 p-4"
      >
        <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-amber" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-cream">Schedule the next one</p>
          <p className="text-xs text-muted-foreground">Create a fresh room</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
      </button>
    </CardPage>
  );
}
