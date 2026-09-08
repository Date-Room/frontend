/**
 * The partner's first name from room presence, for game copy ("Kiki's
 * order", "You think Kiki cut…"). Falls back to "Them" when the partner
 * hasn't joined or published a name.
 */
import { useMemo } from "react";
import { useRoomSession } from "@/context/RoomSessionContext";

export function usePartnerName(): string {
  const room = useRoomSession();
  return useMemo(() => {
    const p = room.presence.find((x) => (x.sender_id as string | undefined) !== room.senderId);
    const raw = typeof p?.name === "string" ? p.name.trim() : "";
    const first = raw.split(/\s+/)[0] ?? "";
    return first ? first.slice(0, 12) : "Them";
  }, [room.presence, room.senderId]);
}
