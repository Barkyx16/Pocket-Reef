import { AppState } from "react-native";
import { safeSetJSON, setRaw, setJSON } from "./storage";

// ─────────────────────────────────────────────────────────────────────────────
// The write scheduler.
//
// Every edit in the app used to hit AsyncStorage immediately, and the tanks
// blob used to hit it through the two-phase commit — three awaited round trips
// per write. Dragging a quantity stepper from 1 to 12 was twelve full
// serialisations of every tank, with all their journals and photo URIs, on the
// JS thread. On a tank with real history that's the frame budget gone.
//
// Two problems, one fix:
//
//   1. Coalescing. Writes for the same key inside the debounce window collapse
//      into one — the last value is the only one that was ever going to matter.
//   2. Durability. Debouncing on its own trades data loss for speed: a
//      force-quit inside the window loses the edit. So the scheduler flushes on
//      every AppState transition away from "active", which is the last moment
//      the OS reliably gives us before it can kill the process.
//
// The value is captured lazily, as a thunk. Callers hand over "how to get the
// current value" rather than a snapshot, so a coalesced burst always writes
// the newest state rather than whatever the first call happened to see.
// ─────────────────────────────────────────────────────────────────────────────

// Long enough to swallow a stepper drag or a burst of typing, short enough that
// a user who taps and immediately swipes the app away is covered by the
// AppState flush rather than relying on it.
export const WRITE_DELAY_MS = 400;

// key -> { getValue, mode, timer }
const pending = new Map();
// Writes currently in flight, so flush() can await them rather than resolving
// while a slow AsyncStorage call is still running.
let inFlight = new Set();

const WRITERS = {
  // The tanks blob: two-phase, because a torn write here is the one that loses
  // a user's history.
  commit: safeSetJSON,
  json: setJSON,
  raw: setRaw,
};

// ── Write health ─────────────────────────────────────────────────────────────
//
// safeSetJSON returns false when a write fails, `write` returned that boolean,
// and every caller threw it away behind `.catch(() => {})`. So on a device with
// no free storage — the single most likely way this fails in the wild — every
// save silently did nothing. The app kept displaying the reading the keeper had
// just entered, because it was still in memory, and the next launch had none of
// it. For an offline-first app whose entire promise is "your records are safe",
// a silent write failure is the worst possible bug: it looks exactly like
// success right up until the data is gone.
let consecutiveFailures = 0;
let lastFailure = null;
const failureHandlers = new Set();

export function onWriteFailure(handler) {
  failureHandlers.add(handler);
  return () => failureHandlers.delete(handler);
}

// A single failure can be a transient blip; a run of them is a broken device.
export const FAILURE_THRESHOLD = 3;

export function writeHealth() {
  return {
    ok: consecutiveFailures < FAILURE_THRESHOLD,
    consecutiveFailures,
    lastFailure,
  };
}

export function __resetWriteHealth() {
  consecutiveFailures = 0;
  lastFailure = null;
}

function noteResult(key, ok) {
  if (ok) {
    consecutiveFailures = 0;
    return ok;
  }
  consecutiveFailures += 1;
  lastFailure = { key, at: Date.now() };
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    // Handlers must never be able to break the write path.
    failureHandlers.forEach((h) => { try { h(writeHealth()); } catch (e) {} });
  }
  return ok;
}

async function write(key, entry) {
  const value = entry.getValue();
  // A thunk returning undefined means "nothing to write any more" — the state
  // it referenced is gone. Skipping beats persisting undefined over real data.
  if (value === undefined) return true;
  const fn = WRITERS[entry.mode] || WRITERS.json;
  const p = fn(key, value);
  inFlight.add(p);
  try {
    return noteResult(key, await p);
  } catch (e) {
    // A writer that throws rather than returning false counts the same.
    return noteResult(key, false);
  } finally {
    inFlight.delete(p);
  }
}

// Queue a write. Repeated calls for the same key restart the timer and replace
// the thunk, so only the newest value is ever written.
export function scheduleWrite(key, getValue, mode = "json") {
  const existing = pending.get(key);
  if (existing && existing.timer) clearTimeout(existing.timer);

  const entry = { getValue, mode, timer: null };
  entry.timer = setTimeout(() => {
    pending.delete(key);
    write(key, entry).catch(() => {});
  }, WRITE_DELAY_MS);

  pending.set(key, entry);
}

// Write a key immediately, cancelling any pending write for it. For the edits
// where a 400ms window is the wrong trade — finishing a purchase, applying an
// import, anything the user would expect to survive an instant crash.
export function writeNow(key, value, mode = "json") {
  const existing = pending.get(key);
  if (existing && existing.timer) clearTimeout(existing.timer);
  pending.delete(key);
  return write(key, { getValue: () => value, mode });
}

// Drain everything queued, right now. Resolves once the writes have landed.
export async function flushWrites() {
  const entries = [...pending.entries()];
  pending.clear();
  entries.forEach(([, e]) => { if (e.timer) clearTimeout(e.timer); });
  await Promise.all(entries.map(([key, e]) => write(key, e).catch(() => false)));
  // Anything already in flight when flush was called still counts as unfinished
  // work — a caller awaiting flushWrites() means "the disk is up to date".
  await Promise.all([...inFlight]).catch(() => {});
}

// True when there's unwritten work. Used by tests and by the sync layer, which
// shouldn't upload a snapshot that the device hasn't finished writing.
export const hasPendingWrites = () => pending.size > 0;

// Flush whenever the app stops being active. "background" is the Android and
// cold-kill case; "inactive" covers the iOS app switcher, which is where a
// swipe-to-quit starts. Both are cheap when nothing is queued.
export function startAutoFlush() {
  const sub = AppState.addEventListener("change", (state) => {
    if (state !== "active") flushWrites().catch(() => {});
  });
  return () => sub.remove();
}

// Test seam: drop everything queued without writing it.
export function __resetWrites() {
  pending.forEach((e) => { if (e.timer) clearTimeout(e.timer); });
  pending.clear();
  inFlight = new Set();
}
