import { useCallback, useInsertionEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// A callback with a stable identity that always runs the latest closure.
//
// The screens take a lot of props — HomeTab alone takes around forty, most of
// them handlers. Every one was a fresh arrow function on every render of App,
// so wrapping the screens in React.memo would have done precisely nothing:
// the props compare unequal every time by construction.
//
// The usual fix is useCallback with a dependency array per handler. With this
// many handlers, closing over this much state, that's forty dependency arrays
// to keep correct — and a wrong one is a stale-closure bug that reads an old
// tank and writes it back. This trades that risk away: identity is frozen,
// behaviour always comes from the most recent render.
//
// The ref is written in useInsertionEffect rather than during render, so the
// assignment can't be observed by a render that React then discards. That's
// the same mechanism React's own useEffectEvent uses.
// ─────────────────────────────────────────────────────────────────────────────
export function useStableCallback(fn) {
  const ref = useRef(fn);

  useInsertionEffect(() => {
    ref.current = fn;
  });

  // Deliberately empty deps: the returned function is created once and never
  // replaced, which is the whole point.
  return useCallback((...args) => ref.current(...args), []);
}
