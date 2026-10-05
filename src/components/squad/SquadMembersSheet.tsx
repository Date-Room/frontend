/**
 * The squad sheet: who's in, where they are, and the room's door. No
 * voting: anyone can leave or lock the room; the owner and co-hosts
 * remove people (quietly, for good) and make a new link; only the owner
 * picks co-hosts. The owner leaving hands the room over (server side).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Lock, Mail, MapPin, MoreHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { rotateRoomPin, type Room } from "@/lib/rooms";
import {
  browserTimeZone,
  leaveSquad,
  lockSquad,
  removeSquadMember,
  setSquadCohost,
  setSquadNightEmails,
  setSquadWhere,
  squadErrorText,
  squadInviteUrl,
  type SquadMember,
  type SquadMembers,
} from "@/lib/squad";
import { cn } from "@/lib/utils";

/** Pure: what the viewer may do to someone else in the list. */
export function memberActions(
  target: SquadMember,
  myRole: SquadMembers["my_role"],
): { cohost: boolean; remove: boolean } {
  if (target.role === "owner") return { cohost: false, remove: false };
  return {
    cohost: myRole === "owner",
    remove: myRole === "owner" || (myRole === "cohost" && target.role === "member"),
  };
}

export function SquadMembersSheet({
  room,
  members,
  selfUserId,
  hereIds,
}: {
  room: Room | undefined;
  members: SquadMembers | undefined;
  selfUserId: string | null;
  hereIds: Set<string>;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roomId = room?.id ?? "";
  const list = members?.members ?? [];
  const me = list.find((m) => m.user_id === selfUserId) ?? null;
  const myRole = members?.my_role ?? "member";
  const canManage = myRole === "owner" || myRole === "cohost";
  const invite = room ? squadInviteUrl(room.code, room.pin) : null;
  const locked = Boolean(members?.locked_until);

  const [city, setCity] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SquadMember | null>(null);
  const [leaving, setLeaving] = useState(false);

  const setMembers = (m: SquadMembers) => qc.setQueryData(["squad-members", roomId], m);
  const refreshMembers = () => void qc.invalidateQueries({ queryKey: ["squad-members", roomId] });
  const fail = (fallback: string) => (e: unknown) => toast.error(squadErrorText(e, fallback));

  const where = useMutation({
    mutationFn: () => setSquadWhere(roomId, { city: (city ?? "").trim() || null, tz: browserTimeZone() }),
    onSuccess: () => {
      toast.success("Saved. The squad sees your city and your clock.");
      setCity(null);
      refreshMembers();
      void qc.invalidateQueries({ queryKey: ["squad-plan", roomId] });
    },
    onError: fail("That didn't save."),
  });
  const cohost = useMutation({
    mutationFn: (v: { pid: string; on: boolean }) => setSquadCohost(roomId, v.pid, v.on),
    onSuccess: setMembers,
    onError: fail("That didn't work."),
  });
  const remove = useMutation({
    mutationFn: (pid: string) => removeSquadMember(roomId, pid),
    onSuccess: () => {
      toast.success("Removed. They won't be told.");
      refreshMembers();
    },
    onError: fail("They couldn't be removed."),
  });
  const lock = useMutation({
    mutationFn: (on: boolean) => lockSquad(roomId, on),
    onSuccess: (m) => {
      setMembers(m);
      toast.success(m.locked_until ? "Locked. No one new can join for now." : "Unlocked.");
    },
    onError: fail("That didn't work."),
  });
  const nightEmails = members?.my_night_emails ?? true;
  const emails = useMutation({
    mutationFn: (on: boolean) => setSquadNightEmails(roomId, on),
    onSuccess: (_, on) => {
      qc.setQueryData<SquadMembers>(["squad-members", roomId], (m) => (m ? { ...m, my_night_emails: on } : m));
      toast.success(on ? "We'll email you about nights." : "No more night emails from this squad.");
    },
    onError: fail("That didn't save."),
  });
  const newLink = useMutation({
    mutationFn: () => rotateRoomPin(roomId),
    onSuccess: (r) => {
      qc.setQueryData<Room[]>(["my-rooms"], (rooms) => rooms?.map((x) => (x.id === r.id ? r : x)));
      void navigator.clipboard?.writeText(squadInviteUrl(r.code, r.pin));
      toast.success("New link copied. The old one doesn't work anymore.");
    },
    onError: fail("A new link couldn't be made."),
  });
  const leave = useMutation({
    mutationFn: () => leaveSquad(roomId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-rooms"] });
      toast.success("You've left the squad.");
      navigate("/home", { replace: true });
    },
    onError: fail("You couldn't leave just now."),
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-sm text-cream hover:bg-white/[0.06]"
        >
          <Users className="h-3.5 w-3.5" aria-hidden /> Squad · {list.length}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl text-cream">Your squad</SheetTitle>
          <SheetDescription>
            Anyone with the link can join. Seats only cap who's on camera on a night.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-7">
          <ul className="space-y-2">
            {list.map((m) => {
              const acts = m.user_id === selfUserId ? null : memberActions(m, myRole);
              const here = m.user_id ? hereIds.has(m.user_id) : false;
              return (
                <li key={m.participant_id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-cream">
                    {(m.display_name || "?").charAt(0).toUpperCase()}
                    {here && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-400"
                        aria-label="Here now"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-cream">
                    <span className="block truncate">
                      {m.display_name}
                      {m.user_id === selfUserId && <span className="text-muted-foreground"> (you)</span>}
                    </span>
                    {m.city && <span className="block truncate text-xs text-muted-foreground">{m.city}</span>}
                  </span>
                  {m.role !== "member" && (
                    <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {m.role === "cohost" ? "Co-host" : "Owner"}
                    </span>
                  )}
                  {m.new && <span className="text-[11px] text-muted-foreground">New</span>}
                  {acts && (acts.cohost || acts.remove) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Options for ${m.display_name}`}
                          className="focus-ring rounded-full p-1.5 text-muted-foreground hover:text-cream"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {acts.cohost && (
                          <DropdownMenuItem
                            onSelect={() => cohost.mutate({ pid: m.participant_id, on: m.role !== "cohost" })}
                          >
                            {m.role === "cohost" ? "Stop being co-host" : "Make co-host"}
                          </DropdownMenuItem>
                        )}
                        {acts.remove && (
                          <DropdownMenuItem className="text-rose-300" onSelect={() => setRemoving(m)}>
                            Remove from the squad
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>

          <section className="space-y-2">
            <label htmlFor="squad-city" className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden /> Where are you?
            </label>
            <div className="flex gap-2">
              <input
                id="squad-city"
                type="text"
                maxLength={80}
                value={city ?? me?.city ?? ""}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Nairobi"
                className="auth-input focus-ring flex-1"
              />
              <button
                type="button"
                disabled={where.isPending || city === null}
                onClick={() => where.mutate()}
                className="btn-primary focus-ring rounded-full px-4 text-sm font-semibold disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your city shows on your face, and planned times show in your clock for everyone.
            </p>
          </section>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-3 text-sm text-cream">
            <Mail className="h-4 w-4 text-primary" aria-hidden />
            <span className="flex-1">
              Email me about nights
              <span className="block text-xs text-muted-foreground">
                When a time is set, 15 minutes before, and if a night starts without you.
              </span>
            </span>
            <Switch
              checked={nightEmails}
              disabled={emails.isPending}
              onCheckedChange={(on) => emails.mutate(on)}
              aria-label="Email me about nights"
            />
          </label>

          <section className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">The door</p>
            {invite && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(invite);
                  toast.success("Link copied. Anyone with it can join the squad.");
                }}
                className="focus-ring flex w-full items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-3 text-sm text-cream hover:bg-white/[0.04]"
              >
                <Copy className="h-4 w-4 text-primary" aria-hidden /> Copy the invite link
              </button>
            )}
            {canManage && (
              <button
                type="button"
                disabled={newLink.isPending}
                onClick={() => newLink.mutate()}
                className="focus-ring flex w-full items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-3 text-left text-sm text-cream hover:bg-white/[0.04] disabled:opacity-40"
              >
                <Link2 className="h-4 w-4 text-primary" aria-hidden />
                <span className="flex-1">
                  Make a new link
                  <span className="block text-xs text-muted-foreground">The old link stops working.</span>
                </span>
              </button>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-3 text-sm text-cream">
              <Lock className="h-4 w-4 text-primary" aria-hidden />
              <span className="flex-1">
                Lock the room
                <span className="block text-xs text-muted-foreground">
                  {locked && members?.locked_until
                    ? `No one new can join until ${new Date(members.locked_until).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`
                    : "No one new can join until the night ends (or for 12 hours)."}
                </span>
              </span>
              <Switch checked={locked} disabled={lock.isPending} onCheckedChange={(on) => lock.mutate(on)} />
            </label>
          </section>

          <button
            type="button"
            onClick={() => setLeaving(true)}
            className={cn("focus-ring w-full rounded-full border border-rose-400/30 py-3 text-sm text-rose-300 hover:bg-rose-400/10")}
          >
            Leave the squad
          </button>
        </div>
      </SheetContent>

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They leave the squad and can't come back with the link. They won't be told.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove.mutate(removing.participant_id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the squad?</AlertDialogTitle>
            <AlertDialogDescription>
              {myRole === "owner"
                ? "The room and its nights stay with the squad. A co-host takes over, or whoever's been here longest."
                : "The room and its nights stay with the squad. You can rejoin with the link unless you were removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => leave.mutate()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
