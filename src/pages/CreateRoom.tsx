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

  return (
    <CardPage title="New room" onBack={() => navigate("/home")} bodyClassName="space-y-8">
      <section className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Keep this room?</p>
          <div className="space-y-3">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPersistence(opt.id)}
                className={cn(
                  "w-full text-left rounded-[1.5rem] p-5 border transition-all flex items-start gap-4",
                  persistence === opt.id
                    ? "border-primary/55 bg-primary/10 ring-1 ring-primary/25"
                    : "border-white/[0.08] bg-card/40 hover:border-primary/25",
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/25 text-2xl">
                  {opt.icon}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-cream font-medium">{opt.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
                <span
                  className={cn(
                    "ml-auto mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-colors",
                    persistence === opt.id ? "border-primary bg-primary" : "border-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Greeting (optional)</p>
          <div className="space-y-3 rounded-[1.5rem] border border-white/[0.08] bg-card/40 p-5">
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
                className="auth-input"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cr-note" className="block text-xs text-muted-foreground">
                Note
              </label>
              <textarea
                id="cr-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A short note for them — what are we doing, what to expect, anything that sets the tone."
                maxLength={240}
                rows={3}
                className="auth-input resize-y"
              />
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 rounded-[1.15rem] font-semibold disabled:opacity-50"
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
