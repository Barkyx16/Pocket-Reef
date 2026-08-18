import { useEffect, useRef, useState } from "react";
import { getJSON } from "./storage";
import { scheduleWrite } from "./persist";

// ─────────────────────────────────────────────────────────────────────────────
// useState that remembers.
//
// The catalog filters were plain useState inside SpeciesTab. Because only one
// tab is mounted at a time, every one of them reset the moment you left the
// screen — so "saltwater, reef-safe, easy care, fits my 40 gallons" had to be
// rebuilt after every single trip into a species detail page and back. That is
// the app forgetting what you're shopping for, over and over.
//
// Reads once on mount, writes through the coalescing scheduler after that.
// Until the stored value arrives the hook reports the default, so the first
// frame never blocks — and `ready` is exposed for the rare caller that needs
// to tell "not loaded yet" from "loaded, and it's the default".
// ─────────────────────────────────────────────────────────────────────────────
// Sentinel for "nothing stored". `undefined` cannot be used as the fallback:
// getJSON declares `fallback = null`, so passing undefined trips the default
// parameter and a missing key comes back as null — which then reads as a real
// stored value and overwrites the caller's default. storage.js hit the same
// trap and solved it the same way.
const MISSING = Symbol("missing");

export function usePersistedState(key, initial, { validate } = {}) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  // Guards the write-back effect. Without it the hook writes `initial` over
  // the stored value on the very first render, every launch.
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    getJSON(key, MISSING).then((stored) => {
      if (!alive) return;
      // A stored value that no longer makes sense — an option that was removed
      // in a later build — is dropped rather than applied. Restoring a filter
      // id nothing matches would look like an empty catalog.
      if (stored !== MISSING && (!validate || validate(stored))) setValue(stored);
      loaded.current = true;
      setReady(true);
    }).catch(() => {
      loaded.current = true;
      setReady(true);
    });
    return () => { alive = false; };
  }, [key]);

  useEffect(() => {
    if (loaded.current) scheduleWrite(key, () => value);
  }, [key, value]);

  return [value, setValue, ready];
}
