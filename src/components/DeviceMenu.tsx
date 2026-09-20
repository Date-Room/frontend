import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaDeviceSelect, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import {
  Check,
  ChevronUp,
  Columns2,
  LayoutTemplate,
  Mic,
  PictureInPicture2,
  LayoutPanelLeft,
  Video,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  deviceKindNoun,
  deviceLabel,
  saveDevicePreference,
  speakerSelectionSupported,
  type DeviceKind,
} from "@/lib/devices";
import { useCallLayout, type CallLayout } from "@/lib/callLayout";
import { cn } from "@/lib/utils";

/** One kind's device list inside the menu. Uses LiveKit's hook (enumeration
 *  + active tracking + switching) and persists the choice. */
function DeviceSection({
  kind,
  label,
  Icon,
}: {
  kind: DeviceKind;
  label: string;
  Icon: LucideIcon;
}) {
  // Permission is already granted in-call, so we don't re-request here.
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: kind as MediaDeviceKind,
    requestPermissions: false,
  });

  async function pick(id: string) {
    try {
      await setActiveMediaDevice(id);
      saveDevicePreference(kind, id === "default" ? null : id);
    } catch {
      toast.error(`Couldn't switch ${deviceKindNoun(kind).toLowerCase()}.`);
    }
  }

  const isDefaultActive = !activeDeviceId || activeDeviceId === "default";

  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2 px-1 text-label font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </header>
      <ul className="space-y-1.5">
        <DeviceRow
          active={isDefaultActive}
          label="System default"
          onClick={() => void pick("default")}
        />
        {devices.map((d, i) => (
          <DeviceRow
            key={d.deviceId || i}
            active={activeDeviceId === d.deviceId}
            label={deviceLabel(d, i, kind)}
            onClick={() => void pick(d.deviceId)}
          />
        ))}
      </ul>
    </section>
  );
}

