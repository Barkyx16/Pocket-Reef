// Spanish locale. Keys mirror en.js exactly (t() falls back to English for any
// missing key). Add more locale files the same way and register them in i18n.js.
export default {
  tabs: { home: "Inicio", species: "Especies", tank: "Acuario", log: "Registro", games: "Juegos", journal: "Diario", health: "Salud", profile: "Perfil", premium: "Premium", more: "Más" },
  common: { language: "Idioma" },
  home: {
    eyebrow: "Tu arrecife de un vistazo",
    title: "Pocket Reef",
    sub: "Diseña un acuario donde cada pez, invertebrado y coral prospere junto.",
  },
  species: {
    eyebrow: "{count} especies",
    title: "Especies",
    sub: "Explora peces, invertebrados y corales. Toca ＋ para añadir a tu acuario.",
  },
  tank: {
    eyebrow: "{gallons} galones · {count} especies",
    title: "Mi Acuario",
    sub: "Todo lo que tienes — con la compatibilidad revisada en tiempo real.",
  },
  log: {
    eyebrowStreak: "Racha de {streak} días 🔥",
    eyebrowIdle: "Mantén tu acuario en marcha",
    title: "Registro",
    sub: "Analiza el agua y anota tu acuario — los dos hábitos que mantienen sano un arrecife.",
  },
  health: {
    eyebrow: "Salud de los peces",
    title: "Salud",
    sub: "Detecta y detén las enfermedades más comunes — toca cualquiera para la guía completa.",
  },
};
