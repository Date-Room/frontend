import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { applyDocumentLocale, getStoredLocale } from "@/lib/locale";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import ar from "./locales/ar.json";
import arMa from "./locales/ar-MA.json";

const stored = getStoredLocale();
applyDocumentLocale(stored);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
    "ar-MA": { translation: arMa },
  },
  lng: stored,
  fallbackLng: {
    "ar-MA": ["ar", "en"],
    default: ["en"],
  },
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  applyDocumentLocale(lng as "en" | "fr" | "ar" | "ar-MA");
});

export default i18n;
