/**
 * Squad admin. The beta queue: who asked, where they are, how many, what
 * for. Pick a spread of groups (the country counts help), then let them in
 * (optionally with a 4-night pack that lands in their first room) or
 * decline. Below it, the squad rooms: find one and add nights for free.
 * Everything is audited server-side.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  declineSquadBeta,
  giftSquadNights,
  grantSquadBeta,
  listAdminSquadCards,
  listAdminSquadRooms,
  listSquadBetaApplications,
  type AdminSquadCard,
  type AdminSquadRoom,
  type SquadBetaApplication,
  type SquadBetaDeclineReason,
  type SquadBetaGrantResult,
} from "@/lib/admin";
import { SQUAD_GAMES } from "@/lib/squadGames";
import { cn } from "@/lib/utils";

const PLAN_LABELS: Record<string, string> = {
  films: "Films",
  games: "Games",
  catch_up: "Catching up",
  trip: "Trip",
  other: "Other",
};

const DECLINE_REASONS: { id: SquadBetaDeclineReason; label: string }[] = [
  { id: "not_yet", label: "Not yet" },
  { id: "full", label: "Beta full" },
  { id: "other", label: "Other" },
];

type Filter = "pending" | "granted" | "declined" | "all";

/** The pack an admin can gift with access, or later to someone let in. */
const GIFT_PACK_NIGHTS = 4;
const GIFT_NIGHT_CHOICES = [1, 2, 4, 8];

/** Pure: what happened to a gift, for the toast. */
export function giftLine(name: string, r: SquadBetaGrantResult): string {
  if (!r.gift_nights) return `${name} is in`;
  const nights = `${r.gift_nights} night${r.gift_nights === 1 ? "" : "s"}`;
  return r.gift_room_id
    ? `${name} got ${nights}, added to their squad room`
    : `${name} got ${nights}. They land in their first squad room`;
}

/** Pure: "KE 3 · NG 2 · ?? 1", biggest first. */
export function countryLine(byCountry: Record<string, number>): string {
  return Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([c, n]) => `${c} ${n}`)
    .join(" · ");
}

export default function AdminSquad() {
  const [filter, setFilter] = useState<Filter>("pending");
  const q = useQuery({
    queryKey: ["admin-squad-beta", filter],
    queryFn: () => listSquadBetaApplications(filter),
  });
  const counts = q.data?.counts;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Squad beta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Requests for Squad (friend nights, 2 to 5 people). Oldest first.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Waiting" value={counts?.pending} />
        <Stat label="Let in" value={counts?.with_access} />
        <Stat label="Declined" value={counts?.declined} />
        <div className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Waiting by country</p>
          <p className="mt-1 text-sm text-cream">{counts ? countryLine(counts.pending_by_country) || "None" : "—"}</p>
        </div>
      </div>

      <div className="flex gap-1.5" role="tablist" aria-label="Filter requests">
        {(["pending", "granted", "declined", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize",
              filter === f ? "border-primary/60 bg-primary/15 text-cream" : "border-white/[0.14] text-cream/70 hover:bg-white/[0.06]",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />}
      {q.data && q.data.items.length === 0 && (
        <p className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground/70">
          Nothing here.
        </p>
      )}
      <div className="space-y-3">
        {q.data?.items.map((app) => <RequestCard key={app.id} app={app} />)}
      </div>

      <SquadRooms />
      <SkippedCards />
    </div>
  );
}

/* ───────────────── Squad rooms: find one, add nights ───────────────── */

function SquadRooms() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const rooms = useQuery({
    queryKey: ["admin-squad-rooms", query],
    queryFn: () => listAdminSquadRooms(query),
  });

  return (
    <section className="space-y-3 pt-6" aria-labelledby="squad-rooms-h">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h2 id="squad-rooms-h" className="text-xl font-semibold">Squad rooms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Newest first. Add nights for free: they&rsquo;re sized to the room&rsquo;s seats and never expire.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
        >
          <input
            id="squad-room-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, room name, owner email"
            className="admin-input w-64 rounded-lg px-3 py-1.5 text-sm"
            aria-label="Search squad rooms"
          />
          <button type="submit" className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-sm text-cream hover:bg-white/[0.06]">
            Search
          </button>
        </form>
      </div>
      {rooms.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />}
      {rooms.data && rooms.data.items.length === 0 && (
        <p className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground/70">
          {query ? "No squad rooms match." : "No squad rooms yet."}
        </p>
      )}
      <div className="space-y-2">
        {rooms.data?.items.map((room) => <RoomRow key={room.id} room={room} />)}
      </div>
    </section>
  );
}

