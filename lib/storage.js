import AsyncStorage from "@react-native-async-storage/async-storage";

// ─────────────────────────────────────────────────────────────────────────────
// Durable storage layer.
//
// AsyncStorage itself survives app updates fine — the risk was never the store,
// it was how we read and wrote it:
//
//   * A JSON.parse that throws used to abort the whole hydration pass, so one
//     bad key made the app boot looking factory-fresh. Every read here is
//     isolated: a corrupt value costs you that one key, not the reef.
//   * Corrupt values are quarantined rather than dropped, so a bad parse is
//     recoverable by hand instead of gone forever.
//   * Critical writes (the tanks blob) go through a commit log, so a write
//     interrupted by a crash or force-quit can't leave truncated JSON as the
//     only copy.
// ─────────────────────────────────────────────────────────────────────────────

// Where a value goes when it fails to parse. Never read automatically — it
// exists so a support conversation can recover a user's reef by hand.
const CORRUPT_SUFFIX = "__corrupt";
// Staging slot for two-phase writes.
const PENDING_SUFFIX = "__pending";

// Reads and parses a JSON value. Returns `fallback` on a missing key or any
// parse failure — and on failure, preserves the raw text under `<key>__corrupt`
// so nothing is silently destroyed.
export async function getJSON(key, fallback = null) {
  let raw;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (e) {
    return fallback;
  }
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (e) {
    AsyncStorage.setItem(CORRUPT_SUFFIX ? key + CORRUPT_SUFFIX : key, raw).catch(() => {});
    return fallback;
  }
}

// Reads a plain string value. Never throws.
export async function getRaw(key, fallback = null) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

// Writes a JSON value. Returns true on success so callers can surface a real
// failure instead of swallowing it.
export async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// Writes a plain string value.
export async function setRaw(key, value) {
  try {
    await AsyncStorage.setItem(key, String(value));
    return true;
  } catch (e) {
    return false;
  }
}

// Deletes a key outright. Used where "cleared" should mean absent rather than
// an empty string — an anonymous analytics id, for instance, where a lingering
// "" is ambiguous about whether it was ever set.
export async function removeRaw(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

// Two-phase write for values we cannot afford to lose.
//
// Stage into `<key>__pending`, then overwrite `<key>`, then clear the staging
// slot. If the process dies mid-sequence, one of the two slots always holds
// complete JSON — `commitJSON`'s recovery path on the next launch finds it.
export async function safeSetJSON(key, value) {
  const text = JSON.stringify(value);
  try {
    await AsyncStorage.setItem(key + PENDING_SUFFIX, text);
    await AsyncStorage.setItem(key, text);
    await AsyncStorage.removeItem(key + PENDING_SUFFIX);
    return true;
  } catch (e) {
    return false;
  }
}

// Sentinel for "nothing readable here". A plain `undefined` can't be used —
// passing it as `fallback` triggers getJSON's default parameter and silently
// becomes `null`, which reads as a legitimate value and skips recovery.
const MISSING = Symbol("missing");

// The read side of `safeSetJSON`. Prefers the committed value; falls back to a
// leftover pending write when the committed one is missing or corrupt, which is
// exactly the state an interrupted write leaves behind.
export async function commitJSON(key, fallback = null) {
  const committed = await getJSON(key, MISSING);
  if (committed !== MISSING) {
    // A leftover pending slot means the last write finished; clean it up.
    AsyncStorage.removeItem(key + PENDING_SUFFIX).catch(() => {});
    return committed;
  }
  const pending = await getJSON(key + PENDING_SUFFIX, MISSING);
  if (pending !== MISSING) {
    // Recovered — promote it to the committed slot so the next read is clean.
    await safeSetJSON(key, pending);
    return pending;
  }
  return fallback;
}

// Full-store snapshot, used for the pre-migration safety net and for support.
// Skips quarantine and staging slots so a backup can't nest inside a backup.
export async function snapshotAll() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (k) => k.startsWith("pr_") && !k.endsWith(CORRUPT_SUFFIX) && !k.endsWith(PENDING_SUFFIX) && !k.startsWith("pr_backup")
    );
    const pairs = await AsyncStorage.multiGet(keys);
    const out = {};
    pairs.forEach(([k, v]) => { if (v != null) out[k] = v; });
    return out;
  } catch (e) {
    return null;
  }
}

// Restores a snapshot produced by `snapshotAll`. Values go back as the raw
// strings they were, so this is lossless regardless of shape.
export async function restoreAll(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  try {
    const pairs = Object.keys(snapshot).map((k) => [k, String(snapshot[k])]);
    if (!pairs.length) return false;
    await AsyncStorage.multiSet(pairs);
    return true;
  } catch (e) {
    return false;
  }
}
