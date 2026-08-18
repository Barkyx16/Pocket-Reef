import { Dimensions, StyleSheet, useWindowDimensions } from "react-native";

// ── Large screens ────────────────────────────────────────────────────────────
// app.json sets supportsTablet, so this already ships on iPad — where a
// phone layout simply stretches, giving 1000px-wide cards and lines of text
// far too long to read comfortably. Capping the content column and centring it
// keeps the design at the width it was drawn for, with the background filling
// the rest.
const { width: SCREEN_W } = Dimensions.get("window");
export const LARGE_SCREEN_BREAKPOINT = 768;
export const CONTENT_MAX_WIDTH = 700;
// Room for two 700-ish columns plus the gap between them. Used once the content
// reflows rather than stretching, so a tablet fills its screen instead of
// showing a phone layout down the middle.
export const TWO_COLUMN_MAX_WIDTH = 1180;

// StyleSheet is built once, so this snapshot is only a sensible starting point.
// It is wrong the moment the device rotates, an iPad enters split view, or a
// foldable opens — use useResponsiveLayout() in components that must react.
export const IS_LARGE_SCREEN = SCREEN_W >= LARGE_SCREEN_BREAKPOINT;

// Ocean/reef design system — deep teal-on-navy "glass". Same design language as
// Pocket Planter (rounded glass cards, accent glow, floating tab bar), recolored
// for reef water and refined with a consistent token set, elevation, and type
// scale. Colors, spacing, and radii are tokenized so the whole app moves together.
export const theme = {
  background: "#061826",
  // Dark tint, not a white wash. At 5.5% white over a bright reef photo the
  // "glass" was effectively transparent and body copy sat directly on coral —
  // legible over the dark water, unreadable over the pale sand.
  card: "rgba(9, 30, 45, 0.72)",
  cardSolid: "#0c2739",
  well: "#0a2334",
  border: "rgba(96, 230, 210, 0.16)",
  hairline: "rgba(255, 255, 255, 0.07)",
  text: "#eaf7ff",
  // Body prose. The old secondaryText sat at 42% saturation against accents
  // running 74-79%, which is what made the app read dull — it was never a
  // contrast problem (it measured 8.5:1, comfortably past AA). This is
  // brighter AND far more saturated: 12.6:1 at 78%.
  bodyText: "#cfeaf9",
  // Genuine secondary information — timestamps, units, hints. Still clearly
  // subordinate to bodyText, but no longer grey.
  secondaryText: "#a5d4ea",
  accent: "#38e1c6", // teal
  accentLight: "#7ff0dd",
  accentDeep: "#1fb6a0",
  coral: "#ff8a6a",
  warn: "#ffd372",
  danger: "#ff7b7b",
  // Text and icons that sit ON the accent colour. Twenty components had this
  // hex inline; it is a real token — the one colour guaranteed readable on
  // teal — and it belongs with the others.
  onAccent: "#04202a",
  // A muted slate for de-emphasised chrome, distinct from secondaryText, which
  // is blue-tinted body copy.
  muted: "#8a9bb0",
  glow: "rgba(56,225,198,0.45)",
  isDark: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// The design scales.
//
// Before these existed the app used 17 distinct border radii (7, 9, 11, 13, 15,
// 18, …) and 23 distinct opacities of the same teal — 0.28, 0.3, 0.30, 0.32,
// 0.34 and 0.35 all appearing for the same job. None of that is visible as a
// bug in any single screen; together it's exactly what makes an interface read
// as "almost right" instead of finished.
//
// Seven steps each, chosen so the common existing values stayed put and only
// the one-offs moved.
// ─────────────────────────────────────────────────────────────────────────────
export const radius = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  card: 22,
  sheet: 26,
  pill: 999,
};

// Tints of the accent, by the job they do rather than by number — `tint.fill`
// says what it's for in a way `rgba(56,225,198,0.14)` never can.
export const tint = {
  faint: "rgba(56,225,198,0.04)",
  glass: "rgba(56,225,198,0.08)",
  subtle: "rgba(56,225,198,0.10)",
  fill: "rgba(56,225,198,0.14)",
  strong: "rgba(56,225,198,0.18)",
  border: "rgba(56,225,198,0.30)",
  borderStrong: "rgba(56,225,198,0.42)",
};

