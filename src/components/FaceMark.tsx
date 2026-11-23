/**
 * What goes on a face that has no photo.
 *
 * Their initial when there is one, and a silhouette when there is not.
 * Never a question mark: "?" on a face reads as *unknown person*, or
 * as a bug, when the truth is only ever "no photo, and no name on this
 * presence record". In a room where the whole point is knowing who is
 * who, accusing someone of being a mystery is the worst of the
 * options.
 *
 * Drop-in for the `(name || "?").charAt(0).toUpperCase()` that used to
 * sit inline at every one of these: the caller keeps its own circle,
 * ring and sizing and only hands over what to draw inside.
 *
 * The twin of mobile's `FaceMark` in `widgets/face_mark.dart`.
 */
import { User } from "lucide-react";
import { initialOf } from "@/lib/people";

export function FaceMark({
  name,
  className,
}: {
  name?: string | null;
  /** Sizing for the silhouette; the initial is sized by the parent. */
  className?: string;
}) {
  const initial = initialOf(name);
  if (initial) return <>{initial}</>;
  return <User className={className ?? "h-[55%] w-[55%] opacity-80"} aria-hidden />;
}
