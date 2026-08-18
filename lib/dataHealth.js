// ─────────────────────────────────────────────────────────────────────────────
// Is my data safe?
//
// The app now protects a keeper's records in four separate ways — an export
// file, cloud sync, rolling restore points and the migration backup — and tells
// them about each one in a different card on a different screen. So the single
// question somebody actually has after four years of logging ("if my phone went
// in the tank tonight, what would I lose?") has no answer anywhere, despite the
// app knowing all of it.
//
// This assembles that answer, and is deliberately willing to say "no". A
// reassuring green tick on a device with no backup and no account is the worst
// possible output, because it's the one that stops somebody making one.
// ─────────────────────────────────────────────────────────────────────────────

import { records as onlyRecords } from "./records";

const DAY = 86400000;

// Beyond this an export is old enough that restoring it would lose real work.
const STALE_BACKUP_DAYS = 30;

const round = (n, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const daysSince = (t) => (t ? Math.floor((Date.now() - t) / DAY) : null);

// What a keeper would actually lose, counted in the things they typed.
export function countRecords(tanks = []) {
  tanks = onlyRecords(tanks);

  let records = 0;
  let photos = 0;
  let oldest = null;

  tanks.forEach((t) => {
    const lists = ["waterTests", "journal", "costs", "feedings", "waterChanges", "doses", "medDoses", "losses", "equipment", "upkeep", "inventory", "quarantine"];
    lists.forEach((k) => { records += (t[k] || []).length; });
    Object.values(t.observations || {}).forEach((l) => { records += (l || []).length; });

    photos += (t.journal || []).filter((j) => j && j.photo).length;
    Object.values(t.observations || {}).forEach((l) => {
      photos += (l || []).filter((o) => o && o.photo).length;
    });

    const first = (t.waterTests || []).map((w) => w && w.date).filter(Boolean).sort()[0];
    if (first && (!oldest || first < oldest)) oldest = first;
  });

  return { records, photos, tanks: tanks.length, oldest };
}

// `signedIn` and `lastSyncedAt` come from the cloud layer; `lastBackup` from
// the export button; `restorePoints` from lib/restore.
export function assessDataHealth({
  tanks = [],
  signedIn = false,
  lastSyncedAt = null,
  syncError = false,
  lastBackup = null,
  restorePoints = [],
  remindersState = null,
  now = Date.now(),
} = {}) {
  const counts = countRecords(tanks);
  const backupAge = lastBackup ? Math.floor((now - lastBackup) / DAY) : null;
  const syncAge = lastSyncedAt ? Math.floor((now - lastSyncedAt) / DAY) : null;
  const newestPoint = restorePoints.length
    ? restorePoints.map((p) => new Date(p.at).getTime()).filter((t) => !Number.isNaN(t)).sort((a, b) => b - a)[0]
    : null;
  const pointAge = newestPoint ? Math.floor((now - newestPoint) / DAY) : null;

  const checks = [];

  // Cloud sync — the only protection that survives losing the device.
  if (!signedIn) {
    checks.push({
      id: "cloud", state: "missing", label: "Cloud backup",
      detail: "No account. Everything is on this device only — if it's lost or replaced, so is the log.",
      fix: "Sign in on the Profile tab.",
    });
  } else if (syncError) {
    checks.push({ id: "cloud", state: "warn", label: "Cloud backup", detail: "The last sync failed. Your account has an older copy than this device.", fix: "Open Profile and sync again." });
  } else if (syncAge != null && syncAge > 7) {
    checks.push({ id: "cloud", state: "warn", label: "Cloud backup", detail: `Last synced ${syncAge} days ago.`, fix: "Open the app on Wi-Fi to bring it up to date." });
  } else {
    checks.push({ id: "cloud", state: "ok", label: "Cloud backup", detail: syncAge === 0 || syncAge == null ? "Synced today." : `Synced ${syncAge} day${syncAge === 1 ? "" : "s"} ago.` });
  }

  // A file you hold yourself, which is the only copy that survives losing
  // access to the account too.
  if (!lastBackup) {
    checks.push({ id: "file", state: "missing", label: "Exported file", detail: "You've never exported a backup file.", fix: "Profile → Export saves a .json you can keep in Files or iCloud." });
  } else if (backupAge > STALE_BACKUP_DAYS) {
    checks.push({ id: "file", state: "warn", label: "Exported file", detail: `Your last export was ${backupAge} days ago — restoring it would lose everything since.`, fix: "Export again from Profile." });
  } else {
    checks.push({ id: "file", state: "ok", label: "Exported file", detail: `Exported ${backupAge === 0 ? "today" : `${backupAge} day${backupAge === 1 ? "" : "s"} ago`}.` });
  }

  // Restore points cover the mistake, not the lost phone.
  if (!restorePoints.length) {
    checks.push({ id: "points", state: "warn", label: "Restore points", detail: "No local snapshots yet — one is taken automatically each day.", fix: "Open Profile → Restore Points to take one now." });
  } else {
    checks.push({ id: "points", state: "ok", label: "Restore points", detail: `${restorePoints.length} snapshot${restorePoints.length === 1 ? "" : "s"}, newest ${pointAge === 0 ? "today" : `${pointAge} day${pointAge === 1 ? "" : "s"} ago`}.` });
  }

  // Photos are the one thing a JSON export does not contain.
  if (counts.photos) {
    checks.push({
      id: "photos", state: signedIn ? "ok" : "warn", label: "Photos",
      detail: signedIn
        ? `${counts.photos} photo${counts.photos === 1 ? "" : "s"} backed up with your account.`
        : `${counts.photos} photo${counts.photos === 1 ? "" : "s"} live only on this device — an exported file holds the entries, not the images.`,
      fix: signedIn ? null : "Sign in to back the images up too.",
    });
  }

  if (remindersState && remindersState !== "on") {
    checks.push({
      id: "reminders", state: "warn", label: "Reminders",
      detail: remindersState === "blocked" ? "Notifications are switched off, so no reminder will arrive." : "Notifications haven't been allowed yet.",
      fix: "Profile → Reminders.",
    });
  }

  const missing = checks.filter((c) => c.state === "missing").length;
  const warn = checks.filter((c) => c.state === "warn").length;

  // Weighted so a single "missing" dominates: the difference between three
  // protections and two is small, and the difference between one and none is
  // everything.
  const score = Math.max(0, Math.min(100, Math.round(100 - missing * 40 - warn * 12)));
  const level = missing ? "at-risk" : warn ? "partial" : "safe";

  return {
    counts,
    checks,
    score,
    level,
    // Stated in what would actually be lost, not in a percentage.
    headline: missing
      ? `${counts.records} records on this device with no off-device copy.`
      : warn
        ? `Protected, but ${warn} thing${warn === 1 ? "" : "s"} could be more current.`
        : `${counts.records} records, backed up and current.`,
    yearsLogged: counts.oldest ? round((now - new Date(counts.oldest).getTime()) / (DAY * 365), 1) : 0,
  };
}
