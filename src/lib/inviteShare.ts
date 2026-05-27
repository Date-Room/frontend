import { BRAND_NAME } from "@/lib/constants";

/** Display invite ID like Zoom meeting IDs (spaced groups for easy reading). */
export function formatMeetingIdDisplay(inviteId: string): string {
  const raw = inviteId.replace(/-/g, "").toUpperCase();
  const chunks = raw.match(/.{1,4}/g);
  return chunks ? chunks.join(" ") : raw;
}

/** Plain-text block similar to Zoom “copy invitation”. */
export function buildInvitationShareText(opts: {
  recipientFirstName: string;
  shareLink: string;
  meetingIdFormatted: string;
}): string {
  const who = opts.recipientFirstName.trim() || "your guest";
  return [
    `${BRAND_NAME} — invitation`,
    "",
    `${who}, you're invited.`,
    "",
    `Join link:`,
    opts.shareLink,
    "",
    `Meeting ID:`,
    opts.meetingIdFormatted,
    "",
    "Open the link on any device to enter the lobby.",
  ].join("\n");
}
