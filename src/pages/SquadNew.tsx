/**
 * /squad/new: open a Squad room. Beta members only (the server checks).
 * Pick seats (2 to 6, you included) and a name; the room opens between
 * nights with the free first night in it.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { ApiError } from "@/lib/api";
import { SQUAD_SEATS, createSquadRoom, getSquadBeta } from "@/lib/squad";
import { cn } from "@/lib/utils";

/** Pure: what to tell someone when opening the room didn't work. */
export function createErrorMessage(e: unknown): { text: string; requestAccess?: boolean } {
  if (e instanceof ApiError) {
    const code = (e.body as { detail?: { error?: string } } | undefined)?.detail?.error;
    if (code === "squad_access_required") {
      return { text: "Squad is invite-only for now.", requestAccess: true };
    }
    if (code === "squad_seats_invalid") {
      const said = (e.body as { detail?: { message?: string } } | undefined)?.detail?.message;
      return { text: said ?? "That's more seats than a squad room takes right now. Pick fewer." };
    }
    if (code === "squad_unavailable" || e.status === 404) {
      return { text: "Squad rooms aren't open yet. We'll email you the moment they are." };
    }
  }
  return { text: "We couldn't open the room just now. Try again in a moment." };
}

export default function SquadNew() {
  const navigate = useNavigate();
  const beta = useQuery({ queryKey: ["squad-beta"], queryFn: getSquadBeta });
  const [seats, setSeats] = useState(4);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createSquadRoom({ seats, name }),
    onSuccess: (room) => navigate(`/squad/room/${room.id}`, { replace: true }),
  });
  const error = create.error ? createErrorMessage(create.error) : null;
  const notIn = beta.data && beta.data.status !== "granted";

  return (
    <PageShell className="px-5 pb-16 pt-8 sm:px-6">
      <div className="mx-auto max-w-lg">
        <Link
          to="/create"
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
        <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-primary/85">Squad · Beta</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight text-cream">
          Open your squad room
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          One room for your people, wherever they are. It stays open between nights, and your first
          2-hour night is on us.
        </p>

        {notIn ? (
          <div className="editorial-card mt-10 space-y-3 p-6">
            <p className="text-sm text-muted-foreground">Squad is invite-only for now.</p>
            <Link to="/squad" className="btn-primary focus-ring inline-block rounded-full px-5 py-2.5 text-sm font-semibold">
              Request access
            </Link>
          </div>
        ) : (
          <form
            className="mt-10 space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <fieldset className="space-y-2.5">
              <legend className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                <Users className="h-3 w-3" aria-hidden /> How many seats, you included
              </legend>
              <div className="grid grid-cols-4 gap-2.5">
                {SQUAD_SEATS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={seats === n}
                    onClick={() => setSeats(n)}
                    className={cn(
                      "focus-ring h-16 rounded-2xl border text-xl font-semibold transition-colors",
                      seats === n
                        ? "border-primary/60 bg-primary/15 text-cream"
                        : "border-white/[0.08] bg-card/30 text-cream/80 hover:border-primary/25",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Seats are how many can be on the call at once. More friends can join the squad; if
                someone extra turns up on a night, you can add a seat.
              </p>
            </fieldset>

            <section className="space-y-1.5">
              <label htmlFor="squad-name" className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                Name your room <span className="normal-case tracking-normal text-muted-foreground/70">(optional)</span>
              </label>
              <input
                id="squad-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Friday with the girls"
                maxLength={120}
                className="auth-input focus-ring"
              />
            </section>

            {error && (
              <div role="alert" className="space-y-2 text-sm text-rose-300">
                <p>{error.text}</p>
                {error.requestAccess && (
                  <Link to="/squad" className="text-primary hover:underline">
                    Request access
                  </Link>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={create.isPending}
              className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-4 font-semibold disabled:opacity-40"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Open the room
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
