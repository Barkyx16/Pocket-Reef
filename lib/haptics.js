import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Haptic vocabulary.
//
// The app already buzzed on most taps, but with only one word in its
// vocabulary: a generic impact. That's the failure mode people describe as an
// app "vibrating constantly" — when every action feels identical, the feedback
// stops carrying information and becomes noise you want to switch off.
//
// Four distinct meanings, matched to what iOS and Android actually provide:
//
//   selection — moving between options (filters, segments, steppers). The
//               lightest tick there is; it's what the OS uses for pickers.
//   tap       — a normal button press.
//   commit    — an action that changes something real: saving, adding stock.
//   success / warning / failure — the OUTCOME of that action, fired when the
//               work finishes rather than when the finger lands.
//
// The outcome family is the part that was missing, and it's the one that makes
// an app feel responsive: a save that confirms itself feels finished in a way
// that a press-buzz never does.
//
// Everything is fire-and-forget and swallows its own errors. Haptics are a
// nicety — a failure here must never surface to the user or block an action.
// ─────────────────────────────────────────────────────────────────────────────

// No haptic hardware on web, and calling through logs noise.
const ENABLED = Platform.OS !== "web";

const IMPACT = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

// Moving between choices. Deliberately the lightest thing available.
export function selectionHaptic() {
  if (!ENABLED) return;
  try { Haptics.selectionAsync().catch(() => {}); } catch (e) {}
}

// A normal press.
export function tapHaptic(style = "light") {
  if (!ENABLED) return;
  try { Haptics.impactAsync(IMPACT[style] || IMPACT.light).catch(() => {}); } catch (e) {}
}

// An action that commits a change — save, add, load a plan.
export function commitHaptic() {
  if (!ENABLED) return;
  try { Haptics.impactAsync(IMPACT.medium).catch(() => {}); } catch (e) {}
}

// It worked. Fire when the work completes, not when the button is pressed.
export function successHaptic() {
  if (!ENABLED) return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch (e) {}
}

// Something needs attention but isn't an error — a cap reached, a confirmation.
export function warningHaptic() {
  if (!ENABLED) return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); } catch (e) {}
}

// It failed — a rejected reading, a failed purchase.
export function failureHaptic() {
  if (!ENABLED) return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch (e) {}
}
