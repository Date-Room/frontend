import { useState } from "react";
import { listAdminAudit, type AdminAuditRow } from "@/lib/admin";
import { useCursorPages } from "@/hooks/useCursorPages";
import { Pager } from "@/components/admin/Pager";
import { cn } from "@/lib/utils";

/** Pure: how serious an admin action is, for the severity chip and filter. */
export function auditSeverity(action: string): "info" | "warn" | "danger" {
  if (/revoke|delete|force_close|make_admin|set_admin|end_sessions/.test(action)) return "danger";
  if (/grant|decline|set_team|billing_region|promo_created|feedback_update/.test(action)) return "warn";
  return "info";
}

const TONE = {
  info: "bg-white/[0.08] text-cream/70",
  warn: "bg-amber-500/15 text-amber-300",
  danger: "bg-rose-500/15 text-rose-300",
};

export default function AdminAudit() {
  const [severity, setSeverity] = useState<"all" | "info" | "warn" | "danger">("all");
  const pages = useCursorPages<AdminAuditRow>({
    queryKey: ["admin-audit"],
    fetchPage: (cursor, limit) => listAdminAudit({ cursor, limit }),
    perPage: 50,
  });
  const rows = severity === "all" ? pages.items : pages.items.filter((r) => auditSeverity(r.action) === severity);
  const seg = (on: boolean) =>
    cn("rounded-full border px-2.5 py-0.5 text-xs transition", on ? "border-primary/60 bg-primary/[0.12] text-primary" : "border-white/[0.14] bg-card text-cream/80 hover:bg-white/[0.08]");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-cream">Audit log</h2>
        <p className="mt-1 text-sm text-muted-foreground/70">Who changed what: grants, promos, admin flags, verdicts.</p>
      </div>

      <div className="flex items-center gap-1.5">
        {(["all", "info", "warn", "danger"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSeverity(s)} className={seg(severity === s)}>
            {s === "all" ? "All on this page" : s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <table className="w-full text-sm">
          <thead className="bg-card/80 text-left text-muted-foreground/70">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
            </tr>
          </thead>
          <tbody>
            {pages.isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground/70">Loading…</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/[0.08]">
                <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground/70">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.admin_email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[auditSeverity(row.action)])}>{row.action}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground/70">
                  {row.target_type && `${row.target_type}:`}
                  {row.target_id?.slice(0, 8)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager from={pages.from} to={pages.to} total={pages.total} perPage={pages.perPage} onPerPage={pages.setPerPage} hasPrev={pages.hasPrev} hasNext={pages.hasNext} onPrev={pages.prev} onNext={pages.next} noun="entries" busy={pages.isFetching} />
      </div>
    </div>
  );
}
