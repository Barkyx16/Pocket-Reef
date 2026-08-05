import { pushSnapshot, buildSnapshot } from "./cloudSync";
import { getJSON, safeSetJSON } from "./storage";

// ─────────────────────────────────────────────────────────────────────────────
// Durable outbound sync.
//
// The old behaviour: a push that failed set an error flag and was forgotten.
// Nothing retried it. If the next edit came an hour later — or never — the
// account silently held stale data, and the user had no idea. Someone who
// logged a week of water tests on a bad connection would find none of it on
// their next device.
//
// This keeps ONE pending snapshot on disk (the newest — older ones are
// superseded, since the whole payload is a full-state upsert) and retries it
// with backoff until it lands or the app restarts, at which point the pending
// copy is picked back up.
// ─────────────────────────────────────────────────────────────────────────────

const PENDING_KEY = "pr_pendingSync";

// Backoff schedule. Deliberately not aggressive: a phone with no signal gains
// nothing from being hammered, and each attempt costs battery.
const BACKOFF_MS = [3000, 10000, 30000, 60000, 300000];

let timer = null;
let attempt = 0;
let inFlight = false;

// Saves the snapshot that still needs to reach the server.
async function stashPending(userId, snapshot) {
  await safeSetJSON(PENDING_KEY, { userId, snapshot, at: Date.now() });
}

async function readPending() {
  return getJSON(PENDING_KEY, null);
}

async function clearPending() {
  await safeSetJSON(PENDING_KEY, null);
}

// True when there's unsynced work waiting. Drives the "not backed up yet" hint.
export async function hasPendingSync() {
  const p = await readPending();
  return Boolean(p && p.snapshot);
}

function stopRetries() {
  if (timer) { clearTimeout(timer); timer = null; }
  attempt = 0;
}

// Attempts the pending push. Reschedules itself on failure.
// `onResult({ ok, pending, error })` reports every outcome so the UI can be honest.
async function flush(onResult) {
  if (inFlight) return;
  const pending = await readPending();
  if (!pending || !pending.snapshot || !pending.userId) { stopRetries(); return; }

  inFlight = true;
  const res = await pushSnapshot(pending.userId, pending.snapshot);
  inFlight = false;

  if (res.ok) {
    await clearPending();
    stopRetries();
    onResult && onResult({ ok: true, pending: false, error: null });
    return;
  }

  onResult && onResult({ ok: false, pending: true, error: res.error });

  const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
  attempt++;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => flush(onResult), delay);
}

// Queues a snapshot and tries to send it.
//
// The snapshot is written to disk BEFORE the network attempt, so a push
// interrupted by the app being killed is still pending on next launch rather
// than lost.
export async function queueSnapshot(userId, state, onResult) {
  if (!userId) return;
  await stashPending(userId, buildSnapshot(state));
  attempt = 0;
  if (timer) { clearTimeout(timer); timer = null; }
  await flush(onResult);
}

// Called on launch: if a previous session left work behind, resume it.
export async function resumePendingSync(userId, onResult) {
  const pending = await readPending();
  if (!pending || !pending.snapshot) return false;
  // A snapshot belonging to a different account must not be pushed into this
  // one. Drop it rather than corrupting the signed-in user's data.
  if (pending.userId !== userId) { await clearPending(); return false; }
  attempt = 0;
  await flush(onResult);
  return true;
}

// Stops retrying — used on sign-out.
export function cancelPendingSync() {
  stopRetries();
}
