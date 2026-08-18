import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility settings the app should be following and wasn't.
//
// Nothing in the codebase read a single OS accessibility preference. Two of
// them matter here:
//
//   Reduce Motion. Every hero fades and lifts on mount, cards animate open,
//   the undo bar springs in. For someone with vestibular sensitivity that's
//   not polish, it's a reason to close the app. The setting exists precisely
//   so software can turn it off, and honouring it costs one hook.
//
//   Text size. React Native scales text with the OS setting by default, which
//   is right — but this UI is dense, with two-column parameter tiles and 10pt
//   metadata. At the largest accessibility sizes an unbounded multiplier turns
//   those into overlapping, clipped text: technically scaled, actually less
//   readable. Capping the multiplier keeps big text big and still legible,
//   rather than letting the layout shatter.
// ─────────────────────────────────────────────────────────────────────────────

// Text still grows substantially — this is a ceiling, not a refusal to scale.
// Applied to the compact metadata; body copy is left uncapped.
export const MAX_FONT_SCALE = 1.6;
// Dense numeric tiles (parameter grids, stat rows) break earliest.
export const MAX_FONT_SCALE_COMPACT = 1.3;

// Live Reduce Motion preference. Reads the current value on mount and follows
// changes, so toggling it in Settings takes effect without a relaunch.
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (alive) setReduce(!!on); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => {
      if (alive) setReduce(!!on);
    });
    return () => {
      alive = false;
      // The listener API changed shape across RN versions; both are handled so
      // this can't leak or throw on teardown.
      if (sub && typeof sub.remove === "function") sub.remove();
    };
  }, []);

  return reduce;
}

// The minimum comfortable touch target. Icon-only controls in this app are
// drawn at 30–38pt, which looks right and misses a lot; hitSlop makes the
// tappable area meet the platform guidance without changing the visual size.
export const MIN_TOUCH = 44;
export const touchSlop = (renderedSize) => {
  const pad = Math.max(0, Math.round((MIN_TOUCH - renderedSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
};
