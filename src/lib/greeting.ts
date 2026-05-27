/** Local-time greeting for dashboard hero (pass `now` updated on an interval so it tracks the clock). */
export function timeOfDayGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 22 || h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatHomeDate(now: Date = new Date(), locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}

/** First name for dashboard hero — from `full_name`, else email local-part. */
export function userFirstNameForGreeting(
  fullName: unknown,
  email: unknown,
  fallback = "there",
): string {
  if (typeof fullName === "string") {
    const first = fullName.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (typeof email === "string") {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return fallback;
}
