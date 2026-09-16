import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAdminRooms } from "@/lib/admin";

export default function AdminRooms() {
  const [state, setState] = useState<string>("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-rooms", state],
    queryFn: () => listAdminRooms(state || undefined),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-cream">Rooms</h2>
        <p className="text-muted-foreground/70 text-sm mt-1">Active and persistent rooms across the platform.</p>
      </div>

      <select
        value={state}
        onChange={(e) => setState(e.target.value)}
        className="rounded-lg bg-card border border-white/[0.14] px-3 py-2 text-sm"
      >
        <option value="">All states</option>
        <option value="live">Live</option>
        <option value="active">Active</option>
        <option value="waiting">Waiting</option>
        <option value="grace">Grace</option>
        <option value="ended">Ended</option>
      </select>

      <div className="rounded-xl border border-white/[0.08] overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-card/80 text-muted-foreground/70 text-left">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">People</th>
              <th className="px-4 py-3">State</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground/70">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.map((r) => (
              <tr key={r.id} className="border-t border-white/[0.08]">
                <td className="px-4 py-3 font-mono text-cream/90">{r.code}</td>
                <td className="px-4 py-3 text-muted-foreground/70 text-xs">{r.host_email ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.package}
                  {r.persistence === "persistent" && (
                    <span className="ml-1 text-amber-500/80">· persistent</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {r.participant_count}/{r.max_participants}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs uppercase">
                    {r.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
