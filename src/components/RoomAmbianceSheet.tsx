import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AMBIANCE_PRESETS, type AmbiancePresetId } from "@/lib/ambiance";
import { cn } from "@/lib/utils";

export function RoomAmbianceSheet({
  open,
  onOpenChange,
  current,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: AmbiancePresetId;
  onPick: (id: AmbiancePresetId) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border pb-8">
        <SheetHeader>
          <SheetTitle className="font-serif text-cream">Set the mood</SheetTitle>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AMBIANCE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p.id);
                onOpenChange(false);
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 transition hover:border-rosegold/40",
                current === p.id
                  ? "border-rosegold bg-rosegold/10"
                  : "border-border bg-secondary/40",
              )}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-sm font-medium text-cream">{p.label}</span>
              <span className="text-[10px] text-muted-foreground">{p.hint}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
