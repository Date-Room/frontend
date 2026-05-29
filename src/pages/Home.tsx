import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, LogOut, MessageSquare, ChevronRight, History, Heart, User, Settings as SettingsIcon, Globe, KeyRound } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { authClient } from "@/lib/authClient";
import { getMe } from "@/lib/users";
import { listMyRooms, type Room, type RoomStateName } from "@/lib/rooms";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";

const ALIVE_STATES = new Set<RoomStateName>(["created", "waiting", "live", "active"]);
const ENDED_STATES = new Set<RoomStateName>(["ended", "grace", "sub_lapsed"]);

type Tab = "history" | "rooms" | "profile";

const TABS: { id: Tab; label: string; icon: typeof Heart }[] = [
  { id: "rooms", label: "Rooms", icon: Heart },
  { id: "history", label: "History", icon: History },
  { id: "profile", label: "Profile", icon: User },
];

export default function Home() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("rooms");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 30_000, retry: 1, refetchOnWindowFocus: false });
  const { data: rooms = [] } = useQuery({ queryKey: ["my-rooms"], queryFn: listMyRooms, staleTime: 10_000 });

  const aliveRooms = rooms.filter((r) => ALIVE_STATES.has(r.state));
  const endedRooms = rooms.filter((r) => ENDED_STATES.has(r.state));

  function enterRoom(r: Room) {
    const slot = me && r.host_id === me.id ? "a" : "b";
    const exp = r.expires_at ? `&expires_at=${encodeURIComponent(r.expires_at)}` : "";
    navigate(`/room/${r.id}?slot=${slot}${exp}`);
  }

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/auth");
  }

  const initial = (me?.display_name || me?.email || "?")[0]?.toUpperCase();

  return (
    <PageShell>
      {/* Header — logo always; on desktop it also carries the tab nav + account. */}
      <header className="fixed top-0 left-0 right-0 z-40 glass-subtle backdrop-blur-xl border-b border-white/[0.04]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10">
            <img src="/dateroom-logo.png" alt={`${BRAND_NAME} logo`} className="h-full w-full object-cover" />
          </div>
          <span className="font-serif text-xl font-semibold italic text-cream">{BRAND_NAME}</span>

          {/* Desktop tab nav */}
          <nav className="ml-8 hidden items-center gap-1 lg:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-cream",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Desktop account cluster */}
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => setTab("profile")}
              className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3.5 transition-colors hover:border-primary/25"
            >
              {me?.photo_url ? (
                <img src={me.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-rosegold/40 to-romantic/30 font-serif text-sm text-cream">
                  {initial}
                </span>
              )}
              <span className="max-w-[10rem] truncate text-sm text-cream">{me?.display_name || me?.email?.split("@")[0]}</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-cream"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto min-h-screen max-w-6xl px-6 pt-24 pb-28 lg:pb-16">
        {tab === "rooms" && (
          <div className="animate-fade-in space-y-8">
            {/* Action bar — full-width stacked on mobile, contained row on desktop. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={() => navigate("/create")}
                className="btn-primary focus-ring flex items-center justify-center gap-3 rounded-[1.35rem] py-5 shadow-[0_12px_48px_rgba(212,130,106,0.28)] sm:flex-1 sm:py-4 lg:max-w-xs"
              >
                <Plus className="h-5 w-5" strokeWidth={2.25} />
                <span className="font-medium tracking-wide">Create a new room</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/join")}
                className="focus-ring flex items-center justify-center gap-2 rounded-[1.35rem] border border-white/[0.08] py-4 text-xs uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/25 hover:text-cream sm:px-8 hover:-translate-y-0.5 duration-200"
              >
                <KeyRound className="h-4 w-4" /> Join with code
              </button>
            </div>

            {aliveRooms.length > 0 ? (
              <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {aliveRooms.map((r) => {
                  const isHost = me ? r.host_id === me.id : false;
                  const isLive = r.state === "live" || r.state === "active";
                  const isWaiting = r.state === "waiting" || r.state === "created";
                  const isPersistent = r.persistence === "persistent";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => (isHost ? navigate(`/rooms/${r.id}/pre`) : enterRoom(r))}
                      className="group editorial-card hover-lift focus-ring flex items-stretch text-left"
                    >
                      <div className="flex flex-1 min-w-0 flex-col gap-4 p-5">
                        {/* Top row — icon + title + chevron */}
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/[0.04] text-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            {isPersistent ? "🏠" : "🕯️"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-serif text-[1.05rem] italic leading-snug text-cream">
                              {isPersistent ? "Our Room" : "Tonight"}
                              <span className="text-sm not-italic text-muted-foreground/65"> · {isHost ? "host" : "guest"}</span>
                            </p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                              Code {r.code}{isHost ? ` · PIN ${r.pin}` : ""}
                            </p>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>

                        {/* Bottom row — status pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={isPersistent ? "pill-rose" : "pill-amber"} title={isPersistent ? "Persistent — Our Room" : "Session — Tonight"}>
                            {isPersistent ? "Perm" : "Temp"}
                          </span>
                          {isLive && (
                            <span className="pill-live">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" aria-hidden />
                              Live
                            </span>
                          )}
                          {isWaiting && !isLive && (
                            <span className="pill-muted">Waiting</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-5 rounded-[2.5rem] border border-dashed border-white/[0.1] px-8 py-20 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent ring-1 ring-primary/25">
                  <MessageSquare className="h-9 w-9 text-primary/75" strokeWidth={1.25} />
                </div>
                <div className="max-w-xs space-y-2">
                  <p className="font-serif text-xl italic text-cream">No rooms yet.</p>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Create one and share the invite</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="animate-fade-in space-y-4">
            <h2 className="mb-2 px-1 text-[11px] uppercase tracking-[0.35em] text-muted-foreground">History</h2>
            {endedRooms.length === 0 ? (
              <div className="space-y-2 rounded-[2rem] border border-dashed border-white/[0.1] px-8 py-20 text-center">
                <p className="font-serif text-lg italic text-cream">No past sessions yet.</p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Rooms move here once their session ends</p>
              </div>
            ) : (
              <div className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {endedRooms.map((r) => {
                  const isPersistent = r.persistence === "persistent";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/room/${r.id}/recap`)}
                      className="group editorial-card hover-lift focus-ring flex items-center gap-3 p-4 text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/60 text-lg ring-1 ring-white/[0.06]">
                        {isPersistent ? "🏠" : "🕯️"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-cream">{isPersistent ? "Our Room" : "Tonight"}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          <span className={isPersistent ? "pill-rose" : "pill-amber"}>{isPersistent ? "Perm" : "Temp"}</span>
                          <span className="truncate">Code {r.code} · recap</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "profile" && (
          <div className="mx-auto max-w-xl animate-fade-in space-y-6">
            <div className="flex items-center gap-4 rounded-3xl p-6 glass-strong grain">
              {me?.photo_url ? (
                <img src={me.photo_url} alt="" className="h-16 w-16 rounded-full border-2 border-rosegold/20 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-rosegold/20 bg-gradient-to-br from-rosegold/30 to-romantic/30 font-serif text-2xl text-cream">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-medium text-cream">{me?.display_name || me?.email?.split("@")[0]}</p>
                <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
                {me?.country && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <Globe className="h-3 w-3" /> {me.country}
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => navigate("/settings")} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 glass grain transition hover:bg-secondary/40">
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left text-sm text-cream">Manage profile</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>
            <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 glass grain transition hover:bg-secondary/40">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-cream">Sign out</span>
            </button>
          </div>
        )}
      </main>

      {/* Bottom nav — mobile only; desktop uses the header tabs. */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-subtle backdrop-blur-xl border-t border-white/[0.06] lg:hidden">
        <div className="mx-auto flex h-[calc(4rem+env(safe-area-inset-bottom))] max-w-2xl px-6 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                tab === t.id ? "text-primary" : "text-muted-foreground hover:text-cream",
              )}
            >
              <t.icon className="h-5 w-5" fill={tab === t.id && t.id !== "history" ? "currentColor" : "none"} />
              <span className="text-[10px] uppercase tracking-[0.18em]">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </PageShell>
  );
}
