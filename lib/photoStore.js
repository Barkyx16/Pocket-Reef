import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Keeping journal photos.
//
// A picked photo used to be stored exactly as ImagePicker handed it over:
//
//     setPhoto(res.assets[0].uri)
//
// On iOS that URI points into the app's *cache* directory. The OS is free to
// empty that directory whenever it wants storage back, and it does — reliably,
// after a few weeks or the next big download. The journal entry survives; the
// image behind it silently becomes a broken grey box. For a photo journal whose
// entire purpose is a visual record of a tank over years, that's the worst
// possible failure: it looks fine right up until the memory is gone.
//
// So a picked photo is copied into the app's documents directory, which is
// backed up and never reclaimed, and the journal stores that path instead.
//
// Everything here degrades to the original URI rather than throwing. A photo
// that couldn't be copied is still better than a lost journal entry, and on
// web there's no filesystem to copy into — the blob URI is what there is.
// ─────────────────────────────────────────────────────────────────────────────

const FOLDER = "journal-photos";

// Required lazily so a missing or web-stubbed native module can't take the
// whole app down at import time.
function fs() {
  try {
    return require("expo-file-system");
  } catch (e) {
    return null;
  }
}

const extensionFor = (uri) => {
  const m = String(uri).match(/\.(jpe?g|png|webp|heic)(\?|$)/i);
  return m ? m[1].toLowerCase() : "jpg";
};

const uniqueName = (uri) =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(uri)}`;

// Copies a freshly picked photo somewhere permanent and returns the new URI.
// Returns the original on web, or if anything at all goes wrong.
export async function persistPhoto(uri) {
  if (!uri || Platform.OS === "web") return uri;
  const FileSystem = fs();
  if (!FileSystem || !FileSystem.Paths || !FileSystem.File || !FileSystem.Directory) return uri;

  try {
    const dir = new FileSystem.Directory(FileSystem.Paths.document, FOLDER);
    if (!dir.exists) dir.create({ intermediates: true });

    const source = new FileSystem.File(uri);
    // Nothing to copy from — the picker handed back something already gone.
    if (!source.exists) return uri;

    const target = new FileSystem.File(dir, uniqueName(uri));
    source.copy(target);
    return target.uri;
  } catch (e) {
    return uri;
  }
}

// Removes a stored photo when its journal entry is deleted, so the documents
// directory doesn't grow forever with images nothing references. Only touches
// files this module wrote — a photo left in the cache is not ours to delete.
export async function forgetPhoto(uri) {
  if (!uri || Platform.OS === "web") return false;
  if (!String(uri).includes(FOLDER)) return false;
  const FileSystem = fs();
  if (!FileSystem || !FileSystem.File) return false;
  try {
    const file = new FileSystem.File(uri);
    if (file.exists) file.delete();
    return true;
  } catch (e) {
    return false;
  }
}

// True when a URI is one we've taken responsibility for. Used by the journal to
// tell "safe on disk" from "still pointing at the picker's cache".
export const isPersisted = (uri) => !!uri && String(uri).includes(FOLDER);
