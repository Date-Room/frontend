import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Ticket,
  DoorOpen,
  ScrollText,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/authClient";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/promo", label: "Promo codes", icon: Ticket },
  { to: "/admin/rooms", label: "Rooms", icon: DoorOpen },
  { to: "/admin/chaperon", label: "Chaperon AI", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminLayout() {
  const user = authClient.getSession()?.user;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-56 shrink-0 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <p className="text-xs uppercase tracking-[0.2em] text-amber">DateRoom</p>
          <h1 className="font-semibold text-lg mt-1">Admin</h1>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-amber/15 text-amber"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900",
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <Link
            to="/home"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit to app
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
