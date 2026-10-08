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
 * - During a squad game ("game" layout) the faces follow the game's cue
 *   (SquadStageContext): a strip while you read, a grid of friends to tap
 *   while you decide, one face forward at a reveal.
 * - On laptops a squad game is a table: the game sits in the middle and
 *   everyone, you included, has a seat down either side at the camera's
 *   own shape. A reveal brings the winner into the middle. Drag a seat onto
 *   another to swap them (this device only, remembered per room).
 * - Mute and camera live in the room bar with Activities and chat (the
 *   call hands them up through the stage context), so they never move.
 *   Only the full-screen film strip keeps its own.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useRoomContext,
  useSpeakingParticipants,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Armchair, Clock, Mic, MicOff, MoreHorizontal, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { muteParticipant, type MuteWhat } from "@/lib/rooms";
import { useSquadStage, type FaceCue } from "@/context/SquadStageContext";
import { useLowPowerMode } from "@/hooks/useLowPowerMode";
import { useMediaQuery, useWideViewport } from "@/lib/viewport";
import {
  browserTimeZone,
  getSquadLeague,
  getSquadMembers,
  getSquadNights,
  setSquadWhere,
  type SquadMember,
} from "@/lib/squad";
import {
  TABLE_BIG_QUERY,
  TABLE_CENTRE,
  TABLE_CENTRE_BIG,
  TABLE_GAP,
  TABLE_QUERY,
  friendGridClass,
  gridColumns,
  readSeats,
  saveSeats,
  swapSeats,
  tableFaceShare,
  tableSeats,
  tableTile,
  liveVideoFor,
  nearTheEnd,
  placeLine,
  speakerFirst,
  timeLeft,
} from "@/lib/squadCall";
import { cn } from "@/lib/utils";

/**
 * grid         the hang-out grid (laptop, nothing on stage)
 * focus        whoever's talking big, others as bubbles (phones, tucked call)
 * row-tiles    the couch: a row of small faces under the film
 * row-bubbles  the game layout: faces shrunk to bubbles under the game
 * strip        full-screen film: a column of bubbles down the side
 * game         a squad game on stage: follows the game's cue (see SquadStageContext)
 */
export type GroupLayout = "grid" | "focus" | "row-tiles" | "row-bubbles" | "strip" | "game";

