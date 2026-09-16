/**
 * The admin is a different room from the product on purpose: night blue,
 * cool white, an electric primary and neon state colours (the `theme-admin`
 * token set in index.css), dense, sans everywhere. Nav is grouped
 * (Overview / Operations) with live counts.
 */
import { Link, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Ticket,
  DoorOpen,
  ScrollText,
  ShieldCheck,
  ArrowLeft,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/authClient";
import { getAdminStats, listCoachBetaApplicationsBy } from "@/lib/admin";
import { CommandSearch } from "@/components/admin/CommandSearch";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; count?: number | string };

export function AdminLayout() {
  const user = authClient.getSession()?.user;
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: getAdminStats, staleTime: 60_000 });
  const pending = useQuery({
    queryKey: ["admin-coach-beta-applications"],
    queryFn: () => listCoachBetaApplicationsBy("pending"),
    staleTime: 60_000,
  });

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Overview",
      items: [
        { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/admin/users", label: "Users", icon: Users, count: stats.data?.total_users },
        { to: "/admin/promo", label: "Promo codes", icon: Ticket },
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/admin/rooms", label: "Rooms", icon: DoorOpen, count: stats.data?.live_rooms ? `${stats.data.live_rooms} live` : undefined },
        { to: "/admin/chaperon", label: "Chaperon AI", icon: ShieldCheck },
        { to: "/admin/beta", label: "Beta console", icon: Radio, count: pending.data?.pending_count || undefined },
        { to: "/admin/audit", label: "Audit log", icon: ScrollText },
      ],
    },
  ];

  return (
    <div className="theme-admin flex min-h-screen bg-background text-cream">
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground neon-glow">
            DR
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-none tracking-tight">DateRoom</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">Admin</p>
          </div>
        </div>
        <div className="px-3 pb-1">
          <CommandSearch />
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1 pt-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{g.label}</p>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
                      isActive ? "bg-primary/[0.14] text-cream neon-nav" : "text-muted-foreground hover:bg-white/[0.05] hover:text-cream",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                      {item.count !== undefined && (
                        <span className={cn("ml-auto text-[11px] tabular-nums", isActive ? "text-primary" : "text-muted-foreground/70")}>{item.count}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-1.5 border-t border-white/[0.06] px-5 py-4">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <Link to="/home" className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" />
            Exit to app
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1180px] p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
