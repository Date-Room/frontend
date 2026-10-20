/**
 * For whoever runs the squad (owner, co-hosts, or everyone when the room
 * says so): new people waiting to be let in. Approval is once per person,
 * for good.
 *
 * - <JoinRequestsCard>: on the squad page, everyone waiting, with Let in /
 *   Not now each and "Let everyone in".
 * - <JoinRequestsAlert>: during a call, a toast when someone asks, with
 *   "Let in" right there.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRoomSession } from "@/context/RoomSessionContext";
import {
  JOIN_REQUESTED,
  approveAllJoins,
  approveJoin,
  canRunSquad,
  declineJoin,
  getJoinRequests,
  getSquadMembers,
  joinAskLine,
  squadErrorText,
} from "@/lib/squad";

function useJoinRequests(roomId: string) {
  const members = useQuery({ queryKey: ["squad-members", roomId], queryFn: () => getSquadMembers(roomId) });
  // Asking only makes sense while the server asks for approval at all.
  const manager = canRunSquad(members.data) && Boolean(members.data?.approval_needed);
  const asks = useQuery({
    queryKey: ["join-requests", roomId],
    queryFn: () => getJoinRequests(roomId),
    enabled: manager,
    refetchInterval: 30_000,
  });
  return { manager, asks };
}

export function JoinRequestsCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const { channel } = useRoomSession();
  const { manager, asks } = useJoinRequests(roomId);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["join-requests", roomId] });
    void qc.invalidateQueries({ queryKey: ["squad-members", roomId] });
  };
  useEffect(() => {
    if (!manager) return;
    return channel.onBroadcast((e) => {
      if (e.kind === JOIN_REQUESTED) void qc.invalidateQueries({ queryKey: ["join-requests", roomId] });
    });
  }, [manager, channel, qc, roomId]);

  const decide = useMutation({
    mutationFn: (v: { id: string | null; approve: boolean }) =>
      v.id === null ? approveAllJoins(roomId) : v.approve ? approveJoin(roomId, v.id) : declineJoin(roomId, v.id),
    onSuccess: (r, v) => {
      const n = r.requests.length;
      toast.success(
        v.id === null
          ? `Let ${n} ${n === 1 ? "person" : "people"} in.`
          : v.approve
            ? `${(r.requests[0]?.display_name || "They").split(" ")[0]} can come in now.`
            : "Not this time.",
      );
      refresh();
    },
    onError: (e) => {
      toast.error(squadErrorText(e, "That didn't go through. Try again."));
      refresh();
    },
  });

  const reqs = asks.data?.requests ?? [];
  if (!manager || reqs.length === 0) return null;

  return (
    <section className="editorial-card space-y-4 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <UserPlus className="h-4 w-4" aria-hidden /> {joinAskLine(reqs)}
      </div>
      <ul className="space-y-2">
        {reqs.map((r) => {
          const first = (r.display_name || "Someone").split(" ")[0];
          const pending = decide.isPending && decide.variables?.id === r.id;
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5">
              {r.photo_url ? (
                <img src={r.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25 text-sm font-bold text-cream">
                  {first.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-cream">{r.display_name}</span>
              {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: r.id, approve: false })}
                className="focus-ring rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-cream disabled:opacity-40"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: r.id, approve: true })}
                aria-label={`Let ${first} in`}
                className="btn-primary focus-ring rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Let in
              </button>
            </li>
          );
        })}
      </ul>
      {reqs.length > 1 && (
        <button
          type="button"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: null, approve: true })}
          className="focus-ring w-full rounded-full border border-white/[0.16] py-2.5 text-sm text-cream hover:bg-white/[0.05] disabled:opacity-40"
        >
          Let everyone in
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        Once they're in, they're in for good. Until then they only see the squad's name and who's in it.
      </p>
    </section>
  );
}

/** During a call: a toast the moment someone asks, with "Let in". */
export function JoinRequestsAlert({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const { channel } = useRoomSession();
  const { manager } = useJoinRequests(roomId);
  useEffect(() => {
    if (!manager) return;
    return channel.onBroadcast((e) => {
      if (e.kind !== JOIN_REQUESTED) return;
      const id = typeof e.payload.id === "string" ? e.payload.id : null;
      const name = typeof e.payload.name === "string" ? e.payload.name : "Someone";
      if (!id) return;
      void qc.invalidateQueries({ queryKey: ["join-requests", roomId] });
      toast.message(joinAskLine([{ display_name: name }]), {
        duration: 15_000,
        action: {
          label: "Let in",
          onClick: () =>
            void approveJoin(roomId, id)
              .then(() => {
                toast.success(`${name.split(" ")[0]} can come in now.`);
                void qc.invalidateQueries({ queryKey: ["join-requests", roomId] });
              })
              .catch((err) => toast.error(squadErrorText(err, "That didn't go through."))),
        },
      });
    });
  }, [manager, channel, qc, roomId]);
  return null;
}