type Props = {
  roomId: string;
  layout: GroupLayout;
  /** Just the faces: no clock (the call is a bubble). */
  bare?: boolean;
  /** Kept for callers; hanging up lives in the room bar now. */
  onLeave?: () => void;
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

export function GroupStage({ roomId, layout, bare }: Props) {
  const focus = layout === "focus";
  const stage = useSquadStage();
  const wide = useWideViewport();
  const tableWide = useMediaQuery(TABLE_QUERY);
  const bigCentre = useMediaQuery(TABLE_BIG_QUERY);
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
  const lkRoom = useRoomContext();

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

  // Mute and camera go up to the room bar (next to Activities and chat), so
  // they sit in the same place on every screen.
  const lp = useRef(localParticipant);
  lp.current = localParticipant;
  const setControls = stage?.setControls;
  useEffect(() => {
    if (!setControls) return;
    setControls({
      mic: isMicrophoneEnabled,
      cam: isCameraEnabled,
      toggleMic: () => void lp.current.setMicrophoneEnabled(!lp.current.isMicrophoneEnabled),
      toggleCam: () => void lp.current.setCameraEnabled(!lp.current.isCameraEnabled),
      room: lkRoom,
    });
  }, [setControls, isMicrophoneEnabled, isCameraEnabled, lkRoom]);
  useEffect(() => () => setControls?.(null), [setControls]);

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

  // The table: its size, and this device's own seating.
  const [tableEl, setTableEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!tableEl) return;
    const read = () => setBox({ w: tableEl.clientWidth, h: tableEl.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(tableEl);
    return () => ro.disconnect();
  }, [tableEl]);
  const [savedSeats, setSavedSeats] = useState<string[] | null>(() => readSeats(roomId));
  const [dragOver, setDragOver] = useState<string | null>(null);

  const face = (id: string, size: FaceSize, cue?: FaceCue, onTap?: () => void) => {
    const ref = byId.get(id);
    if (!ref) return null;
    const m = byIdentity.get(id);
    const name = id === self ? "You" : m?.display_name || ref.participant.name || "Friend";
    // Anyone on the call can mute someone else (they stepped away and
    // their laptop is noisy); they can turn it back on. Not while picking
    // faces in a game, where a tap on a face is the answer.
    const target = id !== self && !onTap ? m?.participant_id : undefined;
    const onMute = target
      ? (what: MuteWhat) => {
          void muteParticipant(roomId, target, what)
            .then((r) =>
              toast.message(
                r.muted.length
                  ? `${what.camera ? "Turned off" : "Muted"} ${name.split(" ")[0]}'s ${what.camera ? "camera" : "microphone"}`
                  : `${name.split(" ")[0]}'s ${what.camera ? "camera" : "microphone"} is already off`,
              ),
            )
            .catch(() => toast.error("Couldn't reach the call. Try again."));
        }
      : undefined;
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
        cue={cue}
        onTap={onTap}
        onMute={onMute}
      />
    );
  };

  // Full-screen film only: the room bar isn't on screen there, so the strip
  // keeps its own mute and camera.
  const stripControls = (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
        onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-ondark hover:bg-black/70"
      >
        {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-rose-300" />}
      </button>
      <button
        type="button"
        aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
        onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-ondark hover:bg-black/70"
      >
        {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-rose-300" />}
      </button>
    </div>
  );

  const clockChip = !bare && clock && (
    <div
      className={cn(
        "pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        ending ? "bg-fill text-primary-foreground" : "bg-black/60 text-ondark",
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden /> {clock}
    </div>
  );

  if (layout === "strip") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/45 p-2 backdrop-blur-md">
        {order.map((id) => face(id, "bubble"))}
        {stripControls}
      </div>
    );
  }

  if (layout === "game" && tableWide) {
    const cue = stage?.cue;
    const mode = cue?.mode ?? "reading";
    const cues = cue?.faces ?? {};
    const onTap = cue?.onTap;
    // Seats keep their places (join order, or your own arrangement), not
    // whoever is talking.
    const joined = (members.data?.members ?? []).map((m) => m.user_id);
    const rank = (id: string) => {
      const i = joined.indexOf(id);
      return i < 0 ? joined.length : i;
    };
    const present = tracks.map((t) => t.participant.identity).sort((a, b) => rank(a) - rank(b));
    const { left, right } = tableSeats(present, self, savedSeats);
    const centre = bigCentre ? TABLE_CENTRE_BIG : TABLE_CENTRE;
    const side = Math.max(0, (box.w - centre - 2 * TABLE_GAP) / 2);
    const tile = tableTile(side, box.h, Math.max(left.length, right.length));
    const focusId = cue?.focus && byId.has(cue.focus) ? cue.focus : null;
    const share = tableFaceShare(mode, Boolean(focusId));
    const swap = (a: string, b: string) => {
      const order = swapSeats([...left, ...right].filter((x): x is string => Boolean(x)), a, b);
      setSavedSeats(order);
      saveSeats(roomId, order);
    };
    const seat = (id: string | null, i: number) => {
      const style = { width: tile.w, height: tile.h };
      if (id === null) return <ScoresSeat key="scores" roomId={roomId} self={self} style={style} />;
      if (share > 0 && id === focusId) {
        const m = byIdentity.get(id);
        return (
          <div
            key={id}
            style={style}
            className="flex shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 text-sm font-semibold text-primary"
          >
            {id === self ? "You" : (m?.display_name ?? "Friend")} · in the middle
          </div>
        );
      }
      return (
        <div
          key={id}
          style={style}
          draggable
          title="Drag onto another seat to swap"
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragOver !== id) setDragOver(id);
          }}
          onDragLeave={() => setDragOver((d) => (d === id ? null : d))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(null);
            swap(e.dataTransfer.getData("text/plain"), id);
          }}
          className={cn(
            "shrink-0 cursor-grab overflow-hidden rounded-2xl transition-[outline] active:cursor-grabbing",
            dragOver === id && "outline outline-2 outline-offset-4 outline-primary/70",
          )}
          data-seat={i}
        >
          {face(id, "tile", cues[id], cues[id]?.tappable && onTap ? () => onTap(id) : undefined)}
        </div>
      );
    };
    const column = (list: (string | null)[], edge: "left" | "right", from: number) => (
      <div
        className="absolute top-0 flex h-full flex-col items-center justify-center gap-3"
        style={{ width: side, [edge]: 0 }}
      >
        {list.map((id, i) => seat(id, from + i))}
      </div>
    );
    return (
      <div ref={setTableEl} className="relative h-full w-full">
        {box.w > 0 && (
          <>
            {column(left, "left", 0)}
            {column(right, "right", left.length)}
            {share > 0 && focusId && (
              <div
                className="absolute top-0"
                style={{ left: (box.w - centre) / 2, width: centre, height: box.h * share - TABLE_GAP / 2 }}
              >
                {face(focusId, "spot", cues[focusId])}
                {mode === "spotlight" && cue?.caption && (
                  <p
                    key={cue.caption}
                    className="pointer-events-none absolute inset-x-0 top-0 animate-in rounded-t-2xl bg-gradient-to-b from-black/75 via-black/45 to-transparent px-3 pb-8 pt-3 text-center font-serif text-2xl font-semibold text-primary drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] fade-in zoom-in-95 duration-500 sm:text-3xl"
                  >
                    {cue.caption}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (layout === "game") {
    const cue = stage?.cue;
    const mode = cue?.mode ?? "reading";
    const cues = cue?.faces ?? {};
    const onTap = cue?.onTap;
    const gface = (id: string, size: FaceSize) =>
      face(id, size, cues[id], cues[id]?.tappable && onTap ? () => onTap(id) : undefined);
    const friends = order.filter((id) => id !== self);
    const clockPill = clock && (
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          ending ? "bg-fill text-primary-foreground" : "bg-black/60 text-ondark",
        )}
      >
        <Clock className="h-3 w-3" aria-hidden /> {clock}
      </div>
    );

    if (mode === "reading" && !wide) {
      // Phone, reading or writing: everyone shrinks to a strip. (A laptop has
      // room, so it keeps the grid below.)
      return (
        <div className="flex h-full w-full items-center gap-2 overflow-x-auto bg-black/35 px-3 py-2">
          {clockPill}
          {order.map((id) => gface(id, "bubble"))}
        </div>
      );
    }

    if (mode === "spotlight" || mode === "hero") {
      // One face steps forward; everyone else waits in a row below it.
      const focusId = cue?.focus && byId.has(cue.focus) ? cue.focus : (friends[0] ?? self);
      const rest = order.filter((id) => id !== focusId);
      return (
        <div className="flex h-full w-full flex-col gap-2 bg-black/40 p-2">
          <div className="relative min-h-0 flex-1">
            {gface(focusId, mode === "spotlight" ? "spot" : "big")}
            {mode === "spotlight" && cue?.caption && (
              <p
                key={cue.caption}
                className="pointer-events-none absolute inset-x-0 top-0 animate-in rounded-t-2xl bg-gradient-to-b from-black/75 via-black/45 to-transparent px-3 pb-8 pt-3 text-center font-serif text-2xl font-semibold text-primary drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] fade-in zoom-in-95 duration-500 sm:text-3xl"
              >
                {cue.caption}
              </p>
            )}
          </div>
          {rest.length > 0 && (
            <div className="flex shrink-0 items-center justify-center gap-2 overflow-x-auto">
              {clockPill}
              {rest.map((id) => gface(id, "bubble"))}
            </div>
          )}
        </div>
      );
    }

    // Deciding or waiting: friends share the grid (never more than four);
    // you sit small beside the question, never over a friend.
    return (
      <div className="flex h-full w-full flex-col gap-2 bg-black/40 p-2">
        <div className="flex shrink-0 items-center gap-3">
          {clockPill}
          <p className="min-w-0 flex-1 text-sm leading-snug text-cream/85">{cue?.hint}</p>
          {byId.has(self) && <div className="h-[76px] w-[58px] shrink-0">{gface(self, "self")}</div>}
        </div>
        <div className={cn("grid min-h-0 flex-1 gap-2", friendGridClass(friends.length))}>
          {friends.map((id) => gface(id, "tile"))}
        </div>
      </div>
    );
  }

  if (layout === "row-tiles" || layout === "row-bubbles") {
    const tiles = layout === "row-tiles";
    return (
      <div className="flex h-full w-full items-center gap-2 bg-black/35 px-2 py-2">
        {clock && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              ending ? "bg-fill text-primary-foreground" : "bg-black/60 text-ondark",
            )}
          >
            <Clock className="h-3 w-3" aria-hidden /> {clock}
          </div>
        )}
        <div className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {order.map((id) => face(id, tiles ? "mini" : "bubble"))}
        </div>
      </div>
    );
  }

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
    </div>
  );
}

