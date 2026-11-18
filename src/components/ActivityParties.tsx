/**
 * What is going on in the room, above the list of things you could
 * start.
 *
 * The tray opened on a list of everything available and said nothing at
 * all about what was already happening, so the only way to find out
 * whether anyone was in a game was to open the game. People in the same
 * room were invisible to each other the moment they stopped doing the
 * same thing.
 *
 * The twin of mobile's `activity_parties.dart`.
 */
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { type ActivityParty, partyLine } from "@/lib/activityParties";

/** Past this many, the rest become "+n": three faces and a count reads
 *  at a glance where six overlapping circles are a smudge. */
const MAX_FACES = 3;

function Face({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  return photoUrl ? (
    <img
      src={photoUrl}
      alt=""
      className="h-8 w-8 rounded-full object-cover ring-2 ring-card"
    />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/25 text-xs font-bold text-cream ring-2 ring-card">
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * The faces in a party, overlapping, with the activity badged on the
 * corner of the stack — these people, in that thing, as one mark
 * rather than two facts side by side.
 */
export function PartyFaces({ party, Icon }: { party: ActivityParty; Icon: LucideIcon }) {
  const shown = party.people.slice(0, MAX_FACES);
  const extra = party.people.length - shown.length;
  return (
    <div className="relative shrink-0 pb-1 pr-1">
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <Face key={p.userId} name={p.displayName} photoUrl={p.photoUrl} />
        ))}
        {extra > 0 && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-cream ring-2 ring-card">
            +{extra}
          </span>
        )}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-2 ring-card">
        <Icon className="h-2.5 w-2.5 text-primary-foreground" />
      </span>
    </div>
  );
}

/**
 * A line that scrolls itself when it is too long to fit, the way a
 * track title does on a music player: it rests long enough to be read,
 * travels, and comes back.
 *
 * Ellipsis alone loses the names at the end, and in a room where
 * knowing who is in something is the point, the fourth name matters as
 * much as the first.
 */
export function ScrollingLine({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLSpanElement | null>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const b = box.current, i = inner.current;
      if (!b || !i) return;
      setDistance(Math.max(0, i.scrollWidth - b.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [text]);

  // Travels at a readable ~28px a second, and rests 2s at each end.
  const seconds = distance > 0 ? distance / 28 : 0;
  return (
    <div ref={box} className={`overflow-hidden ${className ?? ""}`}>
      <span
        ref={inner}
        className="inline-block whitespace-nowrap motion-reduce:animate-none"
        style={
          distance > 0
            ? {
                animation: `dr-marquee ${(seconds * 2 + 4).toFixed(2)}s ease-in-out infinite`,
                // The keyframes travel 0 → -100% of the overflow.
                ["--dr-marquee-to" as string]: `-${distance}px`,
              }
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}

/** One thing happening, the people in it, and the way in. */
export function PartyRow({
  party,
  Icon,
  label,
  amIn,
  onJoin,
}: {
  party: ActivityParty;
  Icon: LucideIcon;
  label: string;
  amIn: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-card/40 p-3">
      <PartyFaces party={party} Icon={Icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-cream">{label}</p>
        <ScrollingLine text={partyLine(party)} className="text-xs text-muted-foreground" />
      </div>
      {amIn ? (
        <span className="shrink-0 text-xs text-muted-foreground">You're in</span>
      ) : (
        <button
          type="button"
          onClick={onJoin}
          className="btn-primary focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold"
        >
          Join in
        </button>
      )}
    </div>
  );
}
