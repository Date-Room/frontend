/**
 * The squad call: everyone's faces during a squad night. Lives inside the
 * one <RoomVideo> (group mode), so layout changes never reconnect.
 *
 * - Laptop, nothing on stage: the hang-out grid (faces plus an armchair
 *   tile for each free seat).
 * - Phone, or the call tucked beside a film or game: whoever is talking big,
 *   everyone else as bubbles.
 * - Every face: name, city and their own local time.
 * - Weak phones play live video only for the person talking and yourself;
 *   everyone else is a photo bubble that lights up when they speak.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useSpeakingParticipants,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Armchair, Clock, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useLowPowerMode } from "@/hooks/useLowPowerMode";
import {
  browserTimeZone,
  getSquadMembers,
  getSquadNights,
  setSquadWhere,
  type SquadMember,
} from "@/lib/squad";
import { gridColumns, liveVideoFor, nearTheEnd, placeLine, speakerFirst, timeLeft } from "@/lib/squadCall";
import { cn } from "@/lib/utils";

type Props = {
  roomId: string;
  /** Whoever's talking big, others as bubbles (phones, or tucked beside an activity). */
  focus: boolean;
  /** Just the faces: no controls, no clock (the call is a bubble). */
  bare?: boolean;
  onLeave: () => void;
};

/** Ticks once a minute so every clock on screen moves together. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function GroupStage({ roomId, focus, bare, onLeave }: Props) {
  const qc = useQueryClient();
  const lowPower = useLowPowerMode();
  const now = useMinute();
  const members = useQuery({ queryKey: ["squad-members", roomId], queryFn: () => getSquadMembers(roomId) });
  const nights = useQuery({
    queryKey: ["squad-nights", roomId],
    queryFn: () => getSquadNights(roomId),
    refetchInterval: 30_000,
  });
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const speaking = useSpeakingParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  // First squad call on this device: tell the squad my zone, so my face
  // shows my local time. City is set on the room page.
  const me = members.data?.members.find((m) => m.user_id === localParticipant.identity);
  useEffect(() => {
    const tz = browserTimeZone();
    if (me && !me.tz && tz) {
      void setSquadWhere(roomId, { tz, city: me.city }).then(() =>
        qc.invalidateQueries({ queryKey: ["squad-members", roomId] }),
      );
    }
  }, [me, roomId, qc]);

  const byIdentity = useMemo(() => {
    const map = new Map<string, SquadMember>();
    for (const m of members.data?.members ?? []) if (m.user_id) map.set(m.user_id, m);
    return map;
  }, [members.data]);

  const speaker = speaking.find((p) => !p.isLocal)?.identity ?? speaking[0]?.identity ?? null;
  const self = localParticipant.identity;
  const byId = new Map(tracks.map((t) => [t.participant.identity, t]));
  const order = speakerFirst(
    tracks.map((t) => t.participant.identity),
    speaker,
    self,
    focus,
  );
  const live = liveVideoFor(order, { speaker, self, lowPower });
  const night = nights.data?.active_night ?? null;
  const freeSeats = night ? Math.max(0, night.seats - order.length) : 0;
  const clock = timeLeft(night?.ends_at, now);
  const ending = nearTheEnd(night?.ends_at, now);

  const face = (id: string, size: "big" | "tile" | "bubble") => {
    const ref = byId.get(id);
    if (!ref) return null;
    const m = byIdentity.get(id);
    const name = id === self ? "You" : m?.display_name || ref.participant.name || "Friend";
    return (
      <Face
        key={id}
        trackRef={ref}
        name={name}
        place={placeLine(m?.city, m?.tz, now)}
        photo={m?.photo_url ?? null}
        talking={speaking.some((p) => p.identity === id)}
        showVideo={live.has(id)}
        size={size}
      />
    );
  };

  const controls = !bare && (
    <div className="flex items-center justify-center gap-2 p-2">
      <button
        type="button"
        aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
        onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-cream hover:bg-black/70"
      >
        {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-rose-300" />}
      </button>
      <button
        type="button"
        aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
        onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-cream hover:bg-black/70"
      >
        {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-rose-300" />}
      </button>
      <button
        type="button"
        aria-label="Leave the call"
        onClick={onLeave}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-700/85 text-white hover:bg-rose-700"
      >
        <PhoneOff className="h-5 w-5" />
      </button>
    </div>
  );

  const clockChip = !bare && clock && (
    <div
      className={cn(
        "pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        ending ? "bg-primary text-primary-foreground" : "bg-black/60 text-cream",
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden /> {clock}
    </div>
  );

  if (focus) {
    const [first, ...rest] = order;
    return (
      <div className="relative flex h-full w-full flex-col bg-black/50">
        {clockChip}
        <div className="relative min-h-0 flex-1">{first && face(first, "big")}</div>
        {rest.length > 0 && (
          <div className="flex shrink-0 items-center justify-center gap-2 overflow-x-auto px-2 py-2">
            {rest.map((id) => face(id, "bubble"))}
          </div>
        )}
        {controls}
      </div>
    );
  }

  const cols = gridColumns(order.length + freeSeats);
  return (
    <div className="relative flex h-full w-full flex-col bg-black/40">
      {clockChip}
      <div
        className="grid min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}
      >
        {order.map((id) => face(id, "tile"))}
        {Array.from({ length: freeSeats }, (_, i) => (
          <div
            key={`free-${i}`}
            className="flex min-h-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/[0.12] p-3 text-center"
          >
            <Armchair className="h-9 w-9 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold text-cream">A free seat</p>
            <p className="hidden text-xs text-muted-foreground sm:block">Anyone with the link can sit here.</p>
          </div>
        ))}
      </div>
      {controls}
    </div>
  );
}

function Face({
  trackRef,
  name,
  place,
  photo,
  talking,
  showVideo,
  size,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  name: string;
  place: string;
  photo: string | null;
  talking: boolean;
  showVideo: boolean;
  size: "big" | "tile" | "bubble";
}) {
  const hasVideo =
    showVideo && isTrackReference(trackRef) && !trackRef.publication.isMuted && Boolean(trackRef.publication.track);
  const initial = (name || "?").charAt(0).toUpperCase();

  if (size === "bubble") {
    return (
      <div className="flex w-16 shrink-0 flex-col items-center gap-1">
        <div
          className={cn(
            "relative h-14 w-14 overflow-hidden rounded-full bg-white/[0.08]",
            talking && "ring-[3px] ring-primary",
          )}
        >
          {hasVideo ? (
            <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
          ) : photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-bold text-cream">{initial}</span>
          )}
        </div>
        <span className="max-w-full truncate text-[11px] text-cream/85">{name}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-h-0 items-center justify-center overflow-hidden bg-white/[0.05]",
        size === "tile" ? "rounded-2xl" : "h-full w-full",
        talking && "ring-[3px] ring-inset ring-primary",
      )}
    >
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
      ) : photo ? (
        <img src={photo} alt="" className="h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28" />
      ) : (
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/25 font-serif text-4xl font-semibold text-cream sm:h-28 sm:w-28">
          {initial}
        </span>
      )}
      {talking && (
        <span className="absolute left-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
          Talking
        </span>
      )}
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-xl bg-black/65 px-3 py-1.5">
        <span className="truncate text-sm font-semibold text-cream">{name}</span>
        {place && <span className="ml-auto shrink-0 truncate text-xs text-cream/75">{place}</span>}
      </div>
    </div>
  );
}
