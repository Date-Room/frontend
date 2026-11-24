/**
 * Someone's name, with yours marked.
 *
 * "Jun (You)" — the mark is the parenthetical, and the tint only
 * reinforces it. Colour as the only cue fails anyone who cannot see
 * the difference and vanishes in a screen reader, so the words say it
 * and the colour makes it quick to find.
 *
 * For labels: rows, chips, tiles, ballot options, standings. Sentences
 * use `personName` and read "You win the round".
 *
 * The twin of mobile's `widgets/person_label.dart`.
 */
import { personName, youMark } from "@/lib/people";
import { cn } from "@/lib/utils";

export function PersonLabel({
  name,
  isMe = false,
  className,
  markClassName,
}: {
  name: string | null | undefined;
  isMe?: boolean;
  className?: string;
  /** Override the tint where the accent would not read on the ground. */
  markClassName?: string;
}) {
  const mark = youMark(isMe, name);
  // No name to put it beside: the mark IS the label.
  if (isMe && !mark) {
    return <span className={cn(markClassName ?? "text-primary", className)}>You</span>;
  }
  return (
    <span className={className}>
      {personName(name)}
      {mark && (
        <span className={cn("ml-1 font-medium", markClassName ?? "text-primary")}>
          {mark}
        </span>
      )}
    </span>
  );
}