type FaceSize = "big" | "spot" | "tile" | "self" | "bubble" | "mini";

const BADGE_TEXT: Record<NonNullable<FaceCue["badge"]>, string> = {
  in: "✓ in",
  thinking: "•••",
  reading: "📖 reading",
};

function Face({
  trackRef,
  name,
  place,
  photo,
  talking,
  showVideo,
  size,
  cue,
  onTap,
  onMute,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  name: string;
  place: string;
  photo: string | null;
  talking: boolean;
  showVideo: boolean;
  size: FaceSize;
  cue?: FaceCue;
  onTap?: () => void;
  /** Someone else's face: mute their mic or turn off their camera. */
  onMute?: (what: MuteWhat) => void;
}) {
  // A phone held upright sends a tall picture. In a wide seat, cropping it
  // leaves a band across the face, so show it whole on a dark ground.
  const [upright, setUpright] = useState(false);
  const readShape = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) setUpright(v.videoHeight > v.videoWidth);
  };
  const fit = (big: boolean) => cn("h-full w-full", big && upright ? "bg-black object-contain" : "object-cover");
  const hasVideo =
    showVideo && isTrackReference(trackRef) && !trackRef.publication.isMuted && Boolean(trackRef.publication.track);
  const initial = (name || "?").charAt(0).toUpperCase();
  // What the game says about this face: my pick, dimmed, their turn, in/thinking.
  const cueRing = cue?.picked
    ? "ring-[3px] ring-primary shadow-[0_0_26px_hsl(var(--primary)/0.45)]"
    : cue?.ring
      ? "ring-[3px] ring-primary"
      : "";
  const cueDim = cue?.dim ? "opacity-45 saturate-50" : "";
  const badge = cue?.badge ? (
    <span
      className={cn(
        "absolute right-1.5 top-1.5 z-10 rounded-full px-2 py-0.5 text-[11px] font-bold",
        cue.badge === "in" ? "bg-emerald-400 text-emerald-950" : "bg-black/65 text-ondark",
      )}
    >
      {BADGE_TEXT[cue.badge]}
    </span>
  ) : null;
  const wrap = (el: React.ReactElement, cls: string) =>
    onTap ? (
      <button
        type="button"
        onClick={onTap}
        aria-label={`Pick ${name}`}
        aria-pressed={Boolean(cue?.picked)}
        className={cn("focus-ring text-left transition", cls)}
      >
        {el}
      </button>
    ) : (
      <div className={cls}>{el}</div>
    );

  if (size === "self" || size === "spot") {
    // You beside the question (small), or the face that steps forward at a reveal.
    const spot = size === "spot";
    return wrap(
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden bg-white/[0.06]",
          spot ? "rounded-2xl ring-[3px] ring-primary shadow-[0_0_60px_hsl(var(--primary)/0.45)]" : "rounded-xl ring-2 ring-cream/60",
          !spot && cueRing,
        )}
      >
        {badge}
        {hasVideo ? (
          <VideoTrack trackRef={trackRef} className={fit(spot)} onLoadedMetadata={readShape} onResize={readShape} />
        ) : photo ? (
          <img src={photo} alt="" className={cn("rounded-full object-cover", spot ? "h-28 w-28" : "h-9 w-9")} />
        ) : (
          <span className={cn("font-serif font-semibold text-cream", spot ? "text-6xl" : "text-lg")}>{initial}</span>
        )}
        <span
          className={cn(
            "absolute inset-x-1 bottom-1 truncate rounded bg-black/60 px-1 text-center font-semibold text-ondark",
            spot ? "text-sm" : "text-[10px]",
          )}
        >
          {name}
        </span>
      </div>,
      cn("h-full w-full", cueDim),
    );
  }

  if (size === "mini") {
    // The couch: a small face under the film, lit when talking.
    return (
      <div
        className={cn(
          "relative flex h-full max-h-[120px] w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.06]",
          talking && "ring-[3px] ring-inset ring-primary",
        )}
      >
        {hasVideo ? (
          <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
        ) : photo ? (
          <img src={photo} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/25 text-lg font-bold text-cream">
            {initial}
          </span>
        )}
        <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px]">
          <span className="truncate font-semibold text-cream">{name}</span>
          {place && <span className="ml-auto shrink-0 truncate text-cream/70">{place}</span>}
          {onMute && <FaceMenu name={name} hasVideo={hasVideo} onMute={onMute} className={place ? "" : "ml-auto"} small />}
        </div>
      </div>
    );
  }

  if (size === "bubble") {
    return wrap(
      <>
        <div
          className={cn(
            "relative h-14 w-14 overflow-hidden rounded-full bg-white/[0.08]",
            talking && "ring-[3px] ring-primary",
            cueRing,
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
        {cue?.badge && (
          <span className={cn("text-[10px] font-bold", cue.badge === "in" ? "text-emerald-300" : "text-cream/60")}>
            {BADGE_TEXT[cue.badge]}
          </span>
        )}
      </>,
      cn("flex w-16 shrink-0 flex-col items-center gap-1", cueDim),
    );
  }

  return wrap(
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-white/[0.05]",
        size === "tile" ? "rounded-2xl" : "",
        talking && "ring-[3px] ring-inset ring-primary",
        cueRing,
      )}
    >
      {badge}
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={fit(size === "tile" || size === "big")}
          onLoadedMetadata={readShape}
          onResize={readShape}
        />
      ) : photo ? (
        <img src={photo} alt="" className="aspect-square h-[62%] max-h-28 w-auto rounded-full object-cover" />
      ) : (
        <span className="flex aspect-square h-[62%] max-h-28 items-center justify-center rounded-full bg-primary/25 font-serif text-3xl font-semibold text-cream sm:text-4xl">
          {initial}
        </span>
      )}
      {talking && (
        <span className="absolute left-3 top-3 rounded-full bg-fill px-2 py-0.5 text-[11px] font-bold text-fill-foreground">
          Talking
        </span>
      )}
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-xl bg-black/65 px-3 py-1.5">
        {/* The name always shows in full; the city and clock give way first. */}
        <span className="max-w-[70%] shrink-0 truncate text-sm font-semibold text-cream">{name}</span>
        {place && <span className="ml-auto min-w-0 truncate text-xs text-cream/75">{place}</span>}
        {onMute && <FaceMenu name={name} hasVideo={hasVideo} onMute={onMute} className={place ? "" : "ml-auto"} />}
      </div>
    </div>,
    // Always fill the space given: a seat, a grid cell. Left to its content,
    // a tall phone camera would stretch the tile to its own shape.
    cn("h-full min-h-0 w-full", size === "tile" && "rounded-2xl", cueDim),
  );
}


