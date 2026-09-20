/**
 * ⌘K: one box, three answers. Users by email or name, rooms by code, promo
 * codes by code or label. Enter opens the first result; arrows move.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { adminSearch } from "@/lib/admin";
import { cn } from "@/lib/utils";

type Hit = { kind: "user" | "room" | "code"; id: string; title: string; sub: string; href: string };

export function flattenHits(r: Awaited<ReturnType<typeof adminSearch>> | undefined): Hit[] {
  if (!r) return [];
  return [
    ...r.users.map((u) => ({ kind: "user" as const, id: u.id, title: u.display_name || u.email, sub: u.email, href: `/admin/users?q=${encodeURIComponent(u.email)}` })),
    ...r.rooms.map((x) => ({ kind: "room" as const, id: x.id, title: x.code, sub: x.state, href: `/admin/rooms?code=${encodeURIComponent(x.code)}` })),
    ...r.promo_codes.map((c) => ({ kind: "code" as const, id: c.id, title: c.code, sub: c.label, href: `/admin/promo?label=${encodeURIComponent(c.label)}` })),
  ];
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const res = useQuery({ queryKey: ["admin-search", q], queryFn: () => adminSearch(q), enabled: open && q.trim().length > 0, staleTime: 10_000 });
  const hits = flattenHits(res.data);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => input.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(h: Hit) {
    setOpen(false);
    setQ("");
    nav(h.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/[0.14] bg-card px-3 text-left text-label text-muted-foreground/70 hover:bg-white/[0.05]"
      >
        <Search className="h-3.5 w-3.5" />
        Search users, rooms, codes
        <kbd className="ml-auto rounded border border-white/[0.14] px-1.5 text-label">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 pt-[12vh]" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/[0.14] bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={input}
                value={q}
                onChange={(e) => { setQ(e.target.value); setCursor(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                  if (e.key === "Enter" && hits[cursor]) go(hits[cursor]);
                }}
                placeholder="Email, name, room code, promo code…"
                aria-label="Search"
                className="h-11 flex-1 bg-transparent text-body text-cream outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto py-1">
              {q.trim() && hits.length === 0 && !res.isFetching && <li className="px-4 py-3 text-body text-muted-foreground/70">Nothing matches.</li>}
              {hits.map((h, i) => (
                <li key={`${h.kind}:${h.id}`}>
                  <button type="button" onMouseEnter={() => setCursor(i)} onClick={() => go(h)} className={cn("flex w-full items-center gap-3 px-4 py-2 text-left text-body", i === cursor ? "bg-white/[0.08]" : "hover:bg-white/[0.05]")}>
                    <span className="w-12 text-label uppercase tracking-wider text-muted-foreground/70">{h.kind}</span>
                    <span className="text-cream">{h.title}</span>
                    <span className="ml-auto text-label text-muted-foreground/70">{h.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
