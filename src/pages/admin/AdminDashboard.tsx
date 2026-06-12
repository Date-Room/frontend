import { useQuery } from "@tanstack/react-query";
import { getAdminStats, getPlatformInfo } from "@/lib/admin";

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-slate-100 mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: getAdminStats });
  const { data: platform } = useQuery({ queryKey: ["admin-platform"], queryFn: getPlatformInfo });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Platform pulse</h2>
        <p className="text-slate-500 text-sm mt-1">
          Live snapshot of users, billing, and rooms.
        </p>
      </div>

      {platform && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-400">
            Env: <span className="text-slate-200">{platform.environment}</span>
          </span>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-400">
            Paywall:{" "}
            <span className={platform.paywall_enabled ? "text-amber-400" : "text-emerald-400"}>
              {platform.paywall_enabled ? "On" : "Off"}
            </span>
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats?.total_users ?? "—"} />
        <StatCard label="New (7d)" value={stats?.new_users_7d ?? "—"} />
        <StatCard label="Active subs" value={stats?.active_subscriptions ?? "—"} />
        <StatCard label="Pass credits" value={stats?.total_pass_credits ?? "—"} hint="Outstanding pack credits" />
        <StatCard label="Live rooms" value={stats?.live_rooms ?? "—"} />
        <StatCard label="Persistent rooms" value={stats?.persistent_rooms ?? "—"} />
        <StatCard label="Promo redemptions" value={stats?.promo_redemptions_30d ?? "—"} hint="Last 30 days" />
        <StatCard label="M-Pesa success" value={stats?.mpesa_success_30d ?? "—"} hint="Last 30 days" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="font-medium text-slate-200">Quick actions</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-400">
          <li>
            → Create a launch promo under{" "}
            <a href="/admin/promo" className="text-amber-400 hover:underline">
              Promo codes
            </a>
          </li>
          <li>
            → Grant a tier manually under{" "}
            <a href="/admin/users" className="text-amber-400 hover:underline">
              Users
            </a>
          </li>
          <li>
            → Set <code className="text-slate-300">ADMIN_EMAILS</code> in backend env to bootstrap
            admins by email
          </li>
        </ul>
      </div>
    </div>
  );
}
