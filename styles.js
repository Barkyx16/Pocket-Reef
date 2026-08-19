import { Dimensions, StyleSheet, useWindowDimensions } from "react-native";

// ── Large screens ────────────────────────────────────────────────────────────
// app.json sets supportsTablet, so this already ships on iPad — where a
// phone layout simply stretches, giving 1000px-wide cards and lines of text
// far too long to read comfortably. Capping the content column and centring it
// keeps the design at the width it was drawn for, with the background filling
// the rest.
const { width: SCREEN_W } = Dimensions.get("window");
// 740, not 768. The classic 768 comes from the original non-retina iPad and
// leaves the iPad mini out: it is 744pt across in portrait, so it got the phone
// layout standing up and the tablet layout lying down — rotating it changed the
// whole design rather than the shape of it.
//
// There is 314pt of empty space between the widest phone in portrait (430) and
// the narrowest iPad (744), so this boundary has an enormous margin either way
// and no phone can drift across it.
export const LARGE_SCREEN_BREAKPOINT = 740;
export const CONTENT_MAX_WIDTH = 700;
// Room for two 700-ish columns plus the gap between them. Used once the content
// reflows rather than stretching, so a tablet fills its screen instead of
// showing a phone layout down the middle.
export const TWO_COLUMN_MAX_WIDTH = 1180;

// ── The scales ───────────────────────────────────────────────────────────────
//
// Measured before this existed: 37 distinct font sizes, 27 border radii and 22
// spacing values across the app. Thirteen of the font sizes sat between 9 and
// 15pt — thirteen different answers to "small text", including seven
// half-points, across 768 uses. That is not a type scale, it is the residue of
// nudging one screen at a time until it looked right, and it is the difference
// between a design that was drawn and one that accumulated.
//
// These are the sizes to reach for. They are deliberately few: a scale with a
// step for every occasion is the same as no scale, because nothing forces a
// decision about hierarchy.
//
// Adopting them wholesale is a visual change that wants eyes on a device, so
// this is the vocabulary rather than a completed migration. What HAS been done
// is the half-points: those moved by at most 0.5pt, which no one can see, and
// they were the clearest sign that nobody was working from a scale.
export const type = {
  micro: 10,    // timestamps, unit suffixes, badge counts
  caption: 11,  // eyebrows, pill labels, secondary metadata
  small: 12,    // dense list rows, hints
  body: 13,     // the app's default reading size
  bodyLg: 15,   // card body copy that needs to breathe
  title: 17,    // card titles
  titleLg: 20,  // screen and sheet titles
  headline: 24, // hero headings
  display: 30,  // the single biggest number on a card
  hero: 40,     // splash and empty-state figures
};

// Three levels, so depth means something. The app draws on a dark ground where
// a shadow reads as glow more than as lift, which is why these are restrained.
// Optical tracking, keyed to size.
//
// Type set at one tracking for every size is type nobody adjusted. Letterforms
// need air at caption sizes and need it taken away at display sizes: 40pt set
// at default spacing reads loose and unresolved, which is the single most
// recognisable mark of an interface that was assembled rather than designed.
//
// Measured before this: 57 styles at 20pt and above had no tracking at all,
// while the ones that did were arbitrary — 10pt alone carried +0.3, +0.4, +0.5,
// +0.6, +0.7 and +0.8, six answers to one question.
//
// Small text opens up, large text closes in, and the crossover is body size
// where the font's own metrics are already right.
export function tracking(size) {
  if (!Number.isFinite(size)) return 0;
  if (size <= 11) return 0.6;    // uppercase eyebrows, pill labels
  if (size <= 15) return 0;      // body — leave the typeface alone
  if (size <= 20) return -0.2;
  if (size <= 30) return -0.4;
  if (size <= 44) return -0.6;
  return -1;                     // display figures
}

