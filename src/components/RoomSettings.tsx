import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useRoomCustomization } from "@/context/RoomCustomizationContext";
import { listMyRooms, updateRoom } from "@/lib/rooms";
import { AMBIANCE_PRESETS, PLAIN_MOOD } from "@/lib/ambiance";
import { roomThemes } from "@/lib/roomTheme";
import { cn } from "@/lib/utils";

/**
 * Room info + customization, mounted on the stage from the Room menu. Members
 * can copy the invite code/PIN and change the theme + background; edits persist
 * (updateRoom) and a `customize` broadcast makes the partner refetch live.
 */
export function RoomSettings() {
  const session = useRoomSession();
  const custom = useRoomCustomization();
  const qc = useQueryClient();
  const [copied, setCopied] = useState<"code" | "pin" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    enabled: session.canPersist,
  });
  const row = rooms?.find((r) => r.id === session.roomId);
  const code = row?.code ?? "";
  const pin = row?.pin ?? "";

  const themeId = custom.themeId ?? "amber";
  const bgId = custom.backgroundId ?? PLAIN_MOOD;

  async function apply(patch: { theme_color?: string | null; background_id?: string | null }, tag: string) {
    if (!session.canPersist) {
      toast.error("Only members can change the room.");
      return;
    }
    setBusy(tag);
    try {
      await updateRoom(session.roomId, patch);
      await qc.invalidateQueries({ queryKey: ["my-rooms"] });
      if (code) await qc.invalidateQueries({ queryKey: ["invite-card", code] });
      // Nudge the partner's open tab to refetch the new look.
      void session.channel.broadcast("customize", {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the room.");
    } finally {
      setBusy(null);
    }
  }

  function copy(value: string, key: "code" | "pin") {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  }

  const bgOptions = [
    { id: PLAIN_MOOD as string, label: "None" },
    ...AMBIANCE_PRESETS.map((p) => ({ id: p.id as string, label: p.label })),
  ];

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      {/* Invite info */}
      <section className="flex flex-col gap-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Invite
        </p>
        <div className="grid grid-cols-2 gap-2">
          <InfoField label="Room code" value={code} copied={copied === "code"} onCopy={() => copy(code, "code")} />
          <InfoField label="Passcode" value={pin} copied={copied === "pin"} onCopy={() => copy(pin, "pin")} />
        </div>
      </section>

      {/* Theme */}
      <section className="flex flex-col gap-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Accent {busy === "theme" && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {roomThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void apply({ theme_color: t.id }, "theme")}
              aria-label={t.label}
              title={t.label}
              className={cn(
                "h-9 w-9 rounded-full border-2 transition",
                themeId === t.id ? "scale-110 border-cream" : "border-white/15 hover:border-white/40",
              )}
              style={{ backgroundColor: t.accent }}
            />
          ))}
        </div>
      </section>

      {/* Background */}
      <section className="flex flex-col gap-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Background {busy === "bg" && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {bgOptions.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => void apply({ background_id: b.id }, "bg")}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm capitalize transition",
                bgId === b.id
                  ? "border-primary/50 bg-primary/[0.08] text-cream"
                  : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-cream",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      {!session.canPersist && (
        <p className="px-1 text-xs text-muted-foreground">Sign in as a member to change the room.</p>
      )}
    </div>
  );
}

function InfoField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">{label}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm text-cream">{value || "—"}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          className="shrink-0 text-muted-foreground transition hover:text-cream"
        >
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
