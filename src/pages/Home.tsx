import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Plus,
  LogOut,
  History,
  Heart,
  User,
  KeyRound,
  Search,
  Timer,
  UserPlus,
  X,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { authClient } from "@/lib/authClient";
import { getMe, type UserMe } from "@/lib/users";
import { getEntitlement, getBillingConfig, type BillingConfig, type Entitlement } from "@/lib/billing";
import {
  listMyRooms,
  getRoomByCode,
  type Room,
  type RoomStateName,
  type InviteCard,
  type ParticipantInfo,
} from "@/lib/rooms";
import { PageShell } from "@/components/PageShell";
import { ProfilePlanSection } from "@/components/ProfilePlanSection";
import { ShimmerSkeleton } from "@/components/ui/skeleton";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { cn } from "@/lib/utils";

const ALIVE_STATES = new Set<RoomStateName>(["created", "waiting", "live", "active"]);
const ENDED_STATES = new Set<RoomStateName>(["ended", "grace", "sub_lapsed"]);

type Tab = "history" | "rooms" | "profile";

const TABS: { id: Tab; label: string; icon: typeof Heart }[] = [
  { id: "rooms", label: "Rooms", icon: Heart },
  { id: "history", label: "Recap", icon: History },
  { id: "profile", label: "Profile", icon: User },
];

// 25h retention ceiling for Recap entries. After this they get swept
// from local storage and dropped from the UI — mirrors mobile.
const RECAP_RETENTION_MS = 25 * 60 * 60 * 1000;
const RECAP_SWEPT_KEY = "dr.recap.swept.v1"; // localStorage set of recently-removed room ids

/** "Ends in 12m" / "Ends in 3h" / "Ended" — small expiry helper for
 *  session-room tiles. Mirrors mobile `_expiryLabel`. */
function expiryLabel(when: string | null | undefined): string | null {
  if (!when) return null;
  const diff = new Date(when).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ends in <1m";
  if (mins < 60) return `Ends in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Ends in ${hours}h`;
  return `Ends in ${Math.floor(hours / 24)}d`;
}

