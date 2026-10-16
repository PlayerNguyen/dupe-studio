import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { defaultNS, resources, supportedLanguages } from "./resources";

/**
 * The configured i18next instance.
 *
 * Initialization is synchronous (`initAsync: false`) because the resources
 * are bundled, so translations are available on first render without Suspense.
 * The active language is detected from `localStorage` first and then the
 * browser/OS locale, and is cached back to `localStorage` when changed.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: "en",
    supportedLngs: [...supportedLanguages],
    load: "languageOnly",
    initAsync: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    react: {
      useSuspense: false,
    },
  });

export type { SupportedLanguage } from "./resources";
export { defaultNS, i18n, resources, supportedLanguages };
