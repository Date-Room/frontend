import { useState, type ImgHTMLAttributes } from "react";

/**
 * Drop-in replacement for `<img>` used to render *user-supplied* photo URLs
 * (profile / partner avatars).
 *
 * Two things the raw `<img>` was missing:
 *
 *  1. **`referrerPolicy="no-referrer"`** — Google's
 *     `lh3.googleusercontent.com` CDN (returned by Google OAuth as the
 *     `picture` claim, e.g.
 *     `https://lh3.googleusercontent.com/a/...=s96-c`) rejects requests
 *     whose `Referer` header points to a non-Google origin. With the
 *     default browser referrer policy the image silently 403s and we
 *     get a broken-image placeholder. Mobile didn't hit this because
 *     Flutter's `NetworkImage` doesn't send a `Referer`.
 *
 *  2. **`onError` → render fallback** — when a URL legitimately 404s
 *     (deleted user, rotated CDN URL), callers want to fall back to
 *     initials/glyph rather than show the broken-image icon. Callers
 *     pass the fallback as `fallback` and we render it whenever the
 *     image load errors.
 *
 * Works with both regular HTTPS URLs and `data:image/jpeg;base64,…`
 * URIs (Settings/ProfileComplete upload paths), so callers can use it
 * everywhere without branching.
 */
export function UserAvatarImg({
  src,
  fallback,
  className,
  alt = "",
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  /** Rendered when src is empty OR the image fails to load. */
  fallback: React.ReactNode;
}) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}
