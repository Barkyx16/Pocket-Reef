import { Platform } from "react-native";
import { dayKey } from "./day";

// ─────────────────────────────────────────────────────────────────────────────
// The backup, as a file.
//
// Export has always been `Share.share({ message: JSON.stringify(payload) })` —
// the entire database as the *body of a message*. For a new tank that's a few
// kilobytes and it works. For the keeper this app is actually built for, with
// three tanks and four years of readings, it's a megabyte of JSON handed to the
// share sheet as text, and what happens next depends entirely on which target
// they pick: Messages truncates it, Mail buries it in a mail body, Notes
// silently chokes. The one thing nobody can do is save it somewhere and get it
// back later, which is the entire purpose of a backup.
//
// Writing a real .json file and sharing the URL instead means Files, iCloud
// Drive, AirDrop and email attachments all work, and the result is a document
// with a name and a date on it rather than a wall of text.
//
// Degrades to the old behaviour wherever there's no filesystem (web), because a
// share that works badly beats an export button that does nothing.
// ─────────────────────────────────────────────────────────────────────────────

const FOLDER = "backups";

function fs() {
  try {
    return require("expo-file-system");
  } catch (e) {
    return null;
  }
}

// pocket-reef-backup-2026-08-17.json — sorts by date in a Files listing and
// says what it is without being opened.
export function backupFilename(now = new Date()) {
  const d = new Date(now);
  const stamp = Number.isNaN(d.getTime()) ? "backup" : dayKey(d);
  return `pocket-reef-backup-${stamp}.json`;
}

export function serialise(payload) {
  // Pretty-printed on purpose: a backup is a document somebody might open, and
  // two extra spaces per line is a rounding error against being readable.
  return JSON.stringify(payload, null, 2);
}

// Writes the backup and returns { ok, uri, filename, bytes } — or ok:false with
// a reason, so the caller can fall back rather than pretending it worked.
export async function writeBackupFile(payload, { now = new Date() } = {}) {
  // Inside the guard, not above it: JSON.stringify throws on a payload it can't
  // represent, and on a big enough one it throws RangeError for exceeding the
  // maximum string length. Either way this function promises {ok:false,reason}
  // so the caller can fall back — throwing out of it breaks that promise at
  // exactly the moment a backup matters.
  let text;
  try {
    text = serialise(payload);
  } catch (e) {
    return { ok: false, reason: "too-large", text: "" };
  }

  if (Platform.OS === "web") return { ok: false, reason: "no-filesystem", text };

  const FileSystem = fs();
  if (!FileSystem || !FileSystem.Paths || !FileSystem.File || !FileSystem.Directory) {
    return { ok: false, reason: "no-filesystem", text };
  }

  try {
    const dir = new FileSystem.Directory(FileSystem.Paths.cache, FOLDER);
    if (!dir.exists) dir.create({ intermediates: true });

    const filename = backupFilename(now);
    const file = new FileSystem.File(dir, filename);
    // Overwrite a same-day export rather than accumulating copies — the cache
    // directory is the OS's to reclaim and this is a hand-off, not storage.
    if (file.exists) file.delete();
    file.create();
    file.write(text);

    // Not text.length: that counts UTF-16 code units, and this app's data is
    // full of emoji — tank names, journal moods, species icons. The keeper was
    // told a size smaller than the file they actually have.
    return { ok: true, uri: file.uri, filename, bytes: byteLength(text), text };
  } catch (e) {
    return { ok: false, reason: "write-failed", text };
  }
}

// Cleans up exports from previous days. Called after a successful share, so a
// backup the user is still choosing a destination for is never pulled away.
export async function pruneOldBackups({ keep } = {}) {
  const FileSystem = fs();
  if (!FileSystem || !FileSystem.Paths || !FileSystem.Directory) return 0;
  try {
    const dir = new FileSystem.Directory(FileSystem.Paths.cache, FOLDER);
    if (!dir.exists) return 0;
    let removed = 0;
    (dir.list() || []).forEach((entry) => {
      const name = entry && entry.name;
      if (!name || !name.startsWith("pocket-reef-backup-")) return;
      if (keep && name === keep) return;
      try { entry.delete(); removed++; } catch (e) { /* leave it for the OS */ }
    });
    return removed;
  } catch (e) {
    return 0;
  }
}

// What the file actually weighs on disk. TextEncoder is present in Hermes and
// in Node; the fallback is only for an environment that has neither.
export function byteLength(text) {
  const s = String(text == null ? "" : text);
  try {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length;
  } catch (e) { /* fall through */ }
  // Counts UTF-8 bytes by code point, which is what TextEncoder would give.
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

export const humanSize = (bytes = 0) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
