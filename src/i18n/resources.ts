import { parse as parseJson5 } from "json5";
import enSource from "./locales/en.json5?raw";
import viSource from "./locales/vi.json5?raw";

/**
 * Default i18next namespace.
 *
 * The app ships a single `translation` namespace per language and groups keys
 * by area (`app.*`, `navigation.*`, `common.*`, `errors.*`) so one file stays
 * easy to scan.
 */
export const defaultNS = "translation";

/**
 * Language codes the app ships translations for.
 *
 * Add a code here and create the matching `locales/<code>.json5` file to
 * introduce a language.
 */
export const supportedLanguages = ["en", "vi"] as const;

/** Union of the language codes declared in {@link supportedLanguages}. */
export type SupportedLanguage = (typeof supportedLanguages)[number];

/**
 * Parsed translation resources.
 *
 * The locale files are JSON5 (comments, trailing commas, unquoted keys), which
 * Vite does not parse natively. They are imported as raw text (`?raw`) and run
 * through `json5.parse` here, then bundled as plain objects. Static bundling
 * keeps initialization synchronous and lets the desktop app translate while
 * offline.
 */
export const resources = {
  en: { translation: parseJson5(enSource) },
  vi: { translation: parseJson5(viSource) },
} as const;
