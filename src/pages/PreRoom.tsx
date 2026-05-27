import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Share2, Loader2, Trash2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CardPage } from "@/components/CardPage";
import { listMyRooms, startRoom, deleteRoom, type Room } from "@/lib/rooms";

/**
 * Host pre-room — mirrors mobile's `pre_room_screen.dart`: shows ROOM ID + PIN,
 * the invite link (PIN embedded), copy/share, and "Start session". Persistent
 * rooms also expose Destroy. (Live presence is a follow-up.)
 */
export default function PreRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    staleTime: 5_000,
  });
  const room: Room | undefined = rooms?.find((r) => r.id === id);

  const inviteUrl = room ? `${window.location.origin}/i/${room.code}/${room.pin}` : "";
  const live = room ? room.state === "live" || room.state === "active" : false;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied.");
    } catch {
      toast.error("Couldn't copy — long-press the link to copy.");
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
      maxWidth="sm:max-w-xl"
      bodyClassName="space-y-8"
      headerRight={
        room.persistence === "persistent" ? (
          <button type="button" onClick={destroy} className="text-destructive/70 hover:text-destructive transition" aria-label="Destroy room">
            <Trash2 className="w-4 h-4" />
          </button>
        ) : undefined
      }
    >
        <section className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Invite</p>
          <div className="rounded-[1.5rem] border border-primary/25 bg-primary/[0.06] p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Room ID</p>
                <p className="font-serif text-2xl tracking-[0.3em] text-primary tabular-nums">{room.code}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">PIN</p>
                <p className="font-serif text-2xl tracking-[0.3em] text-primary tabular-nums">{room.pin}</p>
              </div>
            </div>
            <p className="text-xs text-primary/80 break-all">{inviteUrl}</p>
            <div className="flex gap-2">
              <button type="button" onClick={copyLink} className="flex-1 flex items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm text-cream hover:bg-white/5 transition">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button type="button" onClick={share} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-amber text-primary-foreground py-2.5 text-sm font-medium hover:bg-amber/90 transition">
                <Share2 className="w-4 h-4" /> Share
              </button>
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
