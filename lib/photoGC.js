// ─────────────────────────────────────────────────────────────────────────────
// Photos nothing points at any more.
//
// persistPhoto copies a picked image into the documents directory so iOS can't
// reclaim it, and forgetPhoto deletes it again when its journal entry goes.
// That pairing covers exactly one of the ways a photo becomes an orphan, and
// the app has since grown several more:
//
//   • an observation with a photo is deleted — nothing cleaned up
//   • a whole tank is deleted, taking every journal entry and observation in it
//   • an import or a restore replaces the entire store with different records
//
// Chasing each path with its own forgetPhoto call is how the next one gets
// missed. Instead: list what's on disk, list what's referenced, delete the
// difference. That covers every path including ones added later, which is the
// point.
//
// The rule that keeps this safe is the inverse of the usual one — it deletes
// only what it can PROVE is unreferenced, and any uncertainty means keeping
// the file. An orphaned image costs a few hundred kilobytes; deleting a photo
// somebody still has an entry for is unrecoverable.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from "react-native";

const FOLDER = "journal-photos";

function fs() {
  try {
    return require("expo-file-system");
  } catch (e) {
    return null;
  }
}

// Every photo URI any record still points at, across every tank.
export function referencedPhotos(tanks = []) {
  const out = new Set();
  const add = (uri) => { if (uri && typeof uri === "string") out.add(uri); };

  (Array.isArray(tanks) ? tanks : []).forEach((tank) => {
    if (!tank) return;
    (tank.journal || []).forEach((e) => add(e && e.photo));
    Object.values(tank.observations || {}).forEach((list) => {
      (list || []).forEach((o) => add(o && o.photo));
    });
    // Species records and losses may carry a photo in future; reading them now
    // costs nothing and means adding one can't silently orphan it.
    Object.values(tank.stockMeta || {}).forEach((r) => add(r && r.photo));
    (tank.losses || []).forEach((l) => add(l && l.photo));
  });

  return out;
}

// Filenames are unique per photo, so comparing on the last path segment is
// robust to the documents directory being remapped between launches — which
// iOS does, and which would otherwise make every stored URI look unreferenced.
export const fileNameOf = (uri) => String(uri || "").split("/").pop() || "";

// Returns { ok, scanned, removed, freedBytes, kept } — never throws.
export async function collectOrphanPhotos(tanks = [], { dryRun = false } = {}) {
  if (Platform.OS === "web") return { ok: false, reason: "no-filesystem", scanned: 0, removed: 0, freedBytes: 0 };

  const FileSystem = fs();
  if (!FileSystem || !FileSystem.Paths || !FileSystem.Directory) {
    return { ok: false, reason: "no-filesystem", scanned: 0, removed: 0, freedBytes: 0 };
  }

  try {
    const dir = new FileSystem.Directory(FileSystem.Paths.document, FOLDER);
    if (!dir.exists) return { ok: true, scanned: 0, removed: 0, freedBytes: 0, kept: 0 };

    const keep = new Set([...referencedPhotos(tanks)].map(fileNameOf).filter(Boolean));

    // A store that reports zero references while files exist is far more likely
    // to be a read that failed than a keeper who deleted every photo they own.
    // Deleting the lot on that basis is exactly the unrecoverable mistake this
    // is supposed to prevent, so it declines to act.
    const entries = dir.list() || [];
    if (!keep.size && entries.length) {
      return { ok: false, reason: "nothing-referenced", scanned: entries.length, removed: 0, freedBytes: 0, kept: entries.length };
    }

    let removed = 0;
    let freedBytes = 0;
    let kept = 0;

    entries.forEach((entry) => {
      const name = entry && entry.name;
      if (!name) return;
      if (keep.has(name)) { kept++; return; }
      if (dryRun) { removed++; return; }
      try {
        const size = typeof entry.size === "number" ? entry.size : 0;
        entry.delete();
        removed++;
        freedBytes += size;
      } catch (e) {
        // A file that won't delete is left alone rather than retried forever.
        kept++;
      }
    });

    return { ok: true, scanned: entries.length, removed, freedBytes, kept };
  } catch (e) {
    return { ok: false, reason: "scan-failed", scanned: 0, removed: 0, freedBytes: 0 };
  }
}
