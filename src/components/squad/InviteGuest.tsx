/**
 * "Invite a guest" for whoever runs the squad: a one-person link for one
 * night, so a friend can come along without joining. The host says who
 * pays for the guest's seat: the squad (a seat from its nights) or the
 * guest. Lists the links still open, to copy again or cancel. Hidden while
 * guests are switched off on the server (it answers 404).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Share2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  createGuestInvite,
  guestLinkUrl,
  listGuestInvites,
  revokeGuestInvite,
  type GuestInvite,
  type GuestPays,
} from "@/lib/squadGuests";
import { squadErrorCode } from "@/lib/squad";
import { cn } from "@/lib/utils";

export function InviteGuest({ roomId, canRun }: { roomId: string; canRun: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pays, setPays] = useState<GuestPays>("squad");
  const [made, setMade] = useState<GuestInvite | null>(null);
  const links = useQuery({
    queryKey: ["guest-invites", roomId],
    queryFn: () => listGuestInvites(roomId),
    enabled: canRun,
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => createGuestInvite(roomId, pays),
    onSuccess: (inv) => {
      setMade(inv);
      void qc.invalidateQueries({ queryKey: ["guest-invites", roomId] });
    },
    onError: (e) =>
      toast.error(
        squadErrorCode(e) === "no_nights_left"
          ? "The squad has no seats to give right now. Top up, or let them pay."
          : "Couldn't make the link. Try again.",
      ),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeGuestInvite(roomId, id),
    onSuccess: () => {
      toast.success("Link cancelled.");
      void qc.invalidateQueries({ queryKey: ["guest-invites", roomId] });
    },
  });

  // Guests switched off on the server, or not someone who runs the squad.
  const off = links.error instanceof ApiError && links.error.status === 404;
  if (!canRun || off || links.isLoading) return null;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.message(url);
    }
  };
  const share = async (url: string) => {
    if (navigator.share) {
      await navigator.share({ title: "Join us tonight", url }).catch(() => {});
    } else {
      await copy(url);
    }
  };

  const option = (id: GuestPays, title: string, sub: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={pays === id}
      onClick={() => setPays(id)}
      className={cn(
        "focus-ring w-full rounded-xl border px-4 py-3 text-left transition",
        pays === id ? "border-primary/50 bg-primary/10" : "border-white/[0.1] hover:border-primary/30",
      )}
    >
      <span className="block text-sm font-semibold text-cream">{title}</span>
      <span className="block text-xs text-muted-foreground">{sub}</span>
    </button>
  );

  const openLinks = links.data?.invites ?? [];

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMade(null);
          }}
          className="focus-ring flex w-full items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-3 text-left text-sm text-cream hover:bg-white/[0.04]"
        >
          <UserPlus className="h-4 w-4 text-primary" aria-hidden />
          <span className="flex-1">
            Invite a guest
            <span className="block text-xs text-muted-foreground">Someone for one night, without joining the squad.</span>
          </span>
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-white/[0.1] p-3">
          <div className="flex items-center">
            <p className="flex-1 text-sm font-semibold text-cream">Invite a guest for one night</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-cream">
              <X className="h-4 w-4" />
            </button>
          </div>
          {made ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Send this to one person. It works for 48 hours, for one night.
              </p>
              <p className="truncate rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-cream">{guestLinkUrl(made.token)}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void share(guestLinkUrl(made.token))}
                  className="btn-primary focus-ring flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold"
                >
                  <Share2 className="h-4 w-4" aria-hidden /> Share
                </button>
                <button
                  type="button"
                  onClick={() => void copy(guestLinkUrl(made.token))}
                  className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.16] py-2.5 text-sm text-cream"
                >
                  <Copy className="h-4 w-4" aria-hidden /> Copy
                </button>
              </div>
            </div>
          ) : (
            <>
              <div role="radiogroup" aria-label="Who pays for their seat" className="space-y-2">
                {option("squad", "On the squad", "Their seat comes from the squad's nights.")}
                {option("self", "They pay", "They'll pay for their own seat when they join.")}
              </div>
              <button
                type="button"
                onClick={() => create.mutate()}
                disabled={create.isPending}
                className="btn-primary focus-ring flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Make the link
              </button>
            </>
          )}
        </div>
      )}
      {openLinks.length > 0 && (
        <ul className="space-y-1.5">
          {openLinks.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
              <span className="flex-1">
                Guest link · {l.pays === "squad" ? "on the squad" : "they pay"} · {l.used ? "used" : "not used yet"}
              </span>
              {!l.used && (
                <button type="button" onClick={() => void copy(guestLinkUrl(l.token))} className="text-primary hover:underline">
                  Copy
                </button>
              )}
              <button
                type="button"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(l.id)}
                className="text-rose-300 hover:underline disabled:opacity-40"
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
