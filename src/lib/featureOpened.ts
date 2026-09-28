/**
 * Tell the server a feature was opened in a room, so the admin Features
 * page can see what people try and then abandon. Counts only, never
 * content. Once per room + feature per page load, fire-and-forget: a
 * failure here must never touch the room.
 */
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

const reported = new Set<string>();
const FEATURE = /^[a-z0-9_]{1,32}$/;

/** Pure: should this open be reported? Records it in `seen` when yes. */
export function claimReport(seen: Set<string>, roomId: string, feature: string): boolean {
  if (!roomId || !FEATURE.test(feature)) return false;
  const key = `${roomId}:${feature}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

export function reportFeatureOpened(roomId: string, feature: string, participantId?: string | null): void {
  if (!claimReport(reported, roomId, feature)) return;
  const q = participantId ? `?participant_id=${encodeURIComponent(participantId)}` : "";
  void api
    .post(`/v1/rooms/${encodeURIComponent(roomId)}/features/${feature}/opened${q}`)
    .catch(() => undefined);
}

/** Reports each tab the person switches to, skipping the one the room opens on. */
export function useReportTabOpened(roomId: string, tab: string, participantId?: string | null): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reportFeatureOpened(roomId, tab, participantId);
  }, [roomId, tab, participantId]);
}
