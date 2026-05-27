import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConnectionIntent } from "@/lib/connectionDeepening";
import { getConnectionIntentRows } from "@/lib/connectionDeepening";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: ConnectionIntent | null | undefined;
  onPick: (id: ConnectionIntent) => void | Promise<void>;
  busy?: boolean;
  title?: string;
};

export function ConnectionIntentDialog({
  open,
  onOpenChange,
  selectedId,
  onPick,
  busy,
  title = "Tonight we're leaning toward…",
}: Props) {
  async function handlePick(id: ConnectionIntent) {
    await Promise.resolve(onPick(id));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl border-border bg-card shadow-2xl sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif text-xl italic text-cream">{title}</DialogTitle>
          <p className="text-sm font-normal text-muted-foreground leading-relaxed pt-1">
            This tunes the deepening hints in Questions (not lighting). Anyone in the room can change it anytime.
          </p>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {getConnectionIntentRows().map((row) => {
            const sel = row.id === selectedId;
            return (
              <button
                key={row.id}
                type="button"
                disabled={busy}
                onClick={() => void handlePick(row.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  sel
                    ? "border-primary/50 bg-primary/15 ring-1 ring-primary/25"
                    : "border-white/10 bg-secondary/40 hover:bg-secondary/65 hover:border-primary/35"
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {row.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-cream">{row.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">{row.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end pt-1">
          <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
