import { createContext, useContext } from "react";

/**
 * FaceTime-style chrome auto-hide.
 *
 * Top header pills, the bottom glass control island, the desktop
 * presence strip and the quick-launch chips all share the same
 * visibility flag so they fade together on mouse-still, fade back on
 * movement. Driven by `LiveRoom` and consumed inside the LiveKitRoom
 * subtree (where `RoomVideo` lives) without prop-drilling through
 * LiveKit's own context.
 *
 * Default `true` — if no provider mounts, chrome is always visible
 * (matches the old behaviour). The activity tray ignores the flag —
 * once the user has opened an activity they're past the "atmospheric"
 * stage and need durable controls.
 */
export const ChromeVisibilityContext = createContext<boolean>(true);

export function useChromeVisible(): boolean {
  return useContext(ChromeVisibilityContext);
}
