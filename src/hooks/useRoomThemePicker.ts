import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useRoomCustomization } from "@/context/RoomCustomizationContext";
import { listMyRooms, updateRoom } from "@/lib/rooms";
import { backgroundMoodLabel } from "@/lib/roomAmbiance";
import type { LobbyMood } from "@/lib/ambiance";

/** Opens the ambiance sheet and persists background changes for live-room members. */
export function useRoomThemePicker() {
  const session = useRoomSession();
  const custom = useRoomCustomization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: rooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: listMyRooms,
    enabled: session.canPersist,
  });
  const code = rooms?.find((r) => r.id === session.roomId)?.code;

  async function pick(id: LobbyMood) {
    if (!session.canPersist) {
      toast.error("Only members can change the room theme.");
      return;
    }
    setBusy(true);
    try {
      await updateRoom(session.roomId, { background_id: id });
      await qc.invalidateQueries({ queryKey: ["my-rooms"] });
      if (code) await qc.invalidateQueries({ queryKey: ["invite-card", code] });
      void session.channel.broadcast("customize", {
        background_id: id,
        from: session.senderId,
        by: session.displayName,
      });
      toast.success(`Room set to ${backgroundMoodLabel(id)}.`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the theme.");
    } finally {
      setBusy(false);
    }
  }

  return {
    current: custom.ambiancePreset,
    open,
    setOpen,
    pick,
    busy,
    canChange: session.canPersist,
  };
}
