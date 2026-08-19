import { getLocales } from "expo-localization";
import en from "./locales/en";
import es from "./locales/es";

// Minimal i18n, same shape as Pocket Planter's: t("a.b.c", params) resolves a
// dotted key from the active dictionary and interpolates {placeholders}. Add a
// locale file and register it here to grow coverage.
const DICTIONARIES = { en, es };
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];
let active = "en";

export function setLanguage(code) {
  if (DICTIONARIES[code]) active = code;
}

// What the module actually settled on, which is not always what it was handed.
// Callers hold a copy of this in React state; reading it back rather than
// echoing the input keeps the two from disagreeing when the input is rejected.
export function getLanguage() {
  return active;
}

export const isSupported = (code) => Boolean(DICTIONARIES[code]);

// The language this device is set to, if we have a dictionary for it.
//
// The app shipped Spanish and then defaulted every install to English, so the
// only way a Spanish speaker found it was by opening Profile and scrolling to a
// language row — in English. The phone already knows the answer; asking it is
// one call.
//
// Returns null rather than guessing when the device language isn't one we
// support, so the caller keeps its own default instead of falling back to a
// half-translated experience.
export function deviceLanguage() {
  try {
    const locales = getLocales();
    if (!Array.isArray(locales)) return null;
    // Locales come back most-preferred first; take the first we can actually
    // serve rather than only checking the top one.
    for (const l of locales) {
      const code = String((l && l.languageCode) || "").toLowerCase();
      if (isSupported(code)) return code;
    }
  } catch (e) { /* not available on every platform */ }
  return null;
}

export function t(key, params) {
  const dict = DICTIONARIES[active] || en;
  let value = key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);
  if (value == null) {
    // English fallback, then the raw key.
    value = key.split(".").reduce((o, k) => (o == null ? o : o[k]), en);
  }
  if (typeof value !== "string") return key;
  if (params) {
    for (const p of Object.keys(params)) value = value.replace(new RegExp(`\\{${p}\\}`, "g"), String(params[p]));
  }
  return value;
}

export function useTranslation() {
  return { t };
}
