import i18n from "@/i18n/config";
import type { PresenceState } from "@/lib/realtime/roomChannel";

export function presenceSenderId(p: PresenceState): string {
  return String(
    (typeof p.user_id === "string" && p.user_id) ||
      (typeof p.sender_id === "string" && p.sender_id) ||
      "",
  );
}

export function partnerPresenceEntry(
  presence: PresenceState[],
  viewerId: string,
): PresenceState | undefined {
  return presence.find((p) => {
    const sid = presenceSenderId(p);
    return Boolean(sid) && sid !== viewerId;
  });
}

export function partnerDisplayName(entry: PresenceState | undefined): string {
  if (!entry) return i18n.t("room.yourPartner");
  const raw = entry.display_name ?? entry.name;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return i18n.t("room.yourPartner");
}

export function partnerLightLabel(entry: PresenceState | undefined): string {
  if (!entry) return i18n.t("room.partnerNotInYet");
  if (entry.is_in_call === true) return i18n.t("room.partnerInRoomNow");
  const last = entry.last_seen;
  if (typeof last === "string") {
    const diff = Date.now() - new Date(last).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return i18n.t("room.partnerLightOnNow");
    if (m < 60) return i18n.t("room.partnerLightWasOn", { time: i18n.t("room.minutesAgo", { count: m }) });
    const h = Math.floor(m / 60);
    if (h < 24) return i18n.t("room.partnerLightWasOn", { time: i18n.t("room.hoursAgo", { count: h }) });
    const d = Math.floor(h / 24);
    return i18n.t("room.partnerLightWasOn", { time: i18n.t("room.daysAgo", { count: d }) });
  }
  return i18n.t("room.partnerNearby");
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return i18n.t("room.justNow");
  if (m < 60) return i18n.t("room.minutesAgo", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t("room.hoursAgo", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return i18n.t("room.daysAgo", { count: d });
  return new Date(iso).toLocaleDateString(i18n.language);
}
