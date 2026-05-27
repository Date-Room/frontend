import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageShell, PageStickyHeader } from "@/components/PageShell";

/**
 * Manual "Join with code" entry — mirrors mobile's `join_by_code_screen.dart`.
 * Routes to the lobby with the PIN prefilled.
 */
export default function JoinByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");

  const valid = code.trim().length === 6 && /^\d{4}$/.test(pin.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    navigate(`/i/${code.trim().toUpperCase()}/${pin.trim()}`);
  }

  return (
    <PageShell>
      <PageStickyHeader>
        <div className="max-w-md mx-auto px-6 h-14 flex items-center">
          <button type="button" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-cream transition mr-4" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-cream text-lg">Join with code</h1>
        </div>
      </PageStickyHeader>

      <main className="max-w-md mx-auto px-6 pt-10 pb-24 relative z-10">
        <p className="text-sm text-muted-foreground mb-6">Type the Room ID and PIN your host shared.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="jbc-code" className="block text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Room ID
            </label>
            <input
              id="jbc-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))}
              placeholder="6 characters"
              className="auth-input tracking-[0.3em] text-center uppercase"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="jbc-pin" className="block text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              PIN
            </label>
            <input
              id="jbc-pin"
              type="text"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              placeholder="4 digits"
              className="auth-input tracking-[0.5em] text-center"
            />
          </div>
          <button
            type="submit"
            disabled={!valid}
            className="btn-primary w-full py-4 rounded-[1.15rem] font-semibold disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </main>
    </PageShell>
  );
}
