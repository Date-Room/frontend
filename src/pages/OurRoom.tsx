import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookmarkPlus,
  Calendar,
  ChevronRight,
  HelpCircle,
  Headphones,
  Loader2,
  Music,
  Play,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { getConnection, lastMetLabel, type Connection } from "@/lib/connections";
import { createRoom } from "@/lib/rooms";
import { listJournal, type JournalEntry } from "@/lib/journal";

type Tab = "tonight" | "journal" | "library" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "tonight", label: "Tonight" },
  { id: "journal", label: "Journal" },
  { id: "library", label: "Library" },
  { id: "about", label: "About us" },
];

/**
 * Our Room — the persistent surface for a Connection. Four tabs:
 *   Tonight  — primary CTA to open a fresh session room tagged with
 *              this connection_id (so both sides land in the same
 *              Our Room when they join).
 *   Journal  — chronological list of moments saved against the
 *              connection (driven by /v1/journal). Read-only.
 *   Library  — placeholder for the grouped-by-activity mirror of
 *              the journal; renders honest "Coming soon" surfaces.
 *   About us — placeholder for curated relationship facts; same.
 */
export default function OurRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("tonight");

  const { data: connection, isLoading, error } = useQuery({
    queryKey: ["connection", id],
    queryFn: () => getConnection(id as string),
    enabled: !!id,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
      </PageShell>
    );
  }

  if (error || !connection) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl px-6 pt-24 pb-16">
          <button onClick={() => navigate("/home")} className="btn-ghost focus-ring mb-6 text-sm inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="editorial-card p-8 text-center text-muted-foreground">
            This Our Room isn&apos;t available.
          </div>
        </div>
      </PageShell>
    );
  }

  const name = connection.partner.display_name?.trim() ?? "";

  return (
    <PageShell>
      <main className="mx-auto max-w-3xl px-6 pt-16 pb-28">
        <button
          onClick={() => navigate("/home")}
          className="btn-ghost focus-ring mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Header: avatar + 'You & <name>' + last-met. */}
        <header className="flex items-center gap-4 pb-8 border-b border-white/[0.06]">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-rosegold/30 bg-rosegold/[0.08] flex items-center justify-center">
            <UserAvatarImg
              src={connection.partner.photo_url}
              alt=""
              className="h-full w-full object-cover"
              fallback={
                <span className="font-serif text-xl text-rosegold">
                  {name ? name[0].toUpperCase() : "·"}
                </span>
              }
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-2xl italic text-cream">
              {name ? `You & ${name}` : "Our Room"}
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {lastMetLabel(connection)}
            </p>
          </div>
        </header>

        {/* Tab bar — pills, mirrors mobile's tab order. */}
        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Our Room sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={
                tab === t.id
                  ? "focus-ring rounded-full bg-primary/15 px-4 py-2 text-sm font-medium text-primary ring-1 ring-primary/25"
                  : "focus-ring rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-cream transition"
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="mt-6">
          {tab === "tonight" && <TonightPanel connection={connection} />}
          {tab === "journal" && <JournalPanel connectionId={connection.id} />}
          {tab === "library" && <PlaceholderPanel
            title="Library"
            subtitle="Saved questions, watched videos, playlists — grouped here once you start journaling moments together."
            items={[
              { icon: BookmarkPlus, label: "Saved questions" },
              { icon: Play, label: "Watched together" },
              { icon: Music, label: "Playlists" },
            ]}
          />}
          {tab === "about" && <PlaceholderPanel
            title="About us"
            subtitle="A space for the things you two want to remember about each other. Coming soon."
            items={[]}
          />}
        </section>
      </main>
    </PageShell>
  );
}

