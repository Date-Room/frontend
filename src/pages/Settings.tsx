import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Pencil,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { authClient } from "@/lib/authClient";
import { getMe, updateMe, type UserMe } from "@/lib/users";
import { applyThemePreference } from "@/lib/theme";
import { CardPage } from "@/components/CardPage";
import { PageShell } from "@/components/PageShell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { COUNTRIES, countryByCode, flagFor, type Country } from "@/lib/countries";

const MAX_PHOTO_BYTES = 750 * 1024;

/**
 * Profile page — redesigned to match mobile `profile_view.dart`.
 *
 * - Drops the loud display-name title; the page leads with the
 *   104pt avatar.
 * - Avatar has a thin border + accent-tinted pencil disc badge for
 *   edit (not the loud amber camera).
 * - Email under the avatar in small muted text.
 * - Grouped settings card with hairline-divided rows: Name + Country.
 *   Country row has flag + name + chevron.
 * - Country picker is a bottom sheet that stays under the status bar
 *   (max-height 80vh, doesn't push past the top).
 * - Save button below the card.
 * - Sign-out is a red text link at the bottom, not a primary CTA.
 */
export default function Settings() {
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [countryOpen, setCountryOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  // Hydrate the page from the server profile once. After that the
  // user's typing wins so a stale refetch doesn't clobber edits.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getMe();
        if (cancelled) return;
        setMe(profile);
        if (!hydrated) {
          setDisplayName(profile.display_name?.trim() || "");
          setCountryCode(profile.country ?? null);
          setAvatarUrl(profile.photo_url || null);
          setHydrated(true);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(silent = false) {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMe({
        display_name: displayName.trim() || undefined,
        country: countryCode ?? null,
        photo_url: avatarUrl,
      });
      setMe(updated);
      if (!silent) toast.success("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Use an image under 750 KB.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const updated = await updateMe({ photo_url: dataUrl });
        setMe(updated);
        setAvatarUrl(updated.photo_url || null);
        toast.success("Photo updated.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't upload photo.");
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setUploading(false);
      toast.error("Couldn't read the file.");
    };
    reader.readAsDataURL(file);
  }

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

  if (loading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-rosegold" aria-hidden />
      </PageShell>
    );
  }

  const initial = displayName?.[0]?.toUpperCase() || me?.email?.[0]?.toUpperCase() || "?";
  const country = countryByCode(countryCode);

  return (
    <CardPage title="Profile" onBack={() => navigate("/home")} maxWidth="sm:max-w-xl">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pickPhoto(f);
        }}
      />

      {/* ─── Avatar + email ─── */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="relative">
          <div className="h-[104px] w-[104px] overflow-hidden rounded-full border border-border bg-secondary/60">
            {avatarUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img src={avatarUrl} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-4xl text-primary">
                {initial}
              </div>
            )}
          </div>
          {/* Calmer accent-tinted edit pencil disc badge — not the loud amber camera. */}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:scale-105 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>
        </div>
        <p className="mt-2 truncate text-sm font-medium text-cream">
          {displayName || "Set a name"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
      </div>

      {/* ─── Settings group: Name + Country ─── */}
      <div className="mt-8 space-y-2">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Details
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          {/* Name row */}
          <div className="flex items-center px-4 py-3">
            <span className="w-20 shrink-0 text-sm text-muted-foreground">Name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="How they see you"
              className="flex-1 bg-transparent text-[15px] text-cream placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
          <div className="ml-4 h-px bg-border/60" />
          {/* Country row */}
          <button
            type="button"
            onClick={() => setCountryOpen(true)}
            className="flex w-full items-center px-4 py-3.5 text-left transition hover:bg-white/[0.025]"
          >
            <span className="w-20 shrink-0 text-sm text-muted-foreground">Country</span>
            {country && (
              <span className="mr-2 text-lg" aria-hidden>
                {flagFor(country.code)}
              </span>
            )}
            <span className={cn("flex-1 text-[15px]", country ? "text-cream" : "text-muted-foreground")}>
              {country?.name ?? "Tap to pick"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose">{error}</p>}

      <button
        type="button"
        onClick={() => void save(false)}
        disabled={saving}
        className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-[1.15rem] py-3.5 font-semibold disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Save
      </button>

      {/* Sign out — quiet red text link, not a primary CTA. */}
      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="rounded-full px-4 py-2 text-sm font-medium text-rose transition hover:bg-rose/10"
        >
          Sign out
        </button>
      </div>

      {/* Country picker — bottom sheet capped at 80vh, doesn't push
          past the status bar even with the keyboard up. */}
      <CountryPickerSheet
        open={countryOpen}
        onOpenChange={setCountryOpen}
        current={countryCode}
        onPick={(c) => {
          setCountryCode(c.code);
          setCountryOpen(false);
        }}
      />

      {/* Sign-out confirm */}
      <Sheet open={signOutOpen} onOpenChange={setSignOutOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#1A1410] border-white/10 rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle className="text-cream">Sign out?</SheetTitle>
          </SheetHeader>
          <p className="mt-2 text-sm text-muted-foreground">You can sign back in any time.</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setSignOutOpen(false)}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signOutBusy}
              className="rounded-full px-4 py-2 text-sm font-medium text-rose hover:bg-rose/10 disabled:opacity-50"
            >
              {signOutBusy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </CardPage>
  );
}

/* ─────────────────────── Country picker sheet ─────────────────────── */

function CountryPickerSheet({
  open,
  onOpenChange,
  current,
  onPick,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  current: string | null;
  onPick: (c: Country) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? COUNTRIES.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      )
    : COUNTRIES;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-[#1A1410] border-white/10 rounded-t-3xl max-h-[80vh] flex flex-col"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-cream">Country</SheetTitle>
        </SheetHeader>
        <div className="relative pb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            autoFocus
            className="focus-ring w-full rounded-xl border border-transparent bg-secondary/60 py-2.5 pl-10 pr-9 text-sm text-cream placeholder:text-muted-foreground/70 focus:border-primary/30"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="-mx-6 flex-1 overflow-y-auto">
          <ul className="px-2">
            {filtered.map((c) => {
              const selected = c.code === current;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      selected ? "bg-primary/15 text-cream" : "text-cream hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="text-lg" aria-hidden>{flagFor(c.code)}</span>
                    <span className="flex-1 text-[15px]">{c.name}</span>
                    <span className="text-[11px] tracking-wider text-muted-foreground">{c.code}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
