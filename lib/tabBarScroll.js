import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";


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
  // Plain state, not Animated.
  //
  // Animated.timing starts and then never progresses under react-native-web —
  // its completion callback never fires — so the bar silently never moved. A
  // boolean works identically on device and is verifiable here, which matters
  // more than a 180ms slide.
  const [hidden, setHiddenState] = useState(false);
  const isHidden = useRef(false);
  // Last reported offset, used to work out scroll direction.
  const lastY = useRef(0);

  const setHidden = useCallback((next) => {
    if (isHidden.current === next) return;
    isHidden.current = next;
    setHiddenState(next);
  }, []);

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

  // True once the user has physically dragged this list. Restoration must never
  // fight a finger: the retry window below would otherwise keep yanking them
  // back to the saved offset while they were actively scrolling away from it.
  const userTookOver = useRef(false);

  useEffect(() => {
    if (!ctx || !key) return;
    userTookOver.current = false;
    ctx.setActiveKey(key);
    const y = ctx.getOffset(key);
    if (!y) return;

    const restore = () => {
      if (userTookOver.current) return;
      const node = ref.current;
      if (!node) return;
      try {
        // ScrollView exposes scrollTo; FlatList exposes scrollToOffset.
        if (typeof node.scrollToOffset === "function") node.scrollToOffset({ offset: y, animated: false });
        else if (typeof node.scrollTo === "function") node.scrollTo({ y, animated: false });
      } catch (e) {}
    };
    // A virtualized list only has initialNumToRender rows mounted when this
    // first runs, so its content is shorter than the target and the offset
    // clamps. Re-applying as more rows render is what actually lands it — but
    // every attempt checks userTookOver first.
    // Deliberately only two attempts, both inside the first 120ms.
    //
    // A longer retry window lands the offset more reliably on a virtualized
    // list, but it also fights the user: if they start scrolling while retries
    // are pending, they get dragged back to where they came from. That is far
    // worse than landing slightly short, so precision loses to not-fighting.
    // onScrollBeginDrag cancels even these, but it doesn't fire for a mouse
    // wheel on web, so the window itself has to be short enough to be safe.
    const timers = [0, 120].map((d) => setTimeout(restore, d));
    return () => timers.forEach(clearTimeout);
  }, [ctx, key]);

  if (!ctx) return {}; // safe outside the provider (detail screens, sheets)
  const initialY = ctx.getOffset(key);
  return {
    ref,
    onScroll: ctx.onScroll,
    scrollEventThrottle: 16,
    // onScrollBeginDrag only fires for a real finger, never for a programmatic
    // scroll — exactly the signal needed to stand down.
    onScrollBeginDrag: () => { userTookOver.current = true; },
    // Positions the list before first paint where the platform supports it,
    // so the retries above are a correction rather than the whole mechanism.
    ...(initialY ? { contentOffset: { x: 0, y: initialY } } : null),
  };
}

// Used by the tab bar itself.
export function useTabBarVisibility() {
  return useContext(TabBarScrollContext);
}