/** The sixth space at a full table: the squad's league, top three. */
function ScoresSeat({ roomId, self, style }: { roomId: string; self: string; style: React.CSSProperties }) {
  const league = useQuery({ queryKey: ["squad-league", roomId], queryFn: () => getSquadLeague(roomId) });
  const rows = (league.data ?? []).slice(0, 3);
  return (
    <div style={style} className="flex shrink-0 flex-col justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4">
      <p className="dr-eyebrow text-primary/85">Squad league</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Points land here after the first reveal.</p>
      ) : (
        rows.map((r, i) => (
          <div key={r.user_id} className="flex items-center gap-2 text-sm">
            <span className="w-4 tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-cream">{r.user_id === self ? "You" : r.display_name}</span>
            <span className="font-semibold tabular-nums text-cream">{r.points}</span>
          </div>
        ))
      )}
    </div>
  );
}


/** The "…" on someone else's face: mute their microphone, or turn off their
 *  camera, for everyone. A small menu that opens upward from the name bar. */
function FaceMenu({
  name,
  hasVideo,
  onMute,
  className,
  small,
}: {
  name: string;
  hasVideo: boolean;
  onMute: (what: MuteWhat) => void;
  className?: string;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const first = name.split(" ")[0];
  const item = "block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-cream hover:bg-white/[0.08]";
  return (
    <div className={cn("relative shrink-0", className)} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Options for ${first}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "focus-ring flex items-center justify-center rounded-full text-cream/85 hover:bg-white/15 hover:text-cream",
          small ? "h-5 w-5" : "h-6 w-6",
        )}
      >
        <MoreHorizontal className={small ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-40 mb-2 min-w-[11rem] rounded-xl border border-white/10 bg-card/95 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <button type="button" className={item} onClick={() => { setOpen(false); onMute({ microphone: true }); }}>
              Mute {first}
            </button>
            {hasVideo && (
              <button type="button" className={item} onClick={() => { setOpen(false); onMute({ camera: true }); }}>
                Turn off {first}'s camera
              </button>
            )}
            <p className="px-3 pb-1.5 pt-1 text-[11px] text-muted-foreground">They can turn it back on.</p>
          </div>
        </>
      )}
    </div>
  );
}
