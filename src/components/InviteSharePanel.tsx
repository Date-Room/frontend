import { useCallback, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildInvitationShareText, formatMeetingIdDisplay } from "@/lib/inviteShare";

type CopiedKey = "link" | "meetingId" | "invite" | null;

type InviteSharePanelProps = {
  recipientName: string;
  shareLink: string;
  guestInviteId: string;
  className?: string;
};

/** Zoom-style outline copy control */
function ZoomCopyButton({
  copied,
  label,
  compactLabel,
  onClick,
}: {
  copied: boolean;
  label: string;
  compactLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/60 px-3 py-2",
        "text-xs font-semibold text-foreground shadow-sm transition-colors",
        "hover:bg-secondary hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden />
          <span className="hidden sm:inline">Copied</span>
          <span className="sm:hidden">Done</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 opacity-70" aria-hidden />
          <span>{compactLabel ?? "Copy"}</span>
        </>
      )}
    </button>
  );
}

export function InviteSharePanel({ recipientName, shareLink, guestInviteId, className }: InviteSharePanelProps) {
  const meetingIdFormatted = formatMeetingIdDisplay(guestInviteId);
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);

  const flashCopied = useCallback((key: Exclude<CopiedKey, null>) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2200);
  }, []);

  async function copyText(text: string, key: Exclude<CopiedKey, null>) {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(key);
    } catch {
      toast.error("Could not copy — try selecting the text manually.");
    }
  }

  const meetingIdPaste = guestInviteId.replace(/-/g, "").toUpperCase();

  const invitationBody = buildInvitationShareText({
    recipientFirstName: recipientName,
    shareLink,
    meetingIdFormatted,
  });

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-[0_12px_40px_rgba(0,0,0,0.35)] overflow-hidden text-left",
        className,
      )}
      role="region"
      aria-label="Meeting invitation details"
    >
      {/* Zoom-like modal header */}
      <div className="border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Share meeting info</h3>
        <p className="text-[13px] text-muted-foreground mt-1 leading-snug">
          Send the invitation link or meeting ID — same layout as Zoom. Your guest opens it to reach the lobby.
        </p>
      </div>

      <div className="divide-y divide-border">
        {/* Invitation link row */}
        <div className="px-4 py-4 sm:px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 flex gap-3">
            <div className="mt-0.5 hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
              <Link2 className="w-4 h-4 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-[13px] font-semibold text-foreground">Invitation link</p>
              <p className="text-[13px] font-mono text-muted-foreground break-all leading-relaxed">{shareLink}</p>
            </div>
          </div>
          <ZoomCopyButton
            copied={copiedKey === "link"}
            label="Copy invitation link"
            compactLabel="Copy link"
            onClick={() => void copyText(shareLink, "link")}
          />
        </div>

        {/* Meeting ID row */}
        <div className="px-4 py-4 sm:px-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[13px] font-semibold text-foreground">Meeting ID</p>
            <p
              className="text-xl sm:text-2xl font-semibold tracking-[0.2em] font-mono tabular-nums text-foreground select-all"
              translate="no"
            >
              {meetingIdFormatted}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              Path: /i/{guestInviteId}
            </p>
          </div>
          <ZoomCopyButton
            copied={copiedKey === "meetingId"}
            label="Copy meeting ID"
            compactLabel="Copy ID"
            onClick={() => void copyText(meetingIdPaste, "meetingId")}
          />
        </div>
      </div>

      {/* Primary action — Zoom “Copy invitation” */}
      <div className="border-t border-border bg-muted/25 px-4 py-4 sm:px-5 space-y-2">
        <button
          type="button"
          onClick={() => void copyText(invitationBody, "invite")}
          className={cn(
            "w-full rounded-lg py-3 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2",
            "bg-primary text-primary-foreground hover:opacity-[0.96] shadow-[0_4px_24px_rgba(232,166,83,0.28)]",
          )}
        >
          {copiedKey === "invite" ? (
            <>
              <Check className="w-4 h-4" aria-hidden /> Invitation copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 opacity-90" aria-hidden /> Copy invitation
            </>
          )}
        </button>
        <p className="text-[11px] text-center text-muted-foreground leading-relaxed px-1">
          Includes join link and meeting ID — ready to paste into Messages, email, or Calendar.
        </p>
      </div>
    </div>
  );
}
