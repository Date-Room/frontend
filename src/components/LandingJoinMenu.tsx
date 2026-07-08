import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { SlotInput } from "@/pages/JoinByCode";
import { cn } from "@/lib/utils";

/**
 * Landing-page "Join a room" — a dropdown holding the same Room ID + PIN form
 * as the /join page, so joining doesn't navigate away. On a complete code it
 * routes to the invite/lobby URL.
 */
export function LandingJoinMenu({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const pinRef = useRef<HTMLInputElement | null>(null);

  const valid = code.length === 6 && pin.length === 4;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus the code field when the panel opens; advance to PIN when it fills.
  useEffect(() => {
    if (open) setTimeout(() => codeRef.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    if (code.length === 6 && document.activeElement !== pinRef.current) pinRef.current?.focus();
  }, [code]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Enter a 6-character Room ID and 4-digit PIN.");
      return;
    }
    navigate(`/i/${code}/${pin}`);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 text-sm text-lpmuted transition-colors hover:text-lpcream"
      >
        {t("landing.nav.join")}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[19rem] rounded-2xl border border-lpborder/60 bg-lpcard p-5 shadow-2xl">
          <p className="mb-4 text-center text-sm text-lpmuted">Type the Room ID and PIN your host shared.</p>
          <form onSubmit={submit} className="space-y-5">
            <SlotInput
              label="ROOM ID"
              length={6}
              value={code}
              onChange={(v) => setCode(v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))}
              inputRef={codeRef}
              inputMode="text"
              autoComplete="off"
            />
            <SlotInput
              label="PIN"
              length={4}
              value={pin}
              onChange={(v) => setPin(v.replace(/[^\d]/g, "").slice(0, 4))}
              inputRef={pinRef}
              inputMode="numeric"
              obscure
              autoComplete="one-time-code"
            />
            {error && <p className="text-center text-sm text-rose">{error}</p>}
            <button
              type="submit"
              disabled={!valid}
              className="lp-btn w-full !py-3 text-sm disabled:opacity-40"
            >
              {t("landing.nav.join")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
