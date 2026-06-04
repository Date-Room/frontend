import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardPage } from "@/components/CardPage";
import { cn } from "@/lib/utils";

/**
 * Manual "Join with code" entry — mirrors mobile's `join_by_code_screen.dart`.
 *
 * Two slot-style inputs: a 6-character Room ID and a 4-digit PIN. Each
 * input is a hidden text field behind a row of visible slot boxes, the
 * iOS 2-factor-code pattern. The code field auto-advances focus to the
 * PIN field on 6 chars; on a 4-digit PIN we auto-submit.
 *
 * Routes to the lobby with the PIN prefilled.
 */
export default function JoinByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<HTMLInputElement | null>(null);
  const pinRef = useRef<HTMLInputElement | null>(null);

  // Focus the code field on mount.
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  // Auto-advance to PIN when code is complete.
  useEffect(() => {
    if (code.length === 6 && document.activeElement !== pinRef.current) {
      pinRef.current?.focus();
    }
  }, [code]);

  const valid = code.length === 6 && pin.length === 4;

  // Auto-submit on PIN completion.
  useEffect(() => {
    if (valid) {
      navigate(`/i/${code}/${pin}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Enter a 6-character Room ID and 4-digit PIN.");
      return;
    }
    navigate(`/i/${code}/${pin}`);
  }

  return (
    <CardPage
      title="Join with code"
      onBack={() => navigate(-1)}
      maxWidth="sm:max-w-md"
      bodyClassName="animate-float-up"
    >
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Type the Room ID and PIN your host shared.
      </p>
      <form onSubmit={submit} className="space-y-7">
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
          className="btn-primary focus-ring w-full py-3.5 rounded-[1.15rem] font-semibold disabled:opacity-40"
        >
          Join
        </button>
      </form>
    </CardPage>
  );
}

/**
 * One-char-per-box slot input. A transparent text input owns focus
 * + keyboard input. We render `length` visible slot boxes around it
 * showing each character — empty slots dim, filled slots accent-tinted
 * background, the active slot gets a thicker accent border.
 *
 * The wrapper is the tap target — tapping anywhere refocuses the
 * hidden input so the keyboard pops up reliably on mobile.
 */
function SlotInput({
  label,
  length,
  value,
  onChange,
  inputRef,
  inputMode = "text",
  obscure = false,
  autoComplete,
}: {
  label: string;
  length: number;
  value: string;
  onChange: (v: string) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  inputMode?: "text" | "numeric";
  obscure?: boolean;
  autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  // 40px slot + 8px gap → we render slots as inline-flex with gap.
  // Match the mobile 40×52 spec.
  const slots = Array.from({ length }, (_, i) => i);

  return (
    <div className="space-y-2">
      <div className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </div>
      <div
        className="relative flex items-center justify-center gap-2"
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        {slots.map((i) => {
          const hasChar = i < value.length;
          const isActive = focused && i === value.length;
          const ch = hasChar ? (obscure ? "•" : value[i]) : "";
          return (
            <div
              key={i}
              className={cn(
                "flex h-13 w-10 items-center justify-center rounded-[10px] border text-xl font-semibold tabular-nums text-cream transition-all duration-150",
                hasChar
                  ? "border-primary/45 bg-primary/10"
                  : "border-border bg-secondary/50",
                isActive && "!border-primary border-2",
              )}
              style={{ height: 52 }}
              aria-hidden
            >
              {ch}
            </div>
          );
        })}
        {/* Hidden input — fully transparent, sized to cover the slot row
            so taps land on it and the OS keyboard / autofill works. */}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={length}
          inputMode={inputMode}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoComplete={autoComplete}
          className="absolute inset-0 w-full opacity-0 outline-none"
          aria-label={label}
        />
      </div>
    </div>
  );
}
