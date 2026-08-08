import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
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
  // Where each tab was last scrolled to.
  //
  // Opening a species or disease detail replaces the tab's content entirely, so
  // the tab's ScrollView unmounts — and remounts at the top when you press
  // Back. Losing your place after tapping the 40th fish in a list is the single
  // most irritating thing a list app can do. Offsets are remembered per tab and
  // restored on mount.
  const offsets = useRef({});
  const activeKey = useRef("home");
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
    if (e && e.nativeEvent && e.nativeEvent.contentOffset) {
      offsets.current[activeKey.current] = e.nativeEvent.contentOffset.y;
    }
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

  // A screen registers which tab it is, so its offset is filed correctly.
  const setActiveKey = useCallback((key) => { if (key) activeKey.current = key; }, []);
  const getOffset = useCallback((key) => offsets.current[key] || 0, []);
  const clearOffset = useCallback((key) => { delete offsets.current[key]; }, []);

  const value = useMemo(
    () => ({ hidden, onScroll, reveal, setActiveKey, getOffset, clearOffset }),
    [hidden, onScroll, reveal, setActiveKey, getOffset, clearOffset]
  );
  return <TabBarScrollContext.Provider value={value}>{children}</TabBarScrollContext.Provider>;
}

// Props a screen spreads onto its scrollable root.
//
// Pass a stable key (the tab id) and the screen also restores where it was —
// which is what makes Back return you to the exact row you tapped.
export function useTabBarScroll(key) {
  const ctx = useContext(TabBarScrollContext);
  const ref = useRef(null);

  useEffect(() => {
    if (!ctx || !key) return;
    ctx.setActiveKey(key);
    const y = ctx.getOffset(key);
    if (!y) return;
    // ScrollView exposes scrollTo; FlatList exposes scrollToOffset. Calling the
    // wrong one silently does nothing, which is how this first shipped broken.
    const restore = () => {
      const node = ref.current;
      if (!node) return false;
      try {
        if (typeof node.scrollToOffset === "function") { node.scrollToOffset({ offset: y, animated: false }); return true; }
        if (typeof node.scrollTo === "function") { node.scrollTo({ y, animated: false }); return true; }
      } catch (e) {}
      return false;
    };
    // A virtualized list needs a frame or two before it has the content height
    // to scroll within, so try again briefly rather than once.
    const timers = [0, 60, 180].map((d) => setTimeout(restore, d));
    return () => timers.forEach(clearTimeout);
  }, [ctx, key]);

  if (!ctx) return {}; // safe outside the provider (detail screens, sheets)
  return { ref, onScroll: ctx.onScroll, scrollEventThrottle: 16 };
}

// Used by the tab bar itself.
export function useTabBarVisibility() {
  return useContext(TabBarScrollContext);
}
