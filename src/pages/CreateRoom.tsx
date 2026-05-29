import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CardPage } from "@/components/CardPage";
import { createRoom, type RoomPersistence } from "@/lib/rooms";
import { cn } from "@/lib/utils";

/**
 * Create Room — matches mobile's single-screen `room_creation_screen.dart`:
 * a persistence choice + an optional greeting. No recipient/scheduling/ambiance
 * steps (those don't exist on mobile). After create, go to the pre-room screen.
 */
export default function CreateRoom() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [persistence, setPersistence] = useState<RoomPersistence>("session");
  const [headline, setHeadline] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const room = await createRoom({
        persistence,
        package: persistence === "persistent" ? "subscription" : "single_pass",
        greeting_headline: headline.trim() || null,
        greeting_subtext: note.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      navigate(`/rooms/${room.id}/pre`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create room.");
    } finally {
      setCreating(false);
    }
  }

  const options: { id: RoomPersistence; title: string; desc: string; icon: string }[] = [
    {
      id: "session",
      title: "Just for tonight",
      desc: "One session, 90 minutes. Single Pass.",
      icon: "🕯️",
    },
    {
      id: "persistent",
      title: "Keep going forward",
      desc: "Ongoing Our Room. Needs a subscription.",
      icon: "🏠",
    },
  ];

  const charsLeft = 240 - note.length;
  return (
    <CardPage
      title="New room"
      onBack={() => navigate("/home")}
      maxWidth="sm:max-w-xl lg:max-w-2xl"
      bodyClassName="space-y-8 animate-float-up"
    >
      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Keep this room?</p>
        <div className="stagger-children space-y-3">
          {options.map((opt) => {
            const active = persistence === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPersistence(opt.id)}
                aria-pressed={active}
                className={cn(
                  "focus-ring group w-full text-left rounded-[1.5rem] p-5 border transition-all flex items-start gap-4",
                  active
                    ? "border-primary/55 bg-primary/[0.10] ring-1 ring-primary/25 shadow-[0_18px_60px_-22px_rgba(212,130,106,0.45)]"
                    : "editorial-card hover:border-primary/25 hover:-translate-y-0.5 duration-200",
                )}
              >
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ring-1 transition-colors",
                  active ? "bg-primary/15 ring-primary/35" : "bg-primary/[0.08] ring-primary/15",
                )}>
                  {opt.icon}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-cream font-medium">{opt.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  <span className={cn("mt-2 inline-block", active ? (opt.id === "persistent" ? "pill-rose" : "pill-amber") : "pill-muted")}>
                    {opt.id === "persistent" ? "Perm" : "Temp"}
                  </span>
                </div>
                <span
                  className={cn(
                    "ml-auto mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all",
                    active
                      ? "border-primary bg-primary shadow-[0_0_0_4px_rgba(212,130,106,0.18)]"
                      : "border-muted-foreground/40 group-hover:border-primary/40",
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Greeting (optional)</p>
        <div className="editorial-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="cr-headline" className="block text-xs text-muted-foreground">
              Headline
            </label>
            <input
              id="cr-headline"
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Tonight's the night"
              maxLength={60}
              className="auth-input focus-ring"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="cr-note" className="block text-xs text-muted-foreground">
                Note
              </label>
              <span className={cn(
                "text-[10px] tabular-nums",
                charsLeft < 20 ? "text-amber" : "text-muted-foreground/60",
              )}>
                {charsLeft}
              </span>
            </div>
            <textarea
              id="cr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A short note for them — what are we doing, what to expect, anything that sets the tone."
              maxLength={240}
              rows={3}
              className="auth-input focus-ring resize-y"
            />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="btn-primary focus-ring w-full flex items-center justify-center gap-2 py-4 rounded-[1.15rem] font-semibold disabled:opacity-50"
      >
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Creating room…
          </>
        ) : (
          "Create room"
        )}
      </button>
    </CardPage>
  );
}
