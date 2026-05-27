import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, LogOut, MessageSquare, ChevronRight, History, Heart, User, Settings as SettingsIcon, Globe } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { supabase } from "@/lib/supabaseClient";
import { getMe } from "@/lib/users";
import { listMyRooms, type Room, type RoomStateName } from "@/lib/rooms";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";

const ALIVE_STATES = new Set<RoomStateName>(["created", "waiting", "live", "active"]);
const ENDED_STATES = new Set<RoomStateName>(["ended", "grace", "sub_lapsed"]);

type Tab = "history" | "rooms" | "profile";

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
    await supabase.auth.signOut();
    navigate("/auth");
  }

  return (
    <PageShell>
      <header className="fixed top-0 left-0 right-0 z-40 glass-subtle backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10">
            <img src="/logo.png" alt={`${BRAND_NAME} logo`} className="w-full h-full object-cover scale-[1.05]" />
          </div>
          <span className="font-serif italic text-xl text-cream font-semibold">{BRAND_NAME}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-24 pb-28 relative z-10 min-h-screen">
        {tab === "rooms" && (
          <div className="space-y-6 animate-fade-in">
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="w-full btn-primary py-5 flex items-center justify-center gap-3 rounded-[1.35rem] shadow-[0_12px_48px_rgba(212,130,106,0.28)]"
            >
              <Plus className="w-5 h-5" strokeWidth={2.25} />
              <span className="font-medium tracking-wide">Create a new room</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/join")}
              className="w-full -mt-3 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-cream transition py-2"
            >
              Join with code
            </button>

            {aliveRooms.length > 0 ? (
              <div className="space-y-3">
                {aliveRooms.map((r) => {
                  const isHost = me ? r.host_id === me.id : false;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => (isHost ? navigate(`/rooms/${r.id}/pre`) : enterRoom(r))}
                      className="w-full text-left glass-strong grain rounded-[1.75rem] p-5 flex items-center justify-between border border-white/[0.06] hover:border-primary/25 hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center text-xl shrink-0">
                          {r.persistence === "persistent" ? "🏠" : "🕯️"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-serif italic text-lg text-cream truncate">
                            {r.persistence === "persistent" ? "Our Room" : "Tonight"}
                            <span className="text-muted-foreground/70 not-italic text-sm"> · {isHost ? "host" : "guest"}</span>
                          </p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Code {r.code}
                            {isHost ? ` · PIN ${r.pin}` : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[2.5rem] border border-dashed border-white/[0.1] py-20 px-8 flex flex-col items-center justify-center text-center space-y-5">
                <div className="flex h-[5rem] w-[5rem] items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent ring-1 ring-primary/25">
                  <MessageSquare className="w-9 h-9 text-primary/75" strokeWidth={1.25} />
                </div>
                <div className="space-y-2 max-w-xs">
                  <p className="text-cream font-serif italic text-xl">No rooms yet.</p>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Tap + to create one and share the invite</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3 animate-fade-in">
            <h2 className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground px-1 mb-2">History</h2>
            {endedRooms.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-white/[0.1] py-20 px-8 text-center space-y-2">
                <p className="text-cream font-serif italic text-lg">No past sessions yet.</p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Rooms move here once their session ends</p>
              </div>
            ) : (
              endedRooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/room/${r.id}/recap`)}
                  className="w-full text-left glass grain rounded-[1.5rem] p-4 flex items-center justify-between border border-white/[0.06] hover:border-primary/25 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center text-lg shrink-0">🕯️</div>
                    <div className="min-w-0">
                      <p className="text-cream truncate">{r.persistence === "persistent" ? "Our Room" : "Tonight"}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Code {r.code} · recap</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition" />
                </button>
              ))
            )}
          </div>
        )}

        {tab === "profile" && (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-3xl p-6 glass-strong grain flex items-center gap-4">
              {me?.photo_url ? (
                <img src={me.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-rosegold/20" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rosegold/30 to-romantic/30 border-2 border-rosegold/20 flex items-center justify-center text-2xl font-serif text-cream">
                  {(me?.display_name || me?.email || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-medium text-cream truncate">{me?.display_name || me?.email?.split("@")[0]}</p>
                <p className="text-xs text-muted-foreground truncate">{me?.email}</p>
                {me?.country && (
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {me.country}
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => navigate("/settings")} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 glass grain hover:bg-secondary/40 transition">
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-left text-sm text-cream">Manage profile</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            </button>
            <button type="button" onClick={handleSignOut} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 glass grain hover:bg-secondary/40 transition">
              <LogOut className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-cream">Sign out</span>
            </button>
          </div>
        )}
      </main>

      {/* Bottom nav — mobile parity: History / Rooms / Profile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-subtle backdrop-blur-xl border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-6 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex">
          {([
            { id: "history" as const, label: "History", icon: History },
            { id: "rooms" as const, label: "Rooms", icon: Heart },
            { id: "profile" as const, label: "Profile", icon: User },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
                tab === t.id ? "text-primary" : "text-muted-foreground hover:text-cream",
              )}
            >
              <t.icon className="w-5 h-5" fill={tab === t.id && t.id !== "history" ? "currentColor" : "none"} />
              <span className="text-[10px] uppercase tracking-[0.18em]">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </PageShell>
  );
}
