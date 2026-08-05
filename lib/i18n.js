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
