/**
 * Chaperon context — one live session per room, shared by the overlay and the
 * setup sheet. Renders nothing when the server flag is off (zero footprint for
 * launch users). Reads room identity from RoomSessionContext.
 */
import { createContext, useContext, type ReactNode } from "react";
import { useChaperon } from "@/hooks/useChaperon";
import { useRoomSession } from "@/context/RoomSessionContext";

type ChaperonController = ReturnType<typeof useChaperon> & { enabled: boolean };

const Ctx = createContext<ChaperonController | null>(null);

export function ChaperonProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const session = useRoomSession();
  const controller = useChaperon({
    roomId: session.roomId,
    participantId: session.participantId,
    enabled,
  });
  return <Ctx.Provider value={{ ...controller, enabled }}>{children}</Ctx.Provider>;
}

/** Null outside a provider (or when the feature is off) so callers no-op. */
export function useChaperonController(): ChaperonController | null {
  return useContext(Ctx);
}
