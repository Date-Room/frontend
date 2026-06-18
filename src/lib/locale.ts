/** Supported UI locales. `ar-MA` uses Moroccan Darija copy where provided. */
export type AppLocale = "en" | "fr" | "ar" | "ar-MA";

export const LOCALE_STORAGE_KEY = "dr.locale";

export const APP_LOCALES: {
  code: AppLocale;
  /** English label for the picker */
  label: string;
  /** Native label shown in the picker */
  nativeLabel: string;
  rtl: boolean;
}[] = [
  { code: "en", label: "English", nativeLabel: "English", rtl: false },
  { code: "fr", label: "French", nativeLabel: "Français", rtl: false },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", rtl: true },
  { code: "ar-MA", label: "Darija (Morocco)", nativeLabel: "الدارجة", rtl: true },
];

export function isRtlLocale(locale: string): boolean {
  return locale === "ar" || locale === "ar-MA" || locale.startsWith("ar");
}

export function getStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && APP_LOCALES.some((l) => l.code === raw)) return raw as AppLocale;
  } catch {
    /* ignore */
  }
  return "en";
}

export function setStoredLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function applyDocumentLocale(locale: AppLocale): void {
  const lang = locale === "ar-MA" ? "ar-MA" : locale;
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
}
