// ─────────────────────────────────────────────────────────────────────────────
// Restore points.
//
// A tank log is the one kind of data in this app that cannot be recreated. A
// species catalog can be reinstalled; four years of water tests cannot. What
// protected them was an export the keeper had to remember to run, and a cloud
// sync that faithfully replicates a mistake to every device within seconds.
//
// The dangerous operations are all one tap and all already undoable *within the
// session* — but undo dies when the app does, and the genuinely frightening
// ones (a bad import, a restore from an old backup, a tank deleted and then
// confirmed) are exactly the ones somebody performs and then force-quits.
//
// So: a rolling set of local snapshots, taken automatically once a day and
// before anything destructive, each restorable in one tap. Snapshots are raw
// key/value copies via storage.snapshotAll, which makes them lossless and
// schema-agnostic — a restore point taken two versions ago still restores.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { snapshotAll, restoreAll, getJSON, safeSetJSON } from "./storage";

const INDEX_KEY = "pr_restore_index";
const POINT_PREFIX = "pr_restore_pt_";
// Five is enough to get back past a bad day without turning device storage into
// six copies of the same tank.
export const MAX_POINTS = 5;
// At most one automatic point per day; the manual ones are unlimited within MAX.
const AUTO_INTERVAL_MS = 20 * 60 * 60 * 1000;

const now = () => Date.now();

// Snapshots must never contain other snapshots. snapshotAll takes every pr_ key
// it can see, and the restore points are pr_ keys — without this the second
// snapshot would contain the first, the third would contain both, and the
// fifth would be enormous.
function stripRestoreKeys(snapshot) {
  const out = {};
  Object.keys(snapshot || {}).forEach((k) => {
    if (k === INDEX_KEY || k.startsWith(POINT_PREFIX)) return;
    out[k] = snapshot[k];
  });
  return out;
}

export async function listRestorePoints() {
  const index = await getJSON(INDEX_KEY, []);
  return Array.isArray(index) ? index : [];
}

// `reason` is what the keeper will read: "Before importing a backup".
export async function createRestorePoint(reason = "Manual", { auto = false } = {}) {
  const raw = await snapshotAll();
  if (!raw) return null;
  const snapshot = stripRestoreKeys(raw);
  const keys = Object.keys(snapshot);
  if (!keys.length) return null;

  const id = `${now()}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = {
    id,
    at: new Date().toISOString(),
    reason: String(reason).slice(0, 60),
    auto,
    keys: keys.length,
    // Rough size, for a card that can say "1.2 MB" rather than nothing.
    bytes: keys.reduce((n, k) => n + k.length + String(snapshot[k]).length, 0),
  };

  const ok = await safeSetJSON(`${POINT_PREFIX}${id}`, snapshot);
  if (!ok) return null;

  const index = await listRestorePoints();
  const next = [entry, ...index].slice(0, MAX_POINTS);
  // Anything that fell off the end has its payload deleted too, or the storage
  // grows forever behind an index that no longer mentions it.
  const dropped = index.filter((e) => !next.some((n2) => n2.id === e.id));
  await Promise.all(dropped.map((e) => AsyncStorage.removeItem(`${POINT_PREFIX}${e.id}`).catch(() => {})));
  await safeSetJSON(INDEX_KEY, next);
  return entry;
}

// One automatic point a day, taken quietly at launch.
export async function maybeAutoPoint(reason = "Daily snapshot") {
  const index = await listRestorePoints();
  const lastAuto = index.find((e) => e.auto);
  if (lastAuto && now() - new Date(lastAuto.at).getTime() < AUTO_INTERVAL_MS) return null;
  return createRestorePoint(reason, { auto: true });
}

// Restoring is itself destructive — it overwrites the present. So the present
// is snapshotted first, which means a restore can always be undone by
// restoring the point this creates.
export async function restoreToPoint(id) {
  const snapshot = await getJSON(`${POINT_PREFIX}${id}`, null);
  if (!snapshot || typeof snapshot !== "object") return { ok: false, reason: "That restore point is missing or unreadable." };

  const safety = await createRestorePoint("Before restoring", { auto: false });
  const ok = await restoreAll(snapshot);
  if (!ok) return { ok: false, reason: "Nothing could be written back. Your current data is untouched." };
  return { ok: true, undoId: safety ? safety.id : null };
}

export async function deleteRestorePoint(id) {
  const index = await listRestorePoints();
  const next = index.filter((e) => e.id !== id);
  await AsyncStorage.removeItem(`${POINT_PREFIX}${id}`).catch(() => {});
  await safeSetJSON(INDEX_KEY, next);
  return next;
}

// "2 hours ago" / "yesterday" — restore points are chosen by when, not by id.
export function describeAge(at, ref = Date.now()) {
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((ref - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function describeSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
