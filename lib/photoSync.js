import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Journal photo backup.
//
// The snapshot only ever carried the local file URI, so a photo taken on one
// phone showed as a broken image on the next. The fix has two halves:
//
//   upload  — after a journal entry with a photo is saved, the file is copied
//             into the private `reef-photos` bucket and the entry gains a
//             `photoPath`. The local URI stays put, so the device that took the
//             photo keeps rendering it instantly, with no round trip.
//
//   hydrate — after a cloud pull, any entry with a `photoPath` gets a fresh
//             signed URL. That's what makes photos appear on a new device.
//
// Uploads are best-effort and never block a journal save: a failed upload
// leaves the entry intact with its local photo, and the next sync tries again.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = "reef-photos";
// Signed URLs are deliberately short-lived — they end up inside a synced JSON
// blob, and a long-lived URL is effectively a public one.
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function extensionFor(uri) {
  const m = String(uri).match(/\.(jpe?g|png|webp|heic)(\?|$)/i);
  return m ? m[1].toLowerCase() : "jpg";
}

function contentTypeFor(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  return "image/jpeg";
}

// Uploads one local photo. Returns the storage path, or null on any failure.
export async function uploadPhoto(userId, localUri, entryId) {
  if (!supabase || !userId || !localUri) return null;
  // Already a remote URL — nothing to upload.
  if (/^https?:\/\//i.test(localUri)) return null;

  try {
    const ext = extensionFor(localUri);
    const path = `${userId}/${entryId || Date.now()}.${ext}`;

    // React Native's fetch handles file:// URIs; arrayBuffer avoids pulling in
    // a base64 dependency and keeps memory flat for large photos.
    const res = await fetch(localUri);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (!bytes || bytes.byteLength === 0) return null;

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: contentTypeFor(ext),
      upsert: true,
    });
    if (error) return null;
    return path;
  } catch (e) {
    return null;
  }
}

// Signs one stored photo for viewing. Returns null when it can't.
export async function signPhoto(path) {
  if (!supabase || !path) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl || null;
  } catch (e) {
    return null;
  }
}

// Removes a photo when its journal entry is deleted, so storage doesn't grow
// forever with orphans.
export async function deletePhoto(path) {
  if (!supabase || !path) return false;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    return !error;
  } catch (e) {
    return false;
  }
}

// Uploads any journal photos in these tanks that aren't backed up yet.
// Returns { tanks, uploaded } — `tanks` is unchanged when nothing was uploaded,
// so callers can skip a pointless state update.
export async function backupTankPhotos(userId, tanks) {
  if (!supabase || !userId || !Array.isArray(tanks)) return { tanks, uploaded: 0 };
  let uploaded = 0;

  const next = await Promise.all(
    tanks.map(async (tk) => {
      const journal = tk && Array.isArray(tk.journal) ? tk.journal : null;
      if (!journal || !journal.length) return tk;

      const entries = await Promise.all(
        journal.map(async (e) => {
          if (!e || !e.photo || e.photoPath) return e; // nothing to do
          const path = await uploadPhoto(userId, e.photo, e.id);
          if (!path) return e;
          uploaded++;
          return { ...e, photoPath: path };
        })
      );

      return uploaded ? { ...tk, journal: entries } : tk;
    })
  );

  return { tanks: uploaded ? next : tanks, uploaded };
}

// Fills in viewable URLs for photos that live in storage but not on this
// device. Runs after a cloud pull — that's the moment a new phone has journal
// entries whose local URIs point at files it has never seen.
export async function hydrateTankPhotos(tanks) {
  if (!supabase || !Array.isArray(tanks)) return tanks;
  let changed = false;

  const next = await Promise.all(
    tanks.map(async (tk) => {
      const journal = tk && Array.isArray(tk.journal) ? tk.journal : null;
      if (!journal || !journal.length) return tk;

      const entries = await Promise.all(
        journal.map(async (e) => {
          if (!e || !e.photoPath) return e;
          // A local file:// URI from another device is useless here; a signed
          // https URL is the only thing that will actually render.
          if (e.photo && /^https?:\/\//i.test(e.photo)) return e;
          const url = await signPhoto(e.photoPath);
          if (!url) return e;
          changed = true;
          return { ...e, photo: url };
        })
      );

      return { ...tk, journal: entries };
    })
  );

  return changed ? next : tanks;
}
