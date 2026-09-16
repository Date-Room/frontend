import { useQuery } from "@tanstack/react-query";
import { listAdminAudit } from "@/lib/admin";

export default function AdminAudit() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: listAdminAudit,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-cream">Audit log</h2>
        <p className="text-muted-foreground/70 text-sm mt-1">Who changed what — grants, promos, admin flags.</p>
      </div>

      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/80 text-muted-foreground/70 text-left">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground/70">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-t border-white/[0.08]">
                <td className="px-4 py-3 text-muted-foreground/70 text-xs whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{row.admin_email ?? "—"}</td>
                <td className="px-4 py-3 text-cream/90">{row.action}</td>
                <td className="px-4 py-3 text-muted-foreground/70 text-xs font-mono">
                  {row.target_type && `${row.target_type}:`}
                  {row.target_id?.slice(0, 8)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
