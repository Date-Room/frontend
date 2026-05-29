import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Share2, Loader2, Trash2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CardPage } from "@/components/CardPage";
import { cn } from "@/lib/utils";
import { listMyRooms, startRoom, deleteRoom, type Room } from "@/lib/rooms";

type CopiedKey = "room-id" | "pin" | "link" | null;

/** Tap-to-copy chip for a single value (Room ID or PIN). Shows a
 * checkmark for 2s after a successful copy. */
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
        "group rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-left transition",
        "hover:bg-white/[0.06] hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        copied && "border-emerald-400/40 bg-emerald-400/5",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-300" aria-hidden />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition" aria-hidden />
        )}
      </div>
      <p className="mt-1 font-serif text-2xl tracking-[0.3em] text-primary tabular-nums select-all">
        {value}
      </p>
    </button>
  );
}

/**
 * Host pre-room — mirrors mobile's `pre_room_screen.dart`: shows ROOM ID + PIN,
 * the invite link (PIN embedded), copy/share, and "Start session". Persistent
 * rooms also expose Destroy. (Live presence is a follow-up.)
 */
export default function PreRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  // Tracks which chip/button just flashed "Copied" — replaces the
  // toast spam we had when every copy fired sonner. Auto-clears 2s.
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 5_000,
  });
  const room: Room | undefined = rooms?.find((r) => r.id === id);

  const inviteUrl = room ? `${window.location.origin}/i/${room.code}/${room.pin}` : "";
  const inviteUrlDisplay = inviteUrl.replace(/^https?:\/\//, "");
  const live = room ? room.state === "live" || room.state === "active" : false;

  async function copyValue(value: string, key: Exclude<CopiedKey, null>) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Couldn't copy — long-press to select.");
    }
  }

  async function share() {
    if (!room) return;
    const msg = `${room.greeting_headline ? `${room.greeting_headline}\n\n` : ""}Join me on DateRoom: ${inviteUrl}\n\nRoom ID: ${room.code}   PIN: ${room.pin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DateRoom invite", text: msg });
        return;
      } catch {
        /* user cancelled / unsupported — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(msg).then(
      () => toast.success("Invite copied."),
      () => toast.error("Couldn't share."),
    );
  }

  async function start() {
    if (!room) return;
    setStarting(true);
    try {
      if (!live) await startRoom(room.id);
      const exp = room.expires_at ? `&expires_at=${encodeURIComponent(room.expires_at)}` : "";
      navigate(`/room/${room.id}?slot=a${exp}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the session.");
      setStarting(false);
    }
  }

  async function destroy() {
    if (!room) return;
    if (!window.confirm("Destroy this room? This permanently deletes it and everything in it.")) return;
    try {
      await deleteRoom(room.id);
      toast.success("Room destroyed.");
      navigate("/home");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not destroy the room.");
    }
  }

  if (isLoading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
      </PageShell>
    );
  }
  if (!room) {
    return (
      <PageShell className="flex flex-col items-center justify-center px-6 text-center">
        <p className="font-serif italic text-cream text-xl mb-3">Room not found</p>
        <button type="button" className="auth-mode-switch" onClick={() => navigate("/home")}>
          Back to home
        </button>
      </PageShell>
    );
  }

  return (
    <CardPage
      title={room.greeting_headline || "Your room"}
      onBack={() => navigate("/home")}
      maxWidth="sm:max-w-xl lg:max-w-2xl"
      bodyClassName="space-y-8 animate-float-up"
      headerRight={
        room.persistence === "persistent" ? (
          <button type="button" onClick={destroy} className="focus-ring text-destructive/70 hover:text-destructive transition" aria-label="Destroy room">
            <Trash2 className="w-4 h-4" />
          </button>
        ) : undefined
      }
    >
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Invite</p>
            <span className={room.persistence === "persistent" ? "pill-rose" : "pill-amber"}>
              {room.persistence === "persistent" ? "Perm" : "Temp"}
            </span>
          </div>
          <div className="rounded-[1.5rem] border border-primary/25 bg-primary/[0.06] p-5 space-y-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {/* Method A — Room ID + PIN. Tap either to copy. */}
            <div className="grid grid-cols-2 gap-3">
              <CodeCopyTile
                label="Room ID"
                value={room.code}
                copied={copiedKey === "room-id"}
                onCopy={() => void copyValue(room.code, "room-id")}
              />
              <CodeCopyTile
                label="PIN"
                value={room.pin}
                copied={copiedKey === "pin"}
                onCopy={() => void copyValue(room.pin, "pin")}
              />
            </div>

            {/* "or" rule — separates the two sharing methods. */}
            <div className="flex items-center gap-3" aria-hidden>
              <span className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">or</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>

            {/* Method B — invite link. Single tap to copy; URL shown below. */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyValue(inviteUrl, "link")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm text-cream hover:bg-white/5 transition",
                    copiedKey === "link" && "border-emerald-400/40 text-emerald-200",
                  )}
                >
                  {copiedKey === "link" ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden /> Link copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" aria-hidden /> Copy link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={share}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-amber text-primary-foreground py-2.5 text-sm font-medium hover:bg-amber/90 transition"
                >
                  <Share2 className="w-4 h-4" aria-hidden /> Share…
                </button>
              </div>
              <p className="text-[11px] text-primary/70 break-all font-mono leading-relaxed">
                {inviteUrlDisplay}
              </p>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-white/[0.08] bg-card/40 p-4 text-center text-sm text-muted-foreground">
          Share the link above. They'll join from it — then start the session whenever you're both ready.
        </div>

        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 rounded-[1.15rem] font-semibold disabled:opacity-50"
        >
          {starting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
          {live ? "Rejoin" : "Start session"}
        </button>
    </CardPage>
  );
}
