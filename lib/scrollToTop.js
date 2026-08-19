// ─────────────────────────────────────────────────────────────────────────────
// Tapping the tab you're already on takes you back to the top.
//
// It is one of the oldest habits on the platform — every Apple app does it, and
// people reach for it without thinking. This app's screens are long: Home
// stacks ten cards, the Tank tab twenty-three. Scrolling to the bottom of one
// and then wanting the thing at the top meant a long flick back, every time.
//
// A context rather than a prop, because the signal has to reach eleven screens
// and none of them otherwise care that a tab bar exists. App bumps a counter
// when the active tab is tapped again; a screen listening on that counter
// scrolls itself. Screens that don't listen are simply unaffected.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useRef } from "react";

// A counter, not a boolean: two taps in a row have to be two events, and a
// boolean that is already true is indistinguishable from one that never
// changed.
export const ScrollToTopContext = createContext(0);

// Returns a ref to attach to a ScrollView or FlatList. Nothing else to wire.
export function useScrollToTop() {
  const signal = useContext(ScrollToTopContext);
  const ref = useRef(null);
  const seen = useRef(signal);

  useEffect(() => {
    // Skip the value the screen mounted with, or every screen would scroll
    // itself on first render for no reason.
    if (signal === seen.current) return;
    seen.current = signal;
    const node = ref.current;
    if (!node) return;
    try {
      // ScrollView and FlatList expose different methods for the same idea.
      if (typeof node.scrollTo === "function") node.scrollTo({ y: 0, animated: true });
      else if (typeof node.scrollToOffset === "function") node.scrollToOffset({ offset: 0, animated: true });
    } catch (e) {
      // A list that has been unmounted mid-animation is not worth a crash.
    }
  }, [signal]);

  return ref;
}
