import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getRoomByCode, joinRoom, type InviteCard } from "@/lib/rooms";
import { getMe, updateMe } from "@/lib/users";
import { authClient } from "@/lib/authClient";
import { resolveAmbiancePreset, ambianceMeta } from "@/lib/ambiance";
import type { AmbiancePresetId } from "@/lib/ambiance";
import { PageShell } from "@/components/PageShell";
import { AmbientSceneStack } from "@/components/AmbientSceneStack";
import { toast } from "sonner";

const OPEN_BUFFER_MS = 5 * 60 * 1000;
const ENDED_STATES = new Set(["ended", "grace", "purged", "sub_lapsed"]);

function formatRemaining(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

export default function Lobby() {
  // Route is /i/<code> or /i/<code>/<pin> — `id` is the room CODE.
  const { id: code, pin: pinParam } = useParams<{ id: string; pin?: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  // PIN now travels in the deep-link path (`/i/<code>/<pin>`) — share UIs
  // always include it, so the lobby no longer asks for it.
  const pin = (pinParam ?? "").trim();
  // Signed-in users join with their profile display name (mobile parity) and
  // are never asked. Only anonymous guests type a name.
  const [signedIn, setSignedIn] = useState(false);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void (async () => {
      try {
        const card = await getRoomByCode(code);
        if (cancelled) return;
        setInvite(card);
      } catch {
        if (!cancelled) setError("This invite isn't valid. Ask the host for a new one.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // If signed in, use the backend profile display name (and skip the prompt).
  // Otherwise prefill from the last name this device used, so we don't ask cold
  // every time.
  useEffect(() => {
    try {
      const remembered = localStorage.getItem("dateroom_guest_name");
      if (remembered) setName((prev) => prev || remembered);
    } catch {
      /* ignore */
    }
    void (async () => {
      if (!authClient.getSession()) return;
      setSignedIn(true);
      try {
        const me = await getMe();
        if (me.display_name) setProfileName(me.display_name);
      } catch {
        /* fall back to typed name */
      }
    })();
  }, []);

  const ambientPreset: AmbiancePresetId = useMemo(
    () => resolveAmbiancePreset(invite?.background_id ?? undefined),
    [invite],
  );

  const expired = useMemo(() => {
    if (!invite?.expires_at) return false;
    return now >= new Date(invite.expires_at).getTime();
  }, [invite, now]);

  const scheduledMs = invite?.scheduled_for ? new Date(invite.scheduled_for).getTime() : 0;
  const openMs = scheduledMs - OPEN_BUFFER_MS;
  const openByTime = !invite?.scheduled_for || now >= openMs;
  const ended = invite ? ENDED_STATES.has(invite.state) : false;
  const open = invite ? !ended && openByTime : false;

  // Profile name when signed in; otherwise the typed name. Anonymous
  // guests can skip the name field — we default to "Guest" so the join
  // form needs only the PIN.
  const typedName = name.trim();
  const effectiveName = (signedIn && profileName ? profileName : typedName) || "Guest";
  const needsName = !(signedIn && profileName);

  // Bounce signed-out guests trying to enter a persistent room into
  // the auth flow, carrying the deep link so they return here after
  // signing up / in. The Lobby then auto-joins them (see effect below).
  function bounceToAuthForPersistent(): void {
    const deepLink = code && pin ? `/i/${encodeURIComponent(code)}/${encodeURIComponent(pin)}` : "/";
    toast.message("This room is account-only — quick sign-in then you're in.");
    navigate(`/auth?next=${encodeURIComponent(deepLink)}`, { replace: true });
  }

  async function attemptJoin(displayName: string): Promise<void> {
    if (!invite) return;
    if (!/^\d{4,}$/.test(pin)) {
      // No PIN in the URL — the user probably opened just `/i/<code>`.
      // Bounce to the manual-entry page with the code prefilled.
      toast.error("This invite link is missing the PIN — ask the host to resend.");
      navigate(`/join?code=${encodeURIComponent(code ?? "")}`);
      return;
    }
    setJoining(true);
    try {
      const res = await joinRoom(invite.id, { display_name: displayName, pin });
      try {
        localStorage.setItem("dateroom_guest_name", displayName);
      } catch {
        /* ignore */
      }
      if (signedIn && !profileName) {
        void updateMe({ display_name: displayName }).catch(() => {});
      }
      const params = new URLSearchParams({
        participant_id: res.participant_id,
        slot: res.slot,
        name: displayName,
      });
      // Persistent rooms have no hard cutoff — never forward an
      // expires_at on the URL even if backend somehow leaked a stamp.
      // The LiveRoom screen keys "expired" off this param; leaking it
      // would make a live perm room read as ended.
      if (res.expires_at && invite.persistence !== "persistent") {
        params.set("expires_at", res.expires_at);
      }
      navigate(`/room/${res.room_id}?${params.toString()}`, { replace: true });
    } catch (err) {
      // Backend 403 "Persistent rooms require an account" → divert
      // anonymous guests to the auth flow with the deep link in tow.
      const msg = err instanceof Error ? err.message : "Could not join.";
      if (!signedIn && /account|persistent/i.test(msg)) {
        bounceToAuthForPersistent();
        return;
      }
      toast.error(msg + " Check the PIN and try again.");
    } finally {
      setJoining(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    await attemptJoin(effectiveName);
  }

  // Returners from a successful sign-in / sign-up via the
  // persistent-room nudge land here authenticated, with the PIN
  // already in the URL. Auto-join — no extra click needed.
  useEffect(() => {
    if (!invite || joining) return;
    if (!signedIn || !profileName) return;
    if (!/^\d{4,}$/.test(pin)) return;
    if (!open) return;
    void attemptJoin(profileName);
    // We only ever want to fire once per (invite, identity) pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, signedIn, profileName, pin, open]);

  // ── Date finished — recap only ──
  if (ended && invite) {
    return (
      <PageShell className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md relative z-10 animate-fade-in rounded-[1.75rem] border border-white/[0.08] bg-card/40 backdrop-blur-xl p-8 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06] space-y-6">
          <h1 className="font-serif italic text-cream text-3xl mb-1">This date has ended</h1>
          <p className="text-muted-foreground leading-relaxed">
            Relive how it went — the recap is still here for a little while.
          </p>
          <button
            type="button"
            className="btn-primary w-full py-3 rounded-full"
            onClick={() => {
              // Carry the recap-invite from the share URL fragment
              // through to the recap. Both signed-in and anonymous
              // visitors land — token unlocks read without needing
              // to be a participant.
              const tok = invite.recap_invite_token;
              const target = `/room/${encodeURIComponent(invite.id)}/recap${tok ? `#k=${tok}` : ""}`;
              navigate(target);
            }}
          >
            View recap
          </button>
          <button
            type="button"
            className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-cream transition"
            onClick={() => navigate("/")}
          >
            Back to site
          </button>
        </div>
      </PageShell>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <PageShell className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md relative z-10 animate-fade-in rounded-[1.75rem] border border-white/[0.08] bg-card/40 backdrop-blur-xl p-8 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
          <h1 className="font-serif italic text-cream text-3xl mb-3">Hmm</h1>
          <p className="text-muted-foreground leading-relaxed">{error}</p>
        </div>
      </PageShell>
    );
  }

  // ── Loading ──
  if (!invite) {
    return (
      <PageShell className="flex items-center justify-center">
        <div className="text-center relative z-10 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-rosegold mx-auto mb-4 animate-pulse-glow" />
          <p className="font-serif italic text-cream text-xl">Opening the door…</p>
        </div>
      </PageShell>
    );
  }

  // ── Expired ──
  if (expired) {
    return (
      <PageShell className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md relative z-10 animate-fade-in rounded-[1.75rem] border border-white/[0.08] bg-card/40 backdrop-blur-xl p-8 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
          <h1 className="font-serif italic text-cream text-3xl mb-3">The evening&apos;s over</h1>
          <p className="text-muted-foreground leading-relaxed">This invite has expired. Ask the host for a new one.</p>
        </div>
      </PageShell>
    );
  }

  const remaining = openMs - now;
  const scheduledFormatted = invite.scheduled_for
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(scheduledMs))
    : null;

  return (
    <PageShell orbs={false} vignette={false} className="overflow-hidden">
      <AmbientSceneStack ambiance={ambientPreset} positionClassName="fixed inset-0 z-[1]" />
      <div className="live-room-soft-vignette" aria-hidden />
      <div
        className="live-room-ambient !z-[6]"
        data-live-ambiance={ambientPreset}
        data-photo-backdrop="true"
        aria-hidden
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center px-6 py-10 sm:py-14">
        <div className="flex justify-center pb-6">
          <span
            className="w-2 h-2 rounded-full bg-rosegold animate-candle-flicker"
            style={{ boxShadow: "0 0 20px hsl(16 52% 62% / 0.6), 0 0 60px hsl(16 52% 62% / 0.2)" }}
            aria-hidden
          />
        </div>

        <div className="flex-1 w-full flex items-center justify-center">
          <div className="w-full max-w-md sm:max-w-xl">
            <div
              className="editorial-card animate-scale-in flex flex-col items-center gap-6 p-6 text-center sm:p-10"
              style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6), inset 0 0 60px rgba(212,130,106,0.04)" }}
            >
              {invite.greeting_headline && (
                <h1
                  className="font-serif italic text-cream text-2xl sm:text-4xl leading-snug"
                  style={{ textShadow: "0 2px 24px rgba(0,0,0,0.6)" }}
                >
                  {invite.greeting_headline}
                </h1>
              )}
              {invite.greeting_subtext && (
                <p
                  className="text-cream/80 text-base sm:text-lg leading-relaxed max-w-md"
                  style={{ textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}
                >
                  {invite.greeting_subtext}
                </p>
              )}

              <div
                className="mx-auto h-px w-full max-w-[14rem] bg-gradient-to-r from-transparent via-rosegold/40 to-transparent"
                aria-hidden
              />

              {open ? (
                <div className="w-full max-w-sm space-y-5">
                  <form onSubmit={handleJoin} className="space-y-4">
                  {/* Name only (PIN already in the deep link). Anonymous
                      guests who skip the name join as "Guest". */}
                  {needsName ? (
                    <div className="space-y-1.5 text-left">
                      <label htmlFor="lobby-name" className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-cream/70">
                        <span>Your name</span>
                        <span className="normal-case tracking-normal text-cream/40">optional</span>
                      </label>
                      <input
                        id="lobby-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Guest"
                        autoComplete="given-name"
                        className="auth-input"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <p className="text-left text-sm text-cream/70">
                      Joining as <span className="text-cream">{effectiveName}</span>.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={joining}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold disabled:opacity-50"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Joining…
                      </>
                    ) : (
                      "Enter room"
                    )}
                  </button>
                  </form>
                  <p className="text-center text-[10px] text-cream/40">
                    By entering you confirm you are 18 or older.
                  </p>
                </div>
              ) : (
                <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-white/[0.05] sm:py-7">
                  <p className="mb-4 font-serif italic text-[11px] text-cream/82 sm:text-xs">Room opens in</p>
                  <p
                    className="font-serif text-5xl tabular-nums leading-none text-cream sm:text-7xl"
                    style={{ textShadow: "0 4px 30px rgba(0,0,0,0.72), 0 0 48px rgba(212,130,106,0.1)" }}
                  >
                    {formatRemaining(remaining)}
                  </p>
                  {scheduledFormatted && (
                    <p className="mt-4 text-sm italic text-cream/60">the date starts {scheduledFormatted}</p>
                  )}
                </div>
              )}

              <p className="max-w-xs text-[10px] uppercase tracking-[0.22em] text-cream/40">
                {ambianceMeta(ambientPreset).label} lighting · matches your live date room
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
