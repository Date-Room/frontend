/**
 * /g/:token — a squad guest link: in for one night. Shows whose squad and
 * whether a seat is waiting, then joins (signed in, like every squad room)
 * and goes straight into the call. Before the night starts it waits here
 * and checks every 20 seconds. Nothing of the squad's beyond its name.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMe } from "@/lib/users";
import { PageShell } from "@/components/PageShell";
import { getGuestLink, guestLinkProblem, guestSeatLine, joinAsGuest, markSquadGuest } from "@/lib/squadGuests";

export default function GuestLink() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const link = useQuery({
    queryKey: ["guest-link", token],
    queryFn: () => getGuestLink(token),
    retry: false,
    refetchInterval: (q) => (q.state.data && !q.state.data.night_on ? 20_000 : false),
  });
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });
  const [name, setName] = useState("");
  useEffect(() => {
    if (me.data?.display_name && !name) setName(me.data.display_name);
  }, [me.data, name]);

  async function join() {
    setJoining(true);
    try {
      const r = await joinAsGuest(token, name.trim() || "Guest");
      if (r.role === "guest") markSquadGuest(r.room_id, r.guest_until);
      const q = new URLSearchParams({ participant_id: r.participant_id, slot: r.slot, name: name.trim() || "Guest" });
      navigate(`/room/${r.room_id}?${q.toString()}`, { replace: true });
    } catch (e) {
      toast.error(guestLinkProblem(e));
      void link.refetch();
    } finally {
      setJoining(false);
    }
  }

  const p = link.data;
  return (
    <PageShell className="flex flex-col items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-[1.75rem] border border-white/[0.08] bg-card/40 p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06] backdrop-blur-xl">
        {link.isLoading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-label="Opening the link" />
        ) : !p ? (
          <p className="text-base text-cream">{guestLinkProblem(link.error)}</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.28em] text-primary/85">You're invited for tonight</p>
              <h1 className="font-serif text-3xl font-semibold text-cream">
                {p.squad_name || `${p.host_name}'s squad`}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {p.host_name} invited you to join the squad for a night. {guestSeatLine(p)}
              </p>
            </div>
            <label className="block space-y-1.5 text-left">
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="What should they call you?"
                className="auth-input focus-ring"
              />
            </label>
            {p.night_on ? (
              <button
                type="button"
                onClick={() => void join()}
                disabled={joining}
                className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold disabled:opacity-40"
              >
                {joining && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Join the night
              </button>
            ) : (
              <p className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-cream">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                The night hasn't started yet. Keep this page open; you can join as soon as it does.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              You'll be in the call and tonight's games. The link works until{" "}
              {new Date(p.expires_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
