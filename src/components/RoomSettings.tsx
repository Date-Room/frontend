import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useRoomCustomization } from "@/context/RoomCustomizationContext";
import { listMyRooms, updateRoom } from "@/lib/rooms";
import { AMBIANCE_PRESETS, PLAIN_MOOD } from "@/lib/ambiance";
import { cn } from "@/lib/utils";

type CopiedKey = "code" | "pin" | "link" | null;

/**
 * Room info + customization, mounted on the stage from the Room menu. Shows the
 * invite the same way the pre-room screen does (ID + PIN copy tiles, a copy-link
 * and a share button) and lets members change the background preset — which
 * already carries the accent. Changes persist and broadcast so the partner
 * updates live.
 */
export function RoomSettings() {
  const session = useRoomSession();
  const custom = useRoomCustomization();
  const qc = useQueryClient();
  const [copied, setCopied] = useState<CopiedKey>(null);
  const [busy, setBusy] = useState(false);

  const { data: rooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    enabled: session.canPersist,
  });
  const row = rooms?.find((r) => r.id === session.roomId);
  const code = row?.code ?? "";
  const pin = row?.pin ?? "";
  const inviteUrl = row
    ? `${window.location.origin}/i/${code}/${pin}${row.recap_invite_token ? `#k=${row.recap_invite_token}` : ""}`
    : "";

  const bgId = custom.backgroundId ?? PLAIN_MOOD;
  const bgOptions = [
    { id: PLAIN_MOOD as string, label: "None" },
    ...AMBIANCE_PRESETS.map((p) => ({ id: p.id as string, label: p.label })),
  ];

  async function copy(value: string, key: Exclude<CopiedKey, null>) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Couldn't copy — long-press to select.");
    }
  }

  async function share() {
    if (!inviteUrl) return;
    const msg = `Join me on DateRoom: ${inviteUrl}\n\nRoom ID: ${code}   PIN: ${pin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DateRoom invite", text: msg });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(msg).then(
      () => toast.success("Invite copied."),
      () => toast.error("Couldn't share."),
    );
  }

  async function pickBackground(id: string) {
    if (!session.canPersist) {
      toast.error("Only members can change the room.");
      return;
    }
    setBusy(true);
    try {
      await updateRoom(session.roomId, { background_id: id });
      await qc.invalidateQueries({ queryKey: ["my-rooms"] });
      if (code) await qc.invalidateQueries({ queryKey: ["invite-card", code] });
      void session.channel.broadcast("customize", {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      {/* Invite — mirrors the pre-room share block. */}
      <section className="flex flex-col gap-3">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Invite
        </p>
        <div className="grid grid-cols-2 gap-3">
          <CodeCopyTile label="Room ID" value={code} copied={copied === "code"} onCopy={() => copy(code, "code")} />
          <CodeCopyTile label="Passcode (PIN)" value={pin} copied={copied === "pin"} onCopy={() => copy(pin, "pin")} />
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => copy(inviteUrl, "link")}
            disabled={!inviteUrl}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.02] py-2.5 text-xs font-medium text-cream transition hover:bg-white/5 disabled:opacity-50",
              copied === "link" && "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
            )}
          >
            {copied === "link" ? (
              <>
                <Check className="h-3.5 w-3.5" /> Link copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy invite link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={share}
            disabled={!inviteUrl}
            className="flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--room-accent)" }}
          >
            <Share2 className="h-3.5 w-3.5" /> Invite partner…
          </button>
        </div>
      </section>

      {/* Background — the chosen preset also sets the room accent. */}
      <section className="flex flex-col gap-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Background {busy && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {bgOptions.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => void pickBackground(b.id)}
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

function CodeCopyTile({
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
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      className={cn(
        "group rounded-2xl border border-primary/20 bg-black/25 px-4 py-2 text-left transition hover:border-primary/40 hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        copied && "border-emerald-400/40 bg-emerald-400/5",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-300" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground/70" />
        )}
      </div>
      <p className="select-all text-lg font-semibold tracking-wider text-primary tabular-nums">{value || "—"}</p>
    </button>
  );
}
