import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Camera, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { CardPage } from "@/components/CardPage";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { authClient } from "@/lib/authClient";
import { getMe, updateMe, type UserMe } from "@/lib/users";

const MAX_PHOTO_BYTES = 750 * 1024;

/** Compress a File into a base64 data URL ≤ MAX_PHOTO_BYTES. Mirrors
 *  Settings's photo upload logic so the profile-row stays small. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

/**
 * First-run profile gate.
 *
 * The AuthGuard funnels users here once signed in if their backend
 * profile_complete flag is false (missing display name OR not
 * age-verified). Photo is optional — every other field is required.
 *
 * After PATCH /users/me, we refresh the cached auth session so the
 * guard stops routing the user back here, then push them on to
 * the original target via ?next= (defaults to /home).
 */
export default function ProfileComplete() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/home";
  const photoInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [me, setMe] = useState<UserMe | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getMe();
        if (cancelled) return;
        setMe(profile);
        setDisplayName(
          profile.display_name?.trim() ||
            profile.email?.split("@")[0] ||
            "",
        );
        setPhotoUrl(profile.photo_url);
      } catch {
        /* surface generic state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initial = (displayName || me?.email || "?")[0]?.toUpperCase();

  async function onPickPhoto(file: File) {
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo's too big — pick one under 750 KB.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhotoUrl(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load that photo.");
    }
  }

  const canSubmit =
    !busy && displayName.trim().length >= 1 && confirmAdult;

  async function handleSave() {
    setBusy(true);
    try {
      await updateMe({
        display_name: displayName.trim(),
        photo_url: photoUrl ?? null,
        confirm_adult: true,
      });
      // Sync the cached session.user so AuthGuard's profile_complete
      // check stops routing us back here AND so the freshly-saved
      // display name shows up on Home/Settings without waiting for
      // a window reload.
      await authClient.refreshUser();
      // Invalidate the react-query 'me' cache so any consumer that
      // reads from getMe() (Home avatar, Settings, profile menu)
      // refetches the new display_name + photo_url on next render.
      queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate(next, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <CardPage maxWidth="sm:max-w-md">
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
        </div>
      </CardPage>
    );
  }

  return (
    <CardPage
      title="A few quick things"
      maxWidth="sm:max-w-md"
      bodyClassName="animate-float-up space-y-6"
    >
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Profile photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickPhoto(f);
        }}
      />

      <p className="text-sm text-muted-foreground leading-relaxed">
        Set your display name and confirm you're an adult. A photo is optional
        — you can always add one later in Settings.
      </p>

      {/* Photo */}
      <section className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          aria-label="Pick a profile photo"
          className="focus-ring relative h-24 w-24 rounded-full overflow-hidden border-2 border-rosegold/25 bg-gradient-to-br from-rosegold/30 to-romantic/20 flex items-center justify-center text-3xl font-serif text-cream transition hover:border-rosegold/55"
        >
          <UserAvatarImg
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover"
            fallback={<span>{initial}</span>}
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] uppercase tracking-[0.2em] text-cream">
            <Camera className="h-3 w-3" /> {photoUrl ? "Change" : "Add"}
          </span>
        </button>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
          Optional
        </p>
      </section>

      {/* Display name */}
      <section className="space-y-1.5">
        <label
          htmlFor="pc-name"
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
        >
          <UserIcon className="h-3 w-3" /> Display name
        </label>
        <input
          id="pc-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="What should they call you?"
          maxLength={30}
          autoComplete="given-name"
          className="auth-input focus-ring"
          required
        />
      </section>

      {/* Age confirmation */}
      <section>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmAdult}
            onChange={(e) => setConfirmAdult(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-rosegold/30 bg-transparent text-rosegold focus-ring"
          />
          <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-cream/90 transition-colors">
            I confirm I am 18 years of age or older.
          </span>
        </label>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSubmit}
        className="btn-primary focus-ring w-full py-4 rounded-[1.15rem] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          "Continue"
        )}
      </button>

      <p className="text-center text-[10px] tracking-[0.25em] uppercase text-muted-foreground/40">
        <Link to="/privacy" className="hover:text-cream transition-colors">Privacy</Link>
        <span className="mx-2 opacity-60" aria-hidden>·</span>
        <Link to="/terms" className="hover:text-cream transition-colors">Terms</Link>
      </p>
    </CardPage>
  );
}
