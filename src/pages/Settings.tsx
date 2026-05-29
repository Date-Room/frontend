import { Camera, ChevronRight, Globe, LogOut, Shield, User, Loader2 } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { authClient } from "@/lib/authClient";
import { getMe, updateMe, type UserMe } from "@/lib/users";
import { applyThemePreference } from "@/lib/theme";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { CardPage } from "@/components/CardPage";

const MAX_PHOTO_BYTES = 750 * 1024;

const COMMON_COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "IE", label: "Ireland" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "JP", label: "Japan" },
];

/**
 * Profile — matches mobile's `profile_view.dart`: display name, photo, country.
 * No theme/notifications toggles (mobile doesn't have them). Saves to
 * `/v1/users/me`.
 */
export default function Settings() {
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("US");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [countryDialogOpen, setCountryDialogOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  function hydrate(profile: UserMe) {
    setMe(profile);
    setDisplayName(profile.display_name?.trim() || profile.email?.split("@")[0] || "");
    setCountry(profile.country ?? "US");
    setAvatarUrl(profile.photo_url && profile.photo_url.length > 0 ? profile.photo_url : null);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getMe();
        if (!cancelled) hydrate(profile);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    setSignOutBusy(true);
    try {
      await authClient.signOut();
      applyThemePreference("dark");
      navigate("/");
    } finally {
      setSignOutBusy(false);
    }
  }

  async function editDisplayName() {
    const name = window.prompt("Display name", displayName);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Display name can't be empty.");
      return;
    }
    try {
      hydrate(await updateMe({ display_name: trimmed }));
      toast.success("Saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update name.");
    }
  }

  async function persistCountry(code: string) {
    try {
      hydrate(await updateMe({ country: code }));
      toast.success("Saved.");
      setCountryDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save country.");
    }
  }

  async function removePhoto() {
    try {
      hydrate(await updateMe({ photo_url: null }));
      toast.success("Photo removed.");
      setPhotoDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove photo.");
    }
  }

  function pickOtherCountry() {
    const raw = window.prompt("Enter a 2-letter country code (e.g. ES)");
    if (raw === null) return;
    const code = raw.trim().toUpperCase().slice(0, 2);
    if (!/^[A-Z]{2}$/.test(code)) {
      toast.error("Use exactly two letters, e.g. ES or BR.");
      return;
    }
    void persistCountry(code);
  }

  async function onPhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      setPhotoDialogOpen(false);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Use an image under 750 KB.");
      setPhotoDialogOpen(false);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        hydrate(await updateMe({ photo_url: reader.result as string }));
        toast.success("Photo updated.");
        setPhotoDialogOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not upload photo.");
      }
    };
    reader.readAsDataURL(file);
  }

  if (loading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-rosegold animate-spin" aria-hidden />
        <span className="sr-only">Loading profile</span>
      </PageShell>
    );
  }

  const initial = displayName[0]?.toUpperCase() || "?";

  return (
    <CardPage title="Profile" onBack={() => navigate("/home")} maxWidth="sm:max-w-2xl">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" aria-label="Upload profile photo" onChange={onPhotoFileChange} />

      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="sm:rounded-2xl border-white/10 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-cream">Profile photo</DialogTitle>
            <DialogDescription>Upload a small portrait (under 750 KB).</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button type="button" variant="outline" className="rounded-xl border-white/10" onClick={() => photoInputRef.current?.click()}>
              Upload photo
            </Button>
            {avatarUrl ? (
              <Button type="button" variant="destructive" className="rounded-xl" onClick={() => void removePhoto()}>
                Remove photo
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={countryDialogOpen} onOpenChange={setCountryDialogOpen}>
        <DialogContent className="sm:rounded-2xl border-white/10 bg-card/95 backdrop-blur-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-cream">Country</DialogTitle>
            <DialogDescription>Choose your region (ISO two-letter code).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {COMMON_COUNTRIES.map(({ code, label }) => (
              <Button
                key={code}
                type="button"
                variant={country === code ? "default" : "outline"}
                className={`rounded-xl justify-start text-left h-auto py-3 px-3 ${country === code ? "" : "border-white/10"}`}
                onClick={() => void persistCountry(code)}
              >
                <span className="block text-xs font-medium">{label}</span>
                <span className="block text-[10px] text-muted-foreground">{code}</span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="rounded-xl" onClick={pickOtherCountry}>
              Other country…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="editorial-card grain mb-8 flex items-center gap-4 p-5 sm:p-6 animate-float-up">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-rosegold/20 shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rosegold/30 to-romantic/30 border-2 border-rosegold/20 flex items-center justify-center text-2xl font-serif text-cream shrink-0">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-cream truncate">{displayName}</h2>
          <p className="text-xs text-muted-foreground truncate">{me?.email}</p>
        </div>
      </div>

      <div className="mb-6 animate-float-up">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">Profile</h3>
        <div className="editorial-card overflow-hidden divide-y divide-white/[0.06]">
          <button type="button" onClick={() => void editDisplayName()} className="focus-ring w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition text-left">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm text-cream">Display name</span>
            <span className="text-xs text-muted-foreground truncate max-w-[40%]">{displayName}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          </button>
          <button type="button" onClick={() => setPhotoDialogOpen(true)} className="focus-ring w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition text-left">
            <Camera className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm text-cream">Profile photo</span>
            <span className="text-xs text-muted-foreground">{avatarUrl ? "Change or remove" : "Add photo"}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          </button>
          <button type="button" onClick={() => setCountryDialogOpen(true)} className="focus-ring w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition text-left">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm text-cream">Country</span>
            <span className="text-xs text-muted-foreground">{country}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          </button>
        </div>
      </div>

      <div className="mb-6 animate-float-up">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">Account</h3>
        <div className="editorial-card overflow-hidden divide-y divide-white/[0.06]">
          <button type="button" onClick={() => navigate("/privacy")} className="focus-ring w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition text-left">
            <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm text-cream">Privacy &amp; safety</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          </button>
        </div>
      </div>

      <div className="mt-10">
        <button
          type="button"
          disabled={signOutBusy}
          onClick={() => void handleSignOut()}
          className="editorial-card hover-lift focus-ring w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-60"
        >
          {signOutBusy ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" /> : <LogOut className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="text-sm text-cream">{signOutBusy ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>

        <p className="text-center text-[10px] text-muted-foreground mt-10">{BRAND_NAME} · Made with ❤️</p>
    </CardPage>
  );
}