function RoomRow({ room }: { room: AdminSquadRoom }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nights, setNights] = useState(GIFT_PACK_NIGHTS);
  const [note, setNote] = useState("");
  const gift = useMutation({
    mutationFn: () => giftSquadNights(room.id, { nights, note: note.trim() || undefined }),
    onSuccess: (r) => {
      toast.success(`Added ${nights} night${nights === 1 ? "" : "s"}. ${r.nights_left} left in ${room.name || room.code}`);
      setOpen(false);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin-squad-rooms"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't add nights"),
  });

  return (
    <div className="rounded-lg border border-white/[0.08] bg-card/40">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {room.name || "Unnamed squad"} <span className="font-mono text-xs text-muted-foreground">{room.code}</span>
            {room.night_on && (
              <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">night on</span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {room.owner_name || room.owner_email} · {room.owner_email}
          </p>
        </div>
        <Mini label="Seats" value={room.seats} />
        <Mini label="Nights left" value={room.nights_left} />
        <Mini label="Played" value={room.nights_played} />
        <Mini label="Members" value={room.members} />
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Add nights
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] px-4 py-3">
          <span className="text-xs text-muted-foreground">Nights</span>
          {GIFT_NIGHT_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={nights === n}
              onClick={() => setNights(n)}
              className={cn(
                "rounded-full border px-3 py-0.5 text-sm tabular-nums",
                nights === n ? "border-primary/60 bg-primary/15 text-cream" : "border-white/[0.14] text-cream/80",
              )}
            >
              {n}
            </button>
          ))}
          <input
            id={`gift-note-${room.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Note for the audit log (optional)"
            className="admin-input min-w-[12rem] flex-1 rounded-lg px-3 py-1.5 text-sm"
            aria-label="Note"
          />
          <button
            type="button"
            disabled={gift.isPending}
            onClick={() => gift.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {gift.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add {nights} night{nights === 1 ? "" : "s"} free
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-cream">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}

function RequestCard({ app }: { app: SquadBetaApplication }) {
  const qc = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState<SquadBetaDeclineReason>("not_yet");
  const [withPack, setWithPack] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-squad-beta"] });
    void qc.invalidateQueries({ queryKey: ["admin-squad-rooms"] });
  };
  const name = app.display_name || app.email;
  const grant = useMutation({
    mutationFn: (gift: number) => grantSquadBeta({ user_id: app.user_id, gift_nights: gift }),
    onSuccess: (r) => { toast.success(giftLine(name, r)); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Grant failed"),
  });
  const decline = useMutation({
    mutationFn: () => declineSquadBeta({ user_id: app.user_id, reason }),
    onSuccess: () => { toast.success("Declined"); setDeclineOpen(false); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Decline failed"),
  });

  return (
    <div className="rounded-lg border border-white/[0.08] bg-card/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-3">
        <p className="font-semibold">{app.display_name || app.email}</p>
        {app.is_team && <span className="rounded-full bg-white/[0.12] px-2 py-0.5 text-[11px] text-cream/80">team</span>}
        <span className="text-xs text-muted-foreground">{app.email}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(app.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          {app.status !== "pending" && ` · ${app.status}${app.decline_reason ? ` (${app.decline_reason.replace("_", " ")})` : ""}`}
        </span>
      </div>
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-3">
        <Field label="Where" value={`${app.city}${app.country ? `, ${app.country}` : ""}`} />
        <Field label="How many" value={`${app.group_size} people`} />
        <Field label="For" value={app.plans.map((p) => PLAN_LABELS[p] ?? p).join(", ")} />
        {app.note && (
          <div className="sm:col-span-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Note</p>
            <p className="mt-1 text-cream">&ldquo;{app.note}&rdquo;</p>
          </div>
        )}
      </div>
      {app.status === "pending" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button"
            disabled={grant.isPending}
            onClick={() => grant.mutate(withPack ? GIFT_PACK_NIGHTS : 0)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground neon-btn hover:bg-primary/90 disabled:opacity-40"
          >
            {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Let them in
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-cream/90">
            <input
              id={`gift-pack-${app.id}`}
              type="checkbox"
              checked={withPack}
              onChange={(e) => setWithPack(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Include a {GIFT_PACK_NIGHTS}-night pack
          </label>
          {!declineOpen ? (
            <button type="button" onClick={() => setDeclineOpen(true)} className="rounded-lg border border-rose-500/40 bg-rose-500/[0.06] px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10">
              Decline
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {DECLINE_REASONS.map((r) => (
                <button key={r.id} type="button" onClick={() => setReason(r.id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", reason === r.id ? "border-rose-400/60 bg-rose-500/15 text-rose-100" : "border-white/[0.14] bg-card text-cream/80")}>
                  {r.label}
                </button>
              ))}
              <button type="button" disabled={decline.isPending} onClick={() => decline.mutate()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
                Confirm decline
              </button>
              <button type="button" onClick={() => setDeclineOpen(false)} className="text-xs text-muted-foreground hover:text-cream">
                Cancel
              </button>
            </div>
          )}
          <span className="text-xs text-muted-foreground/70">They only ever see &ldquo;not this round&rdquo;.</span>
        </div>
      )}
      {app.status === "granted" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button"
            disabled={grant.isPending}
            onClick={() => grant.mutate(GIFT_PACK_NIGHTS)}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-1.5 text-sm text-cream hover:bg-primary/10 disabled:opacity-40"
          >
            {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Gift a {GIFT_PACK_NIGHTS}-night pack
          </button>
          <span className="text-xs text-muted-foreground/70">
            Goes to their newest squad room, or their first one when they open it.
          </span>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-cream">{value}</p>
    </div>
  );
}

const GAME_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(SQUAD_GAMES).map((g) => [g.id, g.label]),
);

/** Pure: "40%" of the times a card was dealt that someone skipped it. */
export function skipRate(card: Pick<AdminSquadCard, "dealt" | "skipped">): string {
  return card.dealt ? `${Math.round((100 * card.skipped) / card.dealt)}%` : "0%";
}

/* ───────────────── Cards the beta skips ───────────────── */

function SkippedCards() {
  const cards = useQuery({ queryKey: ["admin-squad-cards"], queryFn: listAdminSquadCards });
  const items = cards.data?.items ?? [];
  const skipped = items.filter((c) => c.skipped > 0);
  return (
    <section className="space-y-3 pt-6" aria-labelledby="squad-cards-h">
      <div>
        <h2 id="squad-cards-h" className="text-xl font-semibold">Cards the beta skips</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Squads can skip a card before anyone plays it. The most skipped are the ones to cut.
          {items.length > 0 && ` ${items.length} cards dealt so far, ${skipped.length} skipped at least once.`}
        </p>
      </div>
      {cards.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />}
      {cards.data && skipped.length === 0 && (
        <p className="rounded-lg border border-white/[0.08] bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground/70">
          No skips yet.
        </p>
      )}
      {skipped.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
              <tr>
                <th className="px-3 py-2 font-medium">Card</th>
                <th className="px-3 py-2 font-medium">Game</th>
                <th className="px-3 py-2 text-right font-medium">Skipped</th>
                <th className="px-3 py-2 text-right font-medium">Dealt</th>
                <th className="px-3 py-2 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {skipped.slice(0, 50).map((c) => (
                <tr key={c.id} className="border-t border-white/[0.06]">
                  <td className="max-w-[28rem] px-3 py-2">
                    <span className="block text-cream">{c.text}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {c.id} · {c.deck}
                      {c.region !== "all" && ` · ${c.region.toUpperCase()}`}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{GAME_LABELS[c.game] ?? c.game}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{c.skipped}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.dealt}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{skipRate(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