// Accent gradient stops, reused by buttons, bars, and rings.
export const accentGradient = ["#7ff0dd", "#38e1c6", "#1fb6a0"];

// 4pt spacing scale.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

const ACCENT = theme.accent;
const ACCENT_LIGHT = theme.accentLight;

export const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Clears the tab bar *and* the floating quick-action button above it. At the
  // old 132 the FAB sat on top of the last card's controls.
  scroll: { padding: 16, paddingBottom: 168 },

  // ── Hero banner (per-tab header) ───────────────────────────────────────────
  heroBanner: { borderRadius: 24, padding: 20, marginBottom: 16, overflow: "hidden", justifyContent: "flex-end", minHeight: 128, borderWidth: 1, borderColor: "rgba(127, 240, 221, 0.22)", shadowColor: "#000", shadowOpacity: 0.26, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroEyebrowPill: { alignSelf: "flex-start", backgroundColor: "rgba(127, 240, 221, 0.16)", borderColor: "rgba(127, 240, 221, 0.35)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  heroEyebrow: { color: ACCENT_LIGHT, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  heroTitle: { color: "#ffffff", fontSize: 28, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.7, marginTop: 2 },
  heroSub: { color: "#cfe6f2", fontSize: 13.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: 6, lineHeight: 19 },

  // ── Profile hero (uncropped banner art + solid info panel below) ───────────
  profileHero: { borderRadius: 28, marginBottom: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(127, 240, 221, 0.22)", backgroundColor: "#082031", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  profileHeroPanel: { padding: 18, backgroundColor: "#0a2233", borderTopWidth: 1, borderTopColor: "rgba(127, 240, 221, 0.18)" },
  profileHeroName: { flexShrink: 1, color: "#ffffff", fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4 },
  profileHeroBannerPill: { backgroundColor: "rgba(127, 240, 221, 0.16)", borderColor: "rgba(127, 240, 221, 0.35)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: "50%" },
  profileHeroBannerPillText: { color: ACCENT_LIGHT, fontSize: 11, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  profileHeroLevelBadge: { width: 54, height: 54, borderRadius: 16, backgroundColor: "rgba(6,20,32,0.55)", borderWidth: 1, borderColor: "rgba(56,225,198,0.45)", alignItems: "center", justifyContent: "center" },

  // ── Card (glass chrome) ────────────────────────────────────────────────────
  card: { backgroundColor: theme.card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: theme.border, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  // A primary/feature card with a soft accent glow to draw the eye.
  cardElevated: { backgroundColor: "rgba(56,225,198,0.04)", borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", shadowColor: ACCENT, shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardEyebrow: { fontSize: 11.5, fontFamily: "Inter_900Black", fontWeight: "900", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7, color: ACCENT_LIGHT },
  cardTitle: { fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4, color: "#ffffff" },
  cardText: { marginTop: 8, fontSize: 14, lineHeight: 22, color: theme.bodyText, fontFamily: "Inter_400Regular" },
  iconSquare: { width: 32, height: 32, borderRadius: 10, marginRight: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.18)" },
  primaryFeatureAccentBar: { height: 4, width: 44, borderRadius: 999, backgroundColor: ACCENT, marginBottom: 12 },

  // ── Species / list row (glass) ─────────────────────────────────────────────
  listGap: { gap: 12 },
  cleanRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(9, 30, 45, 0.66)", borderRadius: 20, padding: 12, borderWidth: 1, borderColor: "rgba(96, 230, 210, 0.16)", marginBottom: 12 },
  cleanImageWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.well, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: theme.hairline },
  cleanImage: { width: 56, height: 56 },
  cleanEmoji: { fontSize: 28 },
  cleanName: { color: "#ffffff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.2 },
  cleanMeta: { color: theme.secondaryText, fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: 4 },
  cleanArrow: { color: ACCENT_LIGHT, fontSize: 28, fontFamily: "Inter_900Black", fontWeight: "900" },

  // ── Chips & pills ──────────────────────────────────────────────────────────
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 10, fontFamily: "Inter_900Black", fontWeight: "900" },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },

  // ── Buttons ──────────────────────────────────────────────────────────────
  primaryBtn: { backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 14, alignItems: "center", shadowColor: ACCENT, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  primaryBtnText: { color: "#04202a", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.2 },
  ghostBtn: { borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border },
  ghostBtnText: { color: ACCENT, fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.2 },

  // ── Stat tiles ─────────────────────────────────────────────────────────────
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  statBox: { flexGrow: 1, minWidth: "45%", backgroundColor: "rgba(56,225,198,0.06)", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "rgba(56,225,198,0.14)" },
  statLabel: { color: theme.secondaryText, fontSize: 11, fontFamily: "Inter_800ExtraBold", fontWeight: "800", letterSpacing: 0.2 },
  statValue: { color: "#ffffff", fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 4, fontVariant: ["tabular-nums"] },

  // ── Search input ───────────────────────────────────────────────────────────
  search: { fontFamily: "Inter_400Regular", backgroundColor: theme.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 15 },

  // ── Detail ─────────────────────────────────────────────────────────────────
  detailHeroWrap: { alignItems: "center", paddingVertical: 12 },
  detailImageWrap: { width: 136, height: 136, borderRadius: 30, backgroundColor: theme.well, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", shadowColor: ACCENT, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  detailEmoji: { fontSize: 68 },
  detailName: { color: "#ffffff", fontSize: 27, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.5, marginTop: 12, textAlign: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 4 },
  backText: { color: ACCENT, fontSize: 16, fontFamily: "Inter_900Black", fontWeight: "900" },

  // ── Auth (sign in / sign up) ───────────────────────────────────────────────
  authInput: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 15, fontFamily: "Inter_700Bold", fontWeight: "700", paddingHorizontal: 16, paddingVertical: 14 },
  authLinkBtn: { paddingVertical: 12, alignItems: "center" },
  authLinkText: { color: ACCENT, fontSize: 13.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800" },
  authError: { color: theme.danger, fontSize: 12.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18, marginTop: 10 },
  authNotice: { color: ACCENT_LIGHT, fontSize: 12.5, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18, marginTop: 10 },

  // ── Account / cloud card ───────────────────────────────────────────────────
  accountInfoBox: { backgroundColor: theme.well, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 10 },
  accountInfoLabel: { color: ACCENT_LIGHT, fontSize: 10.5, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  accountInfoValue: { color: "#ffffff", fontSize: 15, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: 4 },
  // Hairline separator between two merged sections inside one card.
  sectionDivider: { height: 1, backgroundColor: theme.hairline, marginVertical: 18 },
  accountSignOutBtn: { borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border, marginTop: 10 },
  accountSignOutText: { color: "#ffffff", fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" },
  accountDangerBtn: { borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: "rgba(255,123,123,0.08)", borderWidth: 1, borderColor: "rgba(255,123,123,0.45)", marginTop: 10 },
  accountDangerText: { color: theme.danger, fontSize: 14, fontFamily: "Inter_900Black", fontWeight: "900" },

  // ── Floating bottom tab bar ────────────────────────────────────────────────
  bottomTabs: { position: "absolute", left: 8, right: 8, bottom: 16, flexDirection: "row", backgroundColor: "rgba(7, 24, 38, 0.92)", borderRadius: 22, padding: 6, borderWidth: 1, borderColor: "rgba(127, 240, 221, 0.12)", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
  bottomTabButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 16, gap: 4 },
  // A tinted well rather than a filled, glowing capsule. The active tab should
  // be obvious at a glance without being the brightest thing on the screen.
  bottomTabButtonActive: { backgroundColor: "rgba(56,225,198,0.14)" },
  bottomTabEmoji: { fontSize: 20 },
  bottomTabLabel: { fontSize: 10, fontFamily: "Inter_800ExtraBold", fontWeight: "800", color: "#7ea6bd" },
  bottomTabLabelActive: { color: ACCENT },
});


// Live layout, re-evaluated on every resize/rotation.
//
// The static IS_LARGE_SCREEN above can only ever describe the app's state at
// launch. Anything that changes shape with the window should read this instead.
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isLarge = width >= LARGE_SCREEN_BREAKPOINT;
  return {
    width,
    height,
    isLarge,
    isLandscape: width > height,
    // Drop-in for styles.scroll on screens that need to react live.
    contentStyle: isLarge ? { maxWidth: CONTENT_MAX_WIDTH, width: "100%", alignSelf: "center" } : null,
  };
}
