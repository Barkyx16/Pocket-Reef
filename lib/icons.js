// ─────────────────────────────────────────────────────────────────────────────
// Emoji → vector icon.
//
// Emoji are the right call for CONTENT — a species card, a mood in the journal,
// an achievement badge. They carry personality and they're the thing the user
// is actually looking at.
//
// As UI chrome they read as unfinished: they render differently on every
// platform, they can't take the accent colour, they sit off the optical
// baseline, and at small sizes they turn to mush. Section headers and the tab
// bar are chrome.
//
// This maps the emoji already used in card titles to Ionicons, so headers
// upgrade everywhere without rewriting 40 title strings. Anything unmapped
// falls back to the emoji, so nothing silently disappears.
// ─────────────────────────────────────────────────────────────────────────────
export const EMOJI_ICON = {
  "🧪": "flask-outline",
  "⚗️": "beaker-outline",
  "🔮": "trending-up-outline",
  "📈": "trending-up-outline",
  "📊": "stats-chart-outline",
  "📉": "trending-down-outline",
  "🗂️": "albums-outline",
  "✅": "checkmark-circle-outline",
  "❤️": "heart-outline",
  "📓": "book-outline",
  "🕰️": "time-outline",
  "⏳": "hourglass-outline",
  "🖼️": "images-outline",
  "📷": "camera-outline",
  "🚨": "warning-outline",
  "💡": "bulb-outline",
  "🧭": "compass-outline",
  "🧰": "construct-outline",
  "🛠️": "build-outline",
  "🩺": "medkit-outline",
  "💊": "medical-outline",
  "🩹": "bandage-outline",
  "📋": "clipboard-outline",
  "🎮": "game-controller-outline",
  "🎯": "locate-outline",
  "🐠": "fish-outline",
  "🌊": "water-outline",
  "💧": "water-outline",
  "🍤": "restaurant-outline",
  "🤝": "grid-outline",
  "✨": "sparkles-outline",
  "🌡️": "thermometer-outline",
  "🆕": "add-circle-outline",
  "🧮": "calculator-outline",
  "📦": "cube-outline",
  "🔁": "repeat-outline",
  "🔒": "lock-closed-outline",
  "⚡": "flash-outline",
  "👑": "star-outline",
  "☀️": "sunny-outline",
  "🌸": "flower-outline",
  "💰": "cash-outline",
  "🏆": "trophy-outline",
  "🔔": "notifications-outline",
  "☁️": "cloud-outline",
  "👤": "person-outline",
  "⚙️": "settings-outline",
  "🔍": "search-outline",
  "📅": "calendar-outline",
  "🧬": "git-branch-outline",
  "🌀": "refresh-outline",
  "🔄": "sync-outline",
  "🕒": "time-outline",
  "⏱️": "stopwatch-outline",
  "📥": "download-outline",
  "📤": "share-outline",
  "🛒": "cart-outline",
  "✍️": "create-outline",
  "🫧": "sparkles-outline",
  "🧹": "brush-outline",
  "🍽️": "restaurant-outline",
  "🪣": "water-outline",
  "📝": "create-outline",
  "🔬": "search-outline",
  "🐚": "shell-outline",
  "🌿": "leaf-outline",
  "🗓️": "calendar-outline",
  "💬": "chatbubble-outline",
};

// Returns an Ionicons name for a chrome emoji, or null to fall back.
export function iconForEmoji(emoji) {
  if (!emoji) return null;
  // Strip any variation selector so "❤️" and "❤" both resolve.
  const key = emoji.replace(/️/g, "");
  return EMOJI_ICON[emoji] || EMOJI_ICON[key] || null;
}