// Three levels, taken from values already in the app rather than invented, so
// the most common surface — the card — does not move at all. Five hand-rolled
// recipes collapse onto these: the hero banner and the card were within 0.04
// opacity of each other and were never going to read as different heights.
export const elevation = {
  none: {},
  // Every card, and anything that sits flat on the background.
  card: { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  // The one element per screen that is the screen's subject.
  hero: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  // Genuinely above the page: the tab bar, the undo snackbar.
  floating: { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
};

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

// ── Spacing rhythm ───────────────────────────────────────────────────────────
//
// A 4pt grid, plus one hairline step. Measured before adopting it: 1,620
// spacing values across 22 distinct numbers, including 1, 2.5, 5, 7, 9, 11 and
// 13 — the fingerprints of nudging a gap until it looked right rather than
// choosing from a set. Rhythm is what makes a layout feel deliberate, and there
// is none when every gap is its own number.
//
// `hair` is 2 and exists on purpose: optical alignment sometimes needs a nudge
// smaller than the grid, and 63 margins were already using it for exactly that.
// Rounding those up to 4 would have doubled them.
//
// The scale stops at 32. Values above it are structural — a hero's inset, a
// modal's top offset — and are not part of a rhythm; snapping them to the top
// step would be a layout change dressed up as consistency.
export const space = {
  hair: 2,   // optical nudges, not layout
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  huge: 32,
};

const ACCENT = theme.accent;
const ACCENT_LIGHT = theme.accentLight;

export const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Clears the tab bar *and* the floating quick-action button above it. At the
  // old 132 the FAB sat on top of the last card's controls.
  //
  // 186 rather than 168 because the bar now sits above the home indicator
  // instead of inside it, which raises its top edge by the 18pt difference.
  // Devices without an indicator get 18pt of empty space below the last card,
  // which nobody will ever notice; the alternative is the FAB back on top of
  // the last card's controls on every iPhone that has one.
  scroll: { padding: space.lg, paddingBottom: 186 },

  // ── Hero banner (per-tab header) ───────────────────────────────────────────
  heroBanner: { borderRadius: 24, padding: space.xl, marginBottom: space.lg, overflow: "hidden", justifyContent: "flex-end", minHeight: 128, borderWidth: 1, borderColor: "rgba(127, 240, 221, 0.22)", ...elevation.card },
  heroEyebrowPill: { alignSelf: "flex-start", backgroundColor: "rgba(127, 240, 221, 0.16)", borderColor: "rgba(127, 240, 221, 0.35)", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, marginBottom: space.md },
  heroEyebrow: { color: ACCENT_LIGHT, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  heroTitle: { color: "#ffffff", fontSize: 28, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4, marginTop: space.hair },
  heroSub: { color: "#cfe6f2", fontSize: type.body, fontFamily: "Inter_600SemiBold", fontWeight: "600", marginTop: space.sm, lineHeight: 19 },

  // ── Profile hero (uncropped banner art + solid info panel below) ───────────
  profileHero: { borderRadius: 28, marginBottom: space.xl, overflow: "hidden", borderWidth: 1, borderColor: "rgba(127, 240, 221, 0.22)", backgroundColor: "#082031", ...elevation.hero },
  profileHeroPanel: { padding: space.xl, backgroundColor: "#0a2233", borderTopWidth: 1, borderTopColor: "rgba(127, 240, 221, 0.18)" },
  profileHeroName: { flexShrink: 1, color: "#ffffff", fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4 },
  profileHeroBannerPill: { backgroundColor: "rgba(127, 240, 221, 0.16)", borderColor: "rgba(127, 240, 221, 0.35)", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, maxWidth: "50%" },
  profileHeroBannerPillText: { color: ACCENT_LIGHT, fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  profileHeroLevelBadge: { width: 54, height: 54, borderRadius: radius.xl, backgroundColor: "rgba(6,20,32,0.55)", borderWidth: 1, borderColor: "rgba(56,225,198,0.45)", alignItems: "center", justifyContent: "center" },

  // ── Card (glass chrome) ────────────────────────────────────────────────────
  card: { backgroundColor: theme.card, borderRadius: radius.card, padding: space.xl, marginBottom: space.lg, borderWidth: 1, borderColor: theme.border, ...elevation.card },
  // A primary/feature card with a soft accent glow to draw the eye.
  cardElevated: { backgroundColor: "rgba(56,225,198,0.04)", borderRadius: radius.card, padding: space.lg, marginBottom: space.lg, borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", shadowColor: ACCENT, shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md },
  cardEyebrow: { fontSize: type.caption, fontFamily: "Inter_700Bold", fontWeight: "700", marginBottom: space.sm, textTransform: "uppercase", letterSpacing: 0.6, color: ACCENT_LIGHT },
  cardTitle: { fontSize: 22, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4, color: "#ffffff" },
  cardText: { marginTop: space.sm, fontSize: type.body, lineHeight: 22, color: theme.bodyText, fontFamily: "Inter_400Regular" },
  iconSquare: { width: 32, height: 32, borderRadius: radius.sm, marginRight: space.md, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(56,225,198,0.14)", borderWidth: 1, borderColor: "rgba(56,225,198,0.18)" },
  primaryFeatureAccentBar: { height: 4, width: 44, borderRadius: radius.pill, backgroundColor: ACCENT, marginBottom: space.md },

  // ── Species / list row (glass) ─────────────────────────────────────────────
  listGap: { gap: space.md },
  cleanRow: { flexDirection: "row", alignItems: "center", gap: space.lg, backgroundColor: "rgba(9, 30, 45, 0.66)", borderRadius: 20, padding: space.md, borderWidth: 1, borderColor: "rgba(96, 230, 210, 0.16)", marginBottom: space.md },
  cleanImageWrap: { width: 56, height: 56, borderRadius: radius.xl, backgroundColor: theme.well, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: theme.hairline },
  cleanImage: { width: 56, height: 56 },
  cleanEmoji: { fontSize: 28, letterSpacing: -0.4 },
  cleanName: { color: "#ffffff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0 },
  cleanMeta: { color: theme.secondaryText, fontSize: type.small, fontFamily: "Inter_700Bold", fontWeight: "700", marginTop: space.xs },
  cleanArrow: { color: ACCENT_LIGHT, fontSize: 28, letterSpacing: -0.4, fontFamily: "Inter_900Black", fontWeight: "900" },

  // ── Chips & pills ──────────────────────────────────────────────────────────
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_700Bold", fontWeight: "700" },
  pill: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1 },

  // ── Buttons ──────────────────────────────────────────────────────────────
  primaryBtn: { backgroundColor: ACCENT, borderRadius: radius.xl, paddingVertical: space.md, alignItems: "center", shadowColor: ACCENT, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  primaryBtnText: { color: "#04202a", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0 },
  ghostBtn: { borderRadius: radius.xl, paddingVertical: space.md, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.border },
  ghostBtnText: { color: ACCENT, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: 0 },

  // ── Stat tiles ─────────────────────────────────────────────────────────────
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  statBox: { flexGrow: 1, minWidth: "45%", backgroundColor: "rgba(56,225,198,0.06)", borderRadius: radius.xl, padding: space.md, borderWidth: 1, borderColor: "rgba(56,225,198,0.14)" },
  statLabel: { color: theme.secondaryText, fontSize: type.caption, fontFamily: "Inter_800ExtraBold", fontWeight: "800", letterSpacing: 0.6 },
  statValue: { color: "#ffffff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.xs, fontVariant: ["tabular-nums"] },

  // ── Search input ───────────────────────────────────────────────────────────
  search: { fontFamily: "Inter_400Regular", backgroundColor: theme.card, borderRadius: radius.xl, paddingHorizontal: space.lg, paddingVertical: space.md, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: type.bodyLg },

  // ── Detail ─────────────────────────────────────────────────────────────────
  detailHeroWrap: { alignItems: "center", paddingVertical: space.md },
  detailImageWrap: { width: 136, height: 136, borderRadius: 30, backgroundColor: theme.well, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(56,225,198,0.30)", shadowColor: ACCENT, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  detailEmoji: { fontSize: 68, letterSpacing: -1 },
  detailName: { color: "#ffffff", fontSize: 27, fontFamily: "Inter_900Black", fontWeight: "900", letterSpacing: -0.4, marginTop: space.md, textAlign: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: space.sm, alignSelf: "flex-start", paddingVertical: space.sm, paddingHorizontal: space.xs },
  backText: { color: ACCENT, fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900" },

  // ── Auth (sign in / sign up) ───────────────────────────────────────────────
  authInput: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: type.bodyLg, fontFamily: "Inter_700Bold", fontWeight: "700", paddingHorizontal: space.lg, paddingVertical: space.lg },
  authLinkBtn: { paddingVertical: space.md, alignItems: "center" },
  authLinkText: { color: ACCENT, fontSize: type.body, fontFamily: "Inter_800ExtraBold", fontWeight: "800" },
  authError: { color: theme.danger, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18, marginTop: space.md },
  authNotice: { color: ACCENT_LIGHT, fontSize: type.small, fontFamily: "Inter_800ExtraBold", fontWeight: "800", lineHeight: 18, marginTop: space.md },

  // ── Account / cloud card ───────────────────────────────────────────────────
  accountInfoBox: { backgroundColor: theme.well, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: theme.border, marginBottom: space.md },
  accountInfoLabel: { color: ACCENT_LIGHT, fontSize: type.micro, fontFamily: "Inter_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  accountInfoValue: { color: "#ffffff", fontSize: type.bodyLg, fontFamily: "Inter_900Black", fontWeight: "900", marginTop: space.xs },
  // Hairline separator between two merged sections inside one card.
  sectionDivider: { height: 1, backgroundColor: theme.hairline, marginVertical: space.xl },
  accountSignOutBtn: { borderRadius: radius.xl, paddingVertical: space.md, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: theme.border, marginTop: space.md },
  accountSignOutText: { color: "#ffffff", fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" },
  accountDangerBtn: { borderRadius: radius.xl, paddingVertical: space.lg, alignItems: "center", backgroundColor: "rgba(255,123,123,0.08)", borderWidth: 1, borderColor: "rgba(255,123,123,0.45)", marginTop: space.md },
  accountDangerText: { color: theme.danger, fontSize: type.body, fontFamily: "Inter_900Black", fontWeight: "900" },

  // ── Floating bottom tab bar ────────────────────────────────────────────────
  bottomTabs: { position: "absolute", left: 8, right: 8, bottom: 16, flexDirection: "row", backgroundColor: "rgba(7, 24, 38, 0.92)", borderRadius: radius.card, padding: space.sm, borderWidth: 1, borderColor: "rgba(127, 240, 221, 0.12)", ...elevation.floating },
  bottomTabButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space.sm, borderRadius: radius.xl, gap: space.xs },
  // A tinted well rather than a filled, glowing capsule. The active tab should
  // be obvious at a glance without being the brightest thing on the screen.
  bottomTabButtonActive: { backgroundColor: "rgba(56,225,198,0.14)" },
  bottomTabEmoji: { fontSize: type.titleLg, letterSpacing: -0.2 },
  bottomTabLabel: { fontSize: type.micro, letterSpacing: 0.6, fontFamily: "Inter_800ExtraBold", fontWeight: "800", color: "#7ea6bd" },
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
