import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaDeviceSelect, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Check, Mic, Settings, Video, Volume2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  deviceKindNoun,
  deviceLabel,
  saveDevicePreference,
  speakerSelectionSupported,
  type DeviceKind,
} from "@/lib/devices";
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
    <section className="space-y-1.5">
      <header className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </header>
      <ul className="space-y-1">
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
          "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition",
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

/**
 * Split-button entry point to the device switcher — one gear button that
 * opens a menu (desktop) / bottom sheet (mobile) with Mic / Camera /
 * Speaker sections. Fits the compact call bubble (no inline dropdowns).
 * Must be rendered inside a <LiveKitRoom>.
 */
export function DeviceMenu({
  triggerClassName,
  iconClassName,
}: {
  triggerClassName: string;
  iconClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const showSpeaker = speakerSelectionSupported();

  return (
    <>
      <button
        type="button"
        aria-label="Choose devices"
        // stopPropagation so opening the menu doesn't start a PiP drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        <Settings className={iconClassName} />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[80dvh] w-full space-y-4 overflow-y-auto rounded-t-3xl border border-white/10 bg-card/95 p-5 shadow-2xl backdrop-blur-xl sm:mx-4 sm:max-w-sm sm:rounded-3xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg text-cream">Devices</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-cream"
                >
                  Done
                </button>
              </div>
              <DeviceSection kind="audioinput" label="Microphone" Icon={Mic} />
              <DeviceSection kind="videoinput" label="Camera" Icon={Video} />
              {showSpeaker && (
                <DeviceSection kind="audiooutput" label="Speaker" Icon={Volume2} />
              )}
            </div>
          </div>,
          document.body,
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