/** Format "Xh Ym left" / "Ym left" / "deleted soon" from a future timestamp. */
function formatGraceCountdown(graceEndsAt: string | null, now: number): string {
  if (!graceEndsAt) return "";
  const ms = new Date(graceEndsAt).getTime() - now;
  if (ms <= 0) return "deleted soon";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

/** Best-effort partner extraction from an InviteCard. Returns the
 *  first participant whose user_id isn't us. Falls back to the host
 *  attribution when we're the guest. */
function pickPartner(card: InviteCard | undefined, me: UserMe | undefined): {
  name: string;
  photo: string | null;
} | null {
  if (!card) return null;
  for (const p of card.participants) {
    if (!p.user_id) continue;
    if (me?.id && p.user_id === me.id) continue;
    return { name: p.display_name, photo: p.photo_url };
  }
  // Fallback — if we're the guest, the host attribution is the partner.
  if (me?.id && card.host_display_name && card.participants.every((p) => p.user_id !== me.id)) {
    // We aren't on the list at all — but the host is the partner from
    // our POV iff we're a guest. We can't tell without our slot, but
    // returning the host is fine for the title.
  }
  // Try host as partner if we're not the host. Imperfect — we don't have
  // host_id on InviteCard — but the title falls through gracefully.
  return null;
}

/** Build the searchable text for a room tile — code, role, greeting,
 *  host name, every participant display name. */
function tileSearchHay(r: Room, card: InviteCard | undefined, isHost: boolean): string {
  const parts: string[] = [
    r.code,
    isHost ? "host" : "guest",
    r.greeting_headline ?? "",
    card?.host_display_name ?? "",
    ...(card?.participants ?? []).map((p) => p.display_name),
  ];
  return parts.join(" ").toLowerCase();
}

export default function Home() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("rooms");

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const { data: entitlement, isLoading: entitlementLoading } = useQuery({
    queryKey: ["entitlement"],
    queryFn: getEntitlement,
    staleTime: 30_000,
    retry: 1,
  });
  const { data: billingConfig, isLoading: billingLoading } = useQuery({
    queryKey: ["billing-config"],
    queryFn: getBillingConfig,
    staleTime: 30_000,
    retry: 1,
  });
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 10_000,
  });

  // Per-room invite-card fetches — gives us the partner info the
  // /v1/rooms list endpoint doesn't return. Mirrors the mobile
  // myRoomsProvider flow.
  const cardQueries = useQueries({
    queries: rooms.map((r) => ({
      queryKey: ["invite-card", r.code],
      queryFn: () => getRoomByCode(r.code),
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  });
  const cardByRoomId = useMemo(() => {
    const out: Record<string, InviteCard | undefined> = {};
    rooms.forEach((r, i) => {
      out[r.id] = cardQueries[i]?.data;
    });
    return out;
  }, [rooms, cardQueries]);

  const aliveRooms = rooms.filter((r) => ALIVE_STATES.has(r.state));
  const endedRooms = rooms.filter((r) => ENDED_STATES.has(r.state));

  // Tick once per minute so the "Ends in Xm" / grace countdown stays
  // current without spinning up a 1s interval.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // 25h recap retention sweep — drop ended rooms whose saved-by-server
  // timestamp is past the ceiling. We use `ended_at` (or `grace_expires_at`
  // back-derived) as a proxy for "saved at" since web doesn't have the
  // mobile local-room-store concept. Anything older than 25h since
  // ended_at is hidden + remembered locally so we don't re-show it.
  const [sweptIds, setSweptIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(RECAP_SWEPT_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    const stale: string[] = [];
    for (const r of endedRooms) {
      const t = r.ended_at ?? r.grace_expires_at ?? r.created_at;
      if (!t) continue;
      if (now - new Date(t).getTime() > RECAP_RETENTION_MS) {
        stale.push(r.id);
      }
    }
    if (stale.length === 0) return;
    setSweptIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of stale) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      try {
        localStorage.setItem(RECAP_SWEPT_KEY, JSON.stringify(Array.from(next)));
      } catch { /* ignore quota */ }
      return next;
    });
  }, [endedRooms, now]);
  const visibleEndedRooms = endedRooms.filter((r) => !sweptIds.has(r.id));

  // Search query for the unified Rooms list.
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visibleAliveRooms = aliveRooms.filter((r) => {
    if (!q) return true;
    const isHost = me?.id ? r.host_id === me.id : false;
    return tileSearchHay(r, cardByRoomId[r.id], isHost).includes(q);
  });

  // WhatsApp-style header — fade in the compact pinned title once the
  // big inline title has scrolled past.
  const [scrollY, setScrollY] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Big inline title sits ~24px from top once scrolled past header.
  // Threshold tuned so the swap happens around when the big text
  // leaves the compact-header band.
  const compactT = Math.min(1, Math.max(0, (scrollY - 36) / 36));

  function enterRoom(r: Room) {
    const slot = me && r.host_id === me.id ? "a" : "b";
    // Persistent rooms have no hard cutoff — never forward an
    // expires_at on the URL even if the cached Room row still carries
    // a stale session-era stamp. The LiveRoom screen keys "expired"
    // off this param; leaking it makes a live perm room read as ended.
    const exp =
      r.persistence === "persistent" || !r.expires_at
        ? ""
        : `&expires_at=${encodeURIComponent(r.expires_at)}`;
    navigate(`/room/${r.id}?slot=${slot}${exp}`);
  }

  function onTileTap(r: Room) {
    const isHost = me ? r.host_id === me.id : false;
    if (isHost) {
      navigate(`/rooms/${r.id}/pre`);
    } else {
      enterRoom(r);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/auth");
  }

  const initial = (me?.display_name || me?.email || "?")[0]?.toUpperCase();

  return (
    <PageShell>
      {/* Header — logo + (desktop) tab nav + account. Compact pinned
          page title slides in on scroll on mobile. */}
      <header className="fixed top-0 left-0 right-0 z-40 glass-subtle backdrop-blur-xl border-b border-white/[0.04]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10">
            <img src="/dateroom-logo.png" alt={`${BRAND_NAME} logo`} className="h-full w-full object-cover" />
          </div>
          <span className="font-serif text-xl font-semibold italic text-cream">{BRAND_NAME}</span>

          {/* Mobile compact pinned title — WhatsApp-style swap-in once the
              big inline title scrolls past. `lg:hidden` because desktop
              already has a persistent tab nav in the same header band
              (Rooms / Recap / Profile to the right), which serves the
              same orientation purpose. Adding a second title there would
              just duplicate the active tab label. If we ever drop the
              desktop tab nav in favour of a different header pattern
              (e.g. logo + breadcrumb), wire a desktop version here. */}
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-semibold text-cream lg:hidden"
            style={{ opacity: compactT, transition: "opacity 160ms ease-out" }}
            aria-hidden={compactT < 0.5}
          >
            {tab === "history" ? "Recap" : tab === "profile" ? "Profile" : "Rooms"}
          </div>

          {/* Desktop tab nav */}
          <nav className="ml-8 hidden items-center gap-1 lg:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={cn(
                  "focus-ring relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.id ? "text-primary" : "text-muted-foreground hover:text-cream",
                )}
              >
                {tab === t.id && (
                  <span
                    className="absolute inset-0 -z-10 rounded-full bg-primary/15 shadow-[inset_0_0_0_1px_rgba(212,130,106,0.18)]"
                    aria-hidden
                  />
                )}
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
              <UserAvatarImg
                src={me?.photo_url}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
                fallback={
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-rosegold/40 to-romantic/30 font-serif text-sm text-cream">
                    {initial}
                  </span>
                }
              />
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

      <main ref={mainRef} className="relative z-10 mx-auto min-h-screen max-w-3xl px-4 pt-20 pb-28 lg:max-w-4xl lg:px-6 lg:pb-16">
        {tab === "rooms" && (
          <div className="animate-fade-in space-y-4">
            {/* Big inline title — scrolls with content, WhatsApp-style.
                Compact pinned mirror lives in the header. */}
            <div className="flex items-end justify-between px-2 pt-3">
              <h1 className="font-serif text-4xl font-semibold leading-tight text-cream">Rooms</h1>
              <button
                type="button"
                onClick={() => navigate("/join")}
                aria-label="Join with code"
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-amber transition-colors hover:bg-amber/10"
              >
                <KeyRound className="h-5 w-5" />
              </button>
            </div>

            {/* Search field — chat-app style under the title. */}
            <div className="px-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="focus-ring w-full rounded-xl border border-transparent bg-secondary/60 py-2.5 pl-10 pr-9 text-sm text-cream placeholder:text-muted-foreground/70 focus:border-primary/30"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Action bar — Create + Join. */}
            <div className="flex flex-col gap-3 px-2 pt-2 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={() => navigate("/create")}
                className="btn-primary focus-ring flex items-center justify-center gap-3 rounded-[1.35rem] py-4 shadow-[0_12px_48px_rgba(212,130,106,0.28)] sm:flex-1"
              >
                <Plus className="h-5 w-5" strokeWidth={2.25} />
                <span className="font-medium tracking-wide">Create a new room</span>
              </button>
            </div>

            {/* Unified rooms list (no separate Our Rooms section). */}
            <section className="pt-2">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rooms</p>
              {roomsLoading ? (
                <RoomsSkeletonList />
              ) : visibleAliveRooms.length === 0 ? (
                <RoomsEmptyState query={q} />
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-white/[0.05] bg-card/30">
                  {visibleAliveRooms.map((r, i) => (
                    <li key={r.id}>
                      <RoomTileRow
                        room={r}
                        card={cardByRoomId[r.id]}
                        me={me}
                        isLast={i === visibleAliveRooms.length - 1}
                        onTap={() => onTileTap(r)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "history" && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-end justify-between px-2 pt-3">
              <h1 className="font-serif text-4xl font-semibold leading-tight text-cream">Recap</h1>
            </div>
            <p className="px-2 text-xs leading-relaxed text-amber/85">
              Recaps live for 24 hours after the room ends. After that the room and its contents are deleted permanently.
            </p>

            <div className="px-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="focus-ring w-full rounded-xl border border-transparent bg-secondary/60 py-2.5 pl-10 pr-9 text-sm text-cream placeholder:text-muted-foreground/70 focus:border-primary/30"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {visibleEndedRooms.length === 0 ? (
              <div className="space-y-2 rounded-[2rem] border border-dashed border-white/[0.1] px-8 py-20 text-center">
                <p className="font-serif text-lg italic text-cream">No past sessions yet.</p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Rooms move here once their session ends</p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-white/[0.05] bg-card/30">
                {visibleEndedRooms
                  .filter((r) => {
                    if (!q) return true;
                    const isHost = me?.id ? r.host_id === me.id : false;
                    return tileSearchHay(r, cardByRoomId[r.id], isHost).includes(q);
                  })
                  .map((r, i, arr) => (
                    <li key={r.id}>
                      <RecapTileRow
                        room={r}
                        card={cardByRoomId[r.id]}
                        me={me}
                        now={now}
                        isLast={i === arr.length - 1}
                        onTap={() => navigate(`/room/${r.id}/recap`)}
                      />
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {tab === "profile" && (
          <ProfilePane
            me={me}
            entitlement={entitlement}
            billingConfig={billingConfig}
            billingLoading={entitlementLoading || billingLoading}
            initial={initial}
            onSettings={() => navigate("/settings")}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Bottom nav — mobile only. */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-subtle backdrop-blur-xl border-t border-white/[0.06] lg:hidden">
        <div className="mx-auto flex h-[calc(4rem+env(safe-area-inset-bottom))] max-w-2xl px-6 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              aria-label={t.label}
              className={cn(
                "focus-ring relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                tab === t.id ? "text-primary" : "text-muted-foreground hover:text-cream",
              )}
            >
              {tab === t.id && (
                <span className="absolute top-2 h-0.5 w-6 rounded-full bg-primary/80" aria-hidden />
              )}
              <t.icon
                className="h-5 w-5 transition-transform duration-200"
                fill={tab === t.id && t.id !== "history" ? "currentColor" : "none"}
                style={{ transform: tab === t.id ? "scale(1.06)" : "scale(1)" }}
              />
              <span className="text-[10px] uppercase tracking-[0.18em]">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </PageShell>
  );
}

/* ─────────────────────────── Room tile row ─────────────────────────── */

/**
 * WhatsApp-style room row used by the unified Rooms list.
 *
 * Layout:
 *   [Duo avatar (self behind, partner front)]
 *   [Title (greeting or code) + 'with <Partner>' attribution]
 *   [Ends in Xm (+ timer icon, session only) / Host or Guest]
 *
 * Persistent rooms render clean (no badge), just the role label.
 * Session rooms get the small timer-outline icon next to the
 * expiry label.
 */
function RoomTileRow({
  room,
  card,
  me,
  isLast,
  onTap,
}: {
  room: Room;
  card: InviteCard | undefined;
  me: UserMe | undefined;
  isLast: boolean;
  onTap: () => void;
}) {
  const isHost = me?.id ? room.host_id === me.id : false;
  const isPersistent = room.persistence === "persistent";
  const partner = pickPartner(card, me);
  // If we're the guest, the InviteCard host attribution is our partner.
  const effectivePartner = partner ?? (!isHost && card?.host_display_name
    ? { name: card.host_display_name, photo: card.host_photo_url }
    : null);

  const title = room.greeting_headline?.trim() || room.code;
  const withLine = effectivePartner?.name ? `with ${effectivePartner.name}` : null;
  const endsLine = isPersistent ? null : expiryLabel(room.expires_at);
  const roleWord = isHost ? "Host" : "Guest";

  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "focus-ring group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.025]",
        !isLast && "border-b border-white/[0.05]",
      )}
    >
      <DuoAvatar
        meName={me?.display_name ?? ""}
        mePhoto={me?.photo_url ?? null}
        partnerName={effectivePartner?.name ?? ""}
        partnerPhoto={effectivePartner?.photo ?? null}
      />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-cream">
            {title}
          </p>
          {withLine ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{withLine}</p>
          ) : (
            <p className="mt-0.5 h-3.5" />
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          {endsLine ? (
            <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
              <Timer className="h-3 w-3" strokeWidth={1.5} />
              {endsLine}
            </span>
          ) : (
            <span className="h-3.5" />
          )}
          <span className="mt-0.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            {roleWord}
          </span>
        </div>
      </div>
    </button>
  );
}

/** Compact recap row — same shape, with grace countdown instead of "Ends in". */
function RecapTileRow({
  room,
  card,
  me,
  now,
  isLast,
  onTap,
}: {
  room: Room;
  card: InviteCard | undefined;
  me: UserMe | undefined;
  now: number;
  isLast: boolean;
  onTap: () => void;
}) {
  const isHost = me?.id ? room.host_id === me.id : false;
  const partner = pickPartner(card, me);
  const effectivePartner = partner ?? (!isHost && card?.host_display_name
    ? { name: card.host_display_name, photo: card.host_photo_url }
    : null);
  const title = room.greeting_headline?.trim() || room.code;
  const remaining = formatGraceCountdown(room.grace_expires_at, now);
  const urgent = room.grace_expires_at
    ? new Date(room.grace_expires_at).getTime() - now < 60 * 60 * 1000
    : false;

  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "focus-ring group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.025]",
        !isLast && "border-b border-white/[0.05]",
      )}
    >
      <DuoAvatar
        meName={me?.display_name ?? ""}
        mePhoto={me?.photo_url ?? null}
        partnerName={effectivePartner?.name ?? ""}
        partnerPhoto={effectivePartner?.photo ?? null}
      />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-cream">{title}</p>
          {effectivePartner?.name && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              with {effectivePartner.name}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          {remaining && (
            <span className={cn("text-[11px] tabular-nums", urgent ? "text-rose" : "text-muted-foreground")}>
              {remaining}
            </span>
          )}
          <span className="mt-0.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            {isHost ? "Host" : "Guest"}
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Duo avatar — always renders TWO overlapping circles so every tile
 * reads as 'two seats'. Self goes behind (left), partner in front
 * (right). When no partner has joined yet the partner slot shows a
 * person-plus glyph so the empty seat reads as 'waiting for someone'.
 */
function DuoAvatar({
  meName,
  mePhoto,
  partnerName,
  partnerPhoto,
}: {
  meName: string;
  mePhoto: string | null;
  partnerName: string;
  partnerPhoto: string | null;
}) {
  const partnerEmpty = !partnerName && !partnerPhoto;
  return (
    <div className="relative h-12 w-[60px] shrink-0">
      {/* Self — behind, left edge. */}
      <DuoCircle
        photo={mePhoto}
        initial={meName ? meName[0]?.toUpperCase() : null}
        className="absolute left-0 top-1"
      />
      {/* Partner — in front, right edge. */}
      <DuoCircle
        photo={partnerPhoto}
        initial={partnerName ? partnerName[0]?.toUpperCase() : null}
        awaitingJoin={partnerEmpty}
        className="absolute left-[22px] top-1"
      />
    </div>
  );
}

function DuoCircle({
  photo,
  initial,
  awaitingJoin,
  className,
}: {
  photo: string | null;
  initial: string | null | undefined;
  awaitingJoin?: boolean;
  className?: string;
}) {
  const placeholder = (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-background",
        awaitingJoin ? "bg-secondary" : "bg-primary/15",
        className,
      )}
    >
      {awaitingJoin ? (
        <UserPlus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      ) : initial && initial !== "·" ? (
        <span className="text-[13px] font-semibold text-primary">{initial}</span>
      ) : (
        <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
      )}
    </div>
  );
  if (!photo) return placeholder;
  return (
    <div
      className={cn(
        "h-9 w-9 overflow-hidden rounded-full ring-2 ring-background",
        className,
      )}
    >
      <UserAvatarImg
        src={photo}
        fallback={placeholder}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

/* ─────────────────────────── Skeleton row ─────────────────────────── */

function RoomsSkeletonList() {
  return (
    <ul className="overflow-hidden rounded-2xl border border-white/[0.05] bg-card/30">
      {[0, 1, 2, 3].map((i, _, arr) => (
        <li
          key={i}
          className={cn(
            "flex items-center gap-3 px-3 py-3",
            i < arr.length - 1 && "border-b border-white/[0.05]",
          )}
        >
          <div className="relative h-12 w-[60px] shrink-0">
            <ShimmerSkeleton circle={36} className="absolute left-0 top-1 ring-2 ring-background" />
            <ShimmerSkeleton circle={36} className="absolute left-[22px] top-1 ring-2 ring-background" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerSkeleton width={140} height={12} />
              <ShimmerSkeleton width={90} height={10} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <ShimmerSkeleton width={60} height={10} />
              <ShimmerSkeleton width={36} height={10} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RoomsEmptyState({ query }: { query: string }) {
  if (query) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.1] px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">No matches.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center space-y-5 rounded-[2rem] border border-dashed border-white/[0.1] px-8 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent ring-1 ring-primary/25">
        <Heart className="h-9 w-9 text-primary/75" strokeWidth={1.25} />
      </div>
      <div className="max-w-xs space-y-2">
        <p className="font-serif text-xl italic text-cream">No rooms yet.</p>
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Create one and share the invite</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Profile pane ─────────────────────────── */

function ProfilePane({
  me,
  entitlement,
  billingConfig,
  billingLoading,
  initial,
  onSettings,
  onSignOut,
}: {
  me: UserMe | undefined;
  entitlement: Entitlement | undefined;
  billingConfig: BillingConfig | undefined;
  billingLoading: boolean;
  initial: string | undefined;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl animate-float-up space-y-4 stagger-children">
      <div className="editorial-card p-6">
        <div className="flex items-start gap-4">
          <UserAvatarImg
            src={me?.photo_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full border-2 border-rosegold/20 object-cover"
            fallback={
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-rosegold/20 bg-gradient-to-br from-rosegold/30 to-romantic/30 font-serif text-2xl text-cream">
                {initial}
              </div>
            }
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-lg font-medium text-cream">
              {me?.display_name || me?.email?.split("@")[0]}
            </p>
            <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
          </div>
        </div>
      </div>
      <button type="button" onClick={onSettings} className="editorial-card hover-lift focus-ring flex w-full items-center gap-3 px-4 py-3.5">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left text-sm text-cream">Manage profile</span>
      </button>
      <ProfilePlanSection
        entitlement={entitlement}
        billingConfig={billingConfig}
        loading={billingLoading}
      />
      <button type="button" onClick={onSignOut} className="editorial-card hover-lift focus-ring flex w-full items-center gap-3 px-4 py-3.5">
        <LogOut className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-cream">Sign out</span>
      </button>
    </div>
  );
}
