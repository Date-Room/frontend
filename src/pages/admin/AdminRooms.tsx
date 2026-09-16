import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminStatsDeltas, listAdminRooms, type AdminRoomRow } from "@/lib/admin";
import { useCursorPages } from "@/hooks/useCursorPages";
import { Pager } from "@/components/admin/Pager";
import { cn } from "@/lib/utils";

const STATE_TONE: Record<string, string> = {
  live: "bg-emerald-500/15 text-emerald-300",
  active: "bg-emerald-500/15 text-emerald-300",
  waiting: "bg-sky-500/15 text-sky-300",
  grace: "bg-amber-500/15 text-amber-300",
  ended: "bg-white/[0.08] text-cream/60",
};

export default function AdminRooms() {
  const [state, setState] = useState<string>("");
  const [persistence, setPersistence] = useState<string>("");
  const stats = useQuery({ queryKey: ["admin-stats-deltas", 30], queryFn: () => getAdminStatsDeltas(30), staleTime: 60_000 });
  const pages = useCursorPages<AdminRoomRow>({
    queryKey: ["admin-rooms", state, persistence],
    fetchPage: (cursor, limit) => listAdminRooms({ state: state || undefined, persistence: persistence || undefined, cursor, limit }),
    perPage: 25,
  });
  const n = stats.data?.now;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-cream">Rooms</h2>
        <p className="mt-1 text-sm text-muted-foreground/70">Dates and persistent rooms across the platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Live now", n?.live_rooms],
          ["Dates live", n?.live_dates],
          ["Persistent live", n?.live_persistent],
          ["Opened, 30d", stats.data?.current.rooms_opened],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-white/[0.08] bg-card/40 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{l}</p>
            <p className="text-xl font-semibold tabular-nums">{v ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={state} onChange={(e) => setState(e.target.value)} className="rounded-lg border border-white/[0.14] bg-card px-3 py-2 text-sm">
          <option value="">All states</option>
          <option value="live">Live</option>
          <option value="active">Active</option>
          <option value="waiting">Waiting</option>
          <option value="grace">Grace</option>
          <option value="ended">Ended</option>
        </select>
        <select value={persistence} onChange={(e) => setPersistence(e.target.value)} className="rounded-lg border border-white/[0.14] bg-card px-3 py-2 text-sm">
          <option value="">Dates and persistent</option>
          <option value="session">Dates only</option>
          <option value="persistent">Persistent only</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-card/80 text-left text-muted-foreground/70">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">People</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Opened</th>
            </tr>
          </thead>
          <tbody>
            {pages.isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground/70">Loading…</td></tr>
            )}
            {pages.items.map((r) => (
              <tr key={r.id} className="border-t border-white/[0.08]">
                <td className="px-4 py-3 font-mono text-cream/90">{r.code}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground/70">{r.host_email ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.package}
                  {r.persistence === "persistent" && <span className="ml-1 text-primary/80">· persistent</span>}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.participant_count}/{r.max_participants}</td>
                <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs uppercase", STATE_TONE[r.state] ?? "bg-white/[0.08]")}>{r.state}</span></td>
                <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground/70">{new Date(r.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager from={pages.from} to={pages.to} total={pages.total} perPage={pages.perPage} onPerPage={pages.setPerPage} hasPrev={pages.hasPrev} hasNext={pages.hasNext} onPrev={pages.prev} onNext={pages.next} noun="rooms" busy={pages.isFetching} />
      </div>
    </div>
  );
}
