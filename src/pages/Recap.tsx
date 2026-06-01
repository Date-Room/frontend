import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { CardPage } from "@/components/CardPage";
import {
  getRoomRecap,
  type ActivityEventResponse,
  type ActivityStateResponse,
} from "@/lib/activities/activityState";
import { authClient } from "@/lib/authClient";
import { claimRoom, promoteRoom } from "@/lib/rooms";

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

/** Pull the recap-invite token out of the URL fragment (`#k=<token>`).
 * Fragment, not query, so the JWT never lands in server access logs /
 * Referer headers when the user clicks an outbound link. */
function readInviteToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.location.hash;
  if (!raw) return undefined;
  const params = new URLSearchParams(raw.startsWith("#") ? raw.slice(1) : raw);
  const t = params.get("k");
  return t && t.length > 10 ? t : undefined;
}

export default function Recap() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const participantId = params.get("participant_id") ?? undefined;
  const inviteToken = useMemo(() => readInviteToken(), []);
  const [claiming, setClaiming] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recap", id, inviteToken ?? ""],
    enabled: !!id,
    queryFn: () => getRoomRecap(id as string, participantId, inviteToken),
  });

  // Post-auth claim. If we have a token AND we're signed in AND we
  // haven't already claimed this room (idempotent server-side, so
  // re-runs are cheap), POST /claim once. After that the room shows
  // up on the Recap tab without any further hops.
  useEffect(() => {
    if (!id || !inviteToken || claiming) return;
    const session = authClient.getSession();
    if (!session) return;
    setClaiming(true);
    void claimRoom(id, inviteToken)
      .then(() => queryClient.invalidateQueries({ queryKey: ["my-rooms"] }))
      .catch(() => null)
      .finally(() => setClaiming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, inviteToken]);

  const activities = (data?.activities ?? []).filter((a) => ACTIVITY_LABELS[a.activity_id]);
  const events = data?.events ?? [];

  // Personalisation: pull distinct actor names off the events log so
  // the header reads 'Tonight with Sasha' instead of just 'Tonight'.
  // Falls back to generic when no events (the user hasn't played
  // anything) or when only one name appears (solo session).
  const actorNames = Array.from(
    new Set(
      events
        .map((e) => e.actor_display_name?.trim())
        .filter((n): n is string => !!n && n.length > 0),
    ),
  );
  const partnerName = actorNames.length >= 2 ? actorNames[actorNames.length - 1] : null;

  return (
    <CardPage
      maxWidth="sm:max-w-2xl lg:max-w-3xl"
      headerRight={
        <button
          type="button"
          onClick={() => {
            // Close the recap and go back where the user was —
            // matters when they reached this from the Recap tab,
            // Home, or a partner's deep link. Falls back to /home
            // only when there's no history to pop (e.g. cold-loaded
            // the recap URL directly).
            if (window.history.length > 1) navigate(-1);
            else navigate("/home");
          }}
          className="btn-ghost focus-ring text-sm"
        >
          Done
        </button>
      }
    >
      <div className="text-center mb-10 animate-float-up">
        <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
        <h1 className="font-serif text-3xl sm:text-4xl text-cream italic mb-2">
          {partnerName ? `Tonight with ${partnerName}` : "Tonight"}
        </h1>
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

      {/* Promote-to-persistent CTA. Signed-in only; server enforces
       *  the rest (must be a session room in grace, partner must
       *  have an account, etc.). On success we dive into the
       *  freshly-minted Our Room. */}
      {authClient.getSession() && id && (
        <button
          type="button"
          disabled={promoting}
          onClick={async () => {
            setPromoting(true);
            setPromoteError(null);
            try {
              const room = await promoteRoom(id);
              queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
              queryClient.invalidateQueries({ queryKey: ["my-connections"] });
              if (room.connection_id) {
                navigate(`/our-room/${room.connection_id}`);
              }
            } catch (e) {
              setPromoteError(e instanceof Error ? e.message : "Couldn't save this room.");
            } finally {
              setPromoting(false);
            }
          }}
          className="mb-4 w-full rounded-[1.5rem] border border-primary/30 bg-gradient-to-br from-primary/[0.12] to-transparent shadow-[0_22px_60px_-20px_rgba(212,130,106,0.35)] flex items-center gap-4 p-5 focus-ring hover-lift-strong disabled:opacity-60 disabled:cursor-wait"
        >
          <div className="w-10 h-10 rounded-xl bg-rosegold/15 border border-rosegold/25 flex items-center justify-center">
            {promoting ? <Loader2 className="w-5 h-5 text-rosegold animate-spin" /> : <Sparkles className="w-5 h-5 text-rosegold" />}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-cream">Make this our room</p>
            <p className="text-xs text-muted-foreground">Keep going as a couple — opens an Our Room.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        </button>
      )}
      {promoteError && (
        <p className="mb-4 text-xs text-rose-300">{promoteError}</p>
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