function DeviceRow({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-body transition",
          active
            ? "border-primary/40 bg-primary/[0.08] text-cream"
            : "border-white/[0.08] bg-white/[0.02] text-cream/90 hover:bg-white/[0.05]",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {active && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
      </button>
    </li>
  );
}

/** A panel anchored above a control, portalled so the call frame's
 *  `overflow-hidden` can't clip it. Clamped to the viewport so a control near
 *  the edge still gets a whole menu. */
function Dropup({
  anchor,
  onClose,
  children,
}: {
  anchor: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const WIDTH = 248;
  const MARGIN = 8;
  const centre = anchor.left + anchor.width / 2;
  const left = Math.min(
    Math.max(centre - WIDTH / 2, MARGIN),
    Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN),
  );
  return createPortal(
    <div
      className="fixed inset-0 z-[70]"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          left,
          bottom: Math.max(MARGIN, window.innerHeight - anchor.top + MARGIN),
          width: WIDTH,
          maxHeight: Math.max(160, anchor.top - MARGIN * 3),
        }}
        className="fixed space-y-3.5 overflow-y-auto rounded-2xl border border-white/10 bg-card/95 p-3.5 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl animate-fade-in"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The device switcher for ONE control — a caret on the mic or camera button
 * that drops up its own list, the way every call app does it. Putting mic
 * devices on the mic and camera devices on the camera means you never go
 * hunting in a shared settings sheet for the thing you are already looking at.
 * Must be rendered inside a <LiveKitRoom>.
 */
export function DeviceDropup({
  sections,
  ariaLabel,
  triggerClassName,
  iconClassName,
}: {
  sections: { kind: DeviceKind; label: string; Icon: LucideIcon }[];
  ariaLabel: string;
  triggerClassName: string;
  iconClassName: string;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={anchor !== null}
        // stopPropagation so opening the menu doesn't start a PiP drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setAnchor(anchor ? null : (ref.current?.getBoundingClientRect() ?? null))}
        className={triggerClassName}
      >
        <ChevronUp className={iconClassName} />
      </button>
      {anchor && (
        <Dropup anchor={anchor} onClose={() => setAnchor(null)}>
          {sections.map((sec) => (
            <DeviceSection key={sec.kind} kind={sec.kind} label={sec.label} Icon={sec.Icon} />
          ))}
        </Dropup>
      )}
    </>
  );
}

/** The mic button's dropup: input, and the speaker where the platform lets us
 *  choose one (Safari doesn't). Output sits with the mic because it is the
 *  same conversation — "can they hear me, can I hear them". */
export function MicDropup(props: { triggerClassName: string; iconClassName: string }) {
  const sections: { kind: DeviceKind; label: string; Icon: LucideIcon }[] = [
    { kind: "audioinput", label: "Microphone", Icon: Mic },
  ];
  if (speakerSelectionSupported()) {
    sections.push({ kind: "audiooutput", label: "Speaker", Icon: Volume2 });
  }
  return <DeviceDropup sections={sections} ariaLabel="Choose microphone" {...props} />;
}

/** The camera button's dropup. */
export function CameraDropup(props: { triggerClassName: string; iconClassName: string }) {
  return (
    <DeviceDropup
      sections={[{ kind: "videoinput", label: "Camera", Icon: Video }]}
      ariaLabel="Choose camera"
      {...props}
    />
  );
}

/**
 * In-call settings — now that the device pickers live on the controls they
 * belong to, this is about the call itself rather than the hardware.
 * Must be rendered inside a <LiveKitRoom>.
 */
export function CallSettingsMenu({
  triggerClassName,
  iconClassName,
  canSplit,
}: {
  triggerClassName: string;
  iconClassName: string;
  /** False on viewports too narrow for a second pane — the choice is still
   *  shown, but explained rather than silently missing. */
  canSplit: boolean;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const [layout, chooseLayout] = useCallLayout();

  // Mirrors the top-bar switcher rather than inventing a second vocabulary:
  // one set of modes, one store.
  const options: { id: CallLayout; label: string; hint: string; Icon: LucideIcon }[] = [
    {
      id: "side",
      label: "Side by side",
      hint: "Both of you, stacked in the pane",
      Icon: Columns2,
    },
    {
      id: "side-pip",
      label: "Pane + inset",
      hint: "One feed fills the pane, the other floats on it",
      Icon: PictureInPicture2,
    },
    {
      id: "float",
      label: "Floating",
      hint: "Call over the activity, drag anywhere",
      Icon: LayoutTemplate,
    },
  ];

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="Call layout"
        aria-expanded={anchor !== null}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setAnchor(anchor ? null : (ref.current?.getBoundingClientRect() ?? null))}
        className={triggerClassName}
      >
        <LayoutPanelLeft className={iconClassName} />
      </button>
      {anchor && (
        <Dropup anchor={anchor} onClose={() => setAnchor(null)}>
          <div className="space-y-2">
            <p className="px-1 text-label font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Layout
            </p>
            {options.map((o) => {
              const active = layout === o.id;
              const unavailable = o.id !== "float" && !canSplit;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    chooseLayout(o.id);
                    setAnchor(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-xl border p-3 text-left transition",
                    active
                      ? "border-primary/40 bg-primary/[0.08]"
                      : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
                    unavailable && "cursor-not-allowed opacity-45 hover:bg-white/[0.02]",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <o.Icon className="h-4 w-4 text-primary" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-cream">{o.label}</span>
                    <span className="block truncate text-label text-muted-foreground">
                      {unavailable ? "Needs a wider screen" : o.hint}
                    </span>
                  </span>
                  {active && !unavailable && (
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </Dropup>
      )}
    </>
  );
}

/**
 * Toasts once when the ACTIVE capture/output device changes after join —
 * covers the AirPods-out-of-range fallback and confirms manual switches.
 * A short mount grace suppresses the initial device-set on connect.
 */
export function DeviceChangeToaster() {
  const room = useRoomContext();
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!room) return;
    const onChange = (kind: MediaDeviceKind, deviceId: string) => {
      if (Date.now() - mountedAt.current < 1500) return; // ignore the join-time set
      void navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          const match = list.find((d) => d.deviceId === deviceId);
          const noun = deviceKindNoun(kind as DeviceKind);
          toast.message(`${noun} changed${match?.label ? ` to ${match.label}` : ""}`);
        })
        .catch(() => {
          toast.message(`${deviceKindNoun(kind as DeviceKind)} changed`);
        });
    };
    room.on(RoomEvent.ActiveDeviceChanged, onChange);
    return () => {
      room.off(RoomEvent.ActiveDeviceChanged, onChange);
    };
  }, [room]);

  return null;
}