function TonightPanel({ connection }: { connection: Connection }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openRoomNow() {
    setBusy(true);
    setError(null);
    try {
      // Session room tagged with the connection — the partner will see
      // it under the same Our Room when they join.
      const room = await createRoom({
        persistence: "session",
        package: "single_pass",
        connection_id: connection.id,
      });
      queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      navigate(`/rooms/${room.id}/pre`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open a room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 animate-float-up">
      <button
        type="button"
        onClick={openRoomNow}
        disabled={busy}
        className="focus-ring group w-full text-left rounded-[1.5rem] p-6 border border-primary/30 bg-gradient-to-br from-primary/[0.10] to-transparent shadow-[0_22px_60px_-20px_rgba(232,166,83,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover-lift-strong disabled:opacity-60 disabled:cursor-wait"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rosegold/15 border border-rosegold/25 flex items-center justify-center ring-1 ring-rosegold/20">
            {busy ? <Loader2 className="w-6 h-6 text-rosegold animate-spin" /> : <Play className="w-6 h-6 text-rosegold" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl text-cream">Open a room now</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Spin up a fresh session — your partner will see it in their My Rooms.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        </div>
      </button>

      {error && (
        <p className="text-xs text-rose-300">{error}</p>
      )}

      <button
        type="button"
        onClick={() => navigate("/create")}
        className="editorial-card hover-lift focus-ring w-full flex items-center gap-4 p-4"
      >
        <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-amber" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-cream">Schedule something</p>
          <p className="text-xs text-muted-foreground">Plan a future date for the two of you</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function JournalPanel({ connectionId }: { connectionId: string }) {
  const { data: page, isLoading, error } = useQuery({
    queryKey: ["journal", connectionId],
    queryFn: () => listJournal(connectionId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-rosegold animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="editorial-card p-6 text-center text-sm text-muted-foreground">
        Couldn&apos;t load the journal. Refresh to try again.
      </div>
    );
  }
  const items = page?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="editorial-card p-8 text-center animate-float-up">
        <Sparkles className="mx-auto h-8 w-8 text-rosegold/70 mb-3" />
        <h3 className="font-serif text-lg text-cream italic">Your journal will fill up here</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions you answered, tracks you played — they land here once you spend time together.
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-3 stagger-children">
      {items.map((e) => (
        <JournalRow key={e.id} entry={e} />
      ))}
    </ol>
  );
}

function JournalRow({ entry }: { entry: JournalEntry }) {
  const meta: Record<JournalEntry["type"], { icon: typeof Sparkles; label: string }> = {
    question_answered: { icon: HelpCircle, label: "Question answered" },
    this_or_that_round: { icon: Sparkles, label: "This or That round" },
    video_watched: { icon: Play, label: "Video watched" },
    dj_track: { icon: Headphones, label: "Track played" },
    chat_highlight: { icon: BookmarkPlus, label: "Chat highlight" },
    captured_moment: { icon: Sparkles, label: "Moment captured" },
    gesture: { icon: Sparkles, label: "Gesture" },
    milestone: { icon: Sparkles, label: "Milestone" },
    memory: { icon: BookmarkPlus, label: "Memory" },
  };
  const { icon: Icon, label } = meta[entry.type];
  const preview = previewFromPayload(entry.payload);
  const when = new Date(entry.created_at);
  return (
    <li className="editorial-card hover-lift p-4 flex items-start gap-4">
      <div className="h-10 w-10 shrink-0 rounded-xl border border-rosegold/25 bg-rosegold/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-rosegold" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-cream">{label}</p>
        {preview && <p className="mt-0.5 text-xs text-muted-foreground truncate">{preview}</p>}
        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
          {when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </li>
  );
}

function previewFromPayload(p: Record<string, unknown>): string | null {
  for (const k of ["text", "title", "question", "prompt"]) {
    const v = p[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

function PlaceholderPanel({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: { icon: typeof Sparkles; label: string }[];
}) {
  return (
    <div className="space-y-4 animate-float-up">
      <div className="editorial-card p-6">
        <h3 className="font-serif text-lg italic text-cream">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {items.map((it) => (
        <div key={it.label} className="editorial-card flex items-center gap-4 p-4 opacity-70">
          <div className="h-10 w-10 rounded-xl border border-white/[0.08] flex items-center justify-center">
            <it.icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-cream">{it.label}</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
      ))}
    </div>
  );
}
