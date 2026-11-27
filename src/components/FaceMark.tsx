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
  // Sized in `em`, not `%`. A percentage resolves against the parent's
  // height, and several of these sit in a plain text span whose height
  // is auto — where the percentage is indeterminate and the SVG falls
  // back to its own intrinsic size, which is bigger than the line it
  // is in and pushes the layout around it down.
  return <User className={className ?? "h-[1.1em] w-[1.1em] opacity-80"} aria-hidden />;
}
