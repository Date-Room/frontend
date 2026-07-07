import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAdminUser,
  grantUserProduct,
  listAdminUsers,
  revokeUserSubscription,
  setUserAdmin,
  type AdminUserRow,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

const GRANTS = [
  { id: "date_pack", label: "Date Pack" },
  { id: "long_pack", label: "Long Pack" },
  { id: "together", label: "Together +1" },
  { id: "crew", label: "Crew +1" },
] as const;

export default function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listAdminUsers({ search: search || undefined }),
  });

  // Full inventory for the selected user — plans are additive, so we show
  // every owned plan/credit rather than a single "tier".
  const { data: detail } = useQuery({
    queryKey: ["admin-user", selected?.id],
    queryFn: () => getAdminUser(selected!.id),
    enabled: !!selected,
  });

  function refreshUser() {
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
    void qc.invalidateQueries({ queryKey: ["admin-user", selected?.id] });
  }

  async function grant(product: string) {
    if (!selected) return;
    try {
      await grantUserProduct(selected.id, { product, note: "admin portal grant" });
      toast.success(`Granted ${product} to ${selected.email}`);
      refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grant failed");
    }
  }

  async function revoke() {
    if (!selected) return;
    try {
      await revokeUserSubscription(selected.id);
      toast.success("Subscription revoked");
      refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revoke failed");
    }
  }

  async function toggleAdmin() {
    if (!selected) return;
    try {
      await setUserAdmin(selected.id, !selected.is_admin);
      toast.success(selected.is_admin ? "Admin removed" : "Admin granted");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      setSelected({ ...selected, is_admin: !selected.is_admin });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Users</h2>
        <p className="text-slate-500 text-sm mt-1">Search, inspect tiers, grant products.</p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search email or name…"
        className="max-w-md bg-slate-900 border-slate-700"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={cn(
                    "border-t border-slate-800 cursor-pointer hover:bg-slate-900/50",
                    selected?.id === u.id && "bg-amber-500/10",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="text-slate-200">{u.display_name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs">
                      {u.account_tier_label}
                    </span>
                    {u.is_admin && (
                      <span className="ml-1 text-amber-400 text-xs">admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          {selected ? (
            <>
              <div>
                <p className="font-medium text-slate-100">{selected.display_name}</p>
                <p className="text-sm text-slate-500">{selected.email}</p>
                <p className="text-xs text-slate-600 mt-1 font-mono">{selected.id}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Owned plans (all additive)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: "Date Pack", value: `${detail?.date_pack_remaining ?? 0}` },
                    { label: "Long Pack", value: `${detail?.long_pack_remaining ?? 0}` },
                    { label: "Together", value: `${detail?.together_remaining ?? 0}` },
                    { label: "Crew", value: `${detail?.crew_remaining ?? 0}` },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
                    >
                      <span className="text-slate-400">{row.label}</span>
                      <span className="font-semibold tabular-nums text-slate-100">×{row.value}</span>
                    </div>
                  ))}
                </div>
                {detail?.has_active_subscription && (
                  <p className="text-xs text-emerald-400">Active paid subscription</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Grant plan (stacks — never replaces)</p>
                <div className="grid grid-cols-2 gap-2">
                  {GRANTS.map((g) => (
                    <Button
                      key={g.id}
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                      onClick={() => void grant(g.id)}
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                onClick={() => void revoke()}
              >
                Revoke subscription
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-slate-700"
                onClick={() => void toggleAdmin()}
              >
                {selected.is_admin ? "Remove admin" : "Make admin"}
              </Button>
            </>
          ) : (
            <p className="text-slate-500 text-sm">Select a user to manage.</p>
          )}
        </div>
      </div>
    </div>
  );
}
