import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { Animated, Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Auto-hiding bottom navigation.
//
// The tab bar is rendered once in App.js, but scrolling happens inside each
// screen's own ScrollView/FlatList. Rather than every screen owning a copy of
// the hide/show logic, this shares one animated value: screens report scroll,
// the bar reacts.
//
// Behaviour is deliberately conservative, because a nav bar that flickers is
// far worse than one that never moves:
//   * A dead zone near the top — the bar never hides in the first TOP_ZONE
//     points, so a short list can't hide navigation the user still needs.
//   * A movement threshold, so a jittery finger or a rubber-band bounce
//     doesn't toggle it.
//   * Always restored on tab change, and on any scroll upward.
// ─────────────────────────────────────────────────────────────────────────────

const TOP_ZONE = 80;   // never hide while near the top of a list
const THRESHOLD = 12;  // ignore movements smaller than this

const TabBarScrollContext = createContext(null);

export function TabBarScrollProvider({ children }) {
  // 0 = fully visible, 1 = fully hidden.
  const hidden = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const isHidden = useRef(false);

  const setHidden = useCallback((next) => {
    if (isHidden.current === next) return;
    isHidden.current = next;
    Animated.timing(hidden, {
      toValue: next ? 1 : 0,
      duration: 180,
      // Native driver keeps this off the JS thread on device. react-native-web
      // has no native animated module, so on web it must fall back or the
      // transform never reaches the DOM.
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [hidden]);

  const onScroll = useCallback((e) => {
    const y = e && e.nativeEvent && e.nativeEvent.contentOffset ? e.nativeEvent.contentOffset.y : 0;
    const delta = y - lastY.current;

    if (y <= TOP_ZONE) {
      setHidden(false);
    } else if (delta > THRESHOLD) {
      setHidden(true);   // scrolling down — give the content the screen
    } else if (delta < -THRESHOLD) {
      setHidden(false);  // any upward intent brings navigation back
    }

    if (Math.abs(delta) > THRESHOLD || y <= TOP_ZONE) lastY.current = y;
  }, [setHidden]);

  // Called when the active tab changes — a new screen must never start hidden.
  const reveal = useCallback(() => {
    lastY.current = 0;
    setHidden(false);
  }, [setHidden]);

  const value = useMemo(() => ({ hidden, onScroll, reveal }), [hidden, onScroll, reveal]);
  return <TabBarScrollContext.Provider value={value}>{children}</TabBarScrollContext.Provider>;
}

// Props a screen spreads onto its scrollable root.
export function useTabBarScroll() {
  const ctx = useContext(TabBarScrollContext);
  if (!ctx) return {}; // safe outside the provider (detail screens, sheets)
  return { onScroll: ctx.onScroll, scrollEventThrottle: 16 };
}

// Used by the tab bar itself.
export function useTabBarVisibility() {
  return useContext(TabBarScrollContext);
}
