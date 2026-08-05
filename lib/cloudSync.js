import { supabase } from "./supabase";

// Cloud save for the whole reef. One row per user in `reef_profiles`, holding a
// JSON snapshot of everything the app keeps locally. Small enough (tanks, logs,
// prefs — all text) to write as a single upsert, which keeps conflict handling
// trivial: last write wins, and the device that just made the edit is the one
// writing. Photos stay local; only their references travel.

// The exact set of fields that round-trip. Anything not listed here is device-
// local on purpose (splash state, collapsed cards, biometric flags).
export const SYNCED_FIELDS = [
  "tanks", "activeTankId", "xp", "activeDays", "careDone", "wishlist",
  "reminderPrefs", "profileName", "since", "recent", "speciesNotes",
  "challengesDone", "bannerId", "lang", "unit", "premiumUnlocked",
];

// Strips a state object down to the synced fields, so a stray key can never
// bloat or corrupt the stored payload.
export function buildSnapshot(state) {
  const out = {};
  SYNCED_FIELDS.forEach((k) => {
    if (state[k] !== undefined) out[k] = state[k];
  });
  return out;
}

// Writes the snapshot for the signed-in user. Returns { ok, error }.
export async function pushSnapshot(userId, state) {
  if (!supabase || !userId) return { ok: false, error: "offline" };
  try {
    const { error } = await supabase.from("reef_profiles").upsert(
      {
        id: userId,
        data: buildSnapshot(state),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

// Reads the snapshot back. Returns { ok, data, updatedAt } — data is null when
// this is a brand-new account with nothing saved yet.
export async function pullSnapshot(userId) {
  if (!supabase || !userId) return { ok: false, data: null };
  try {
    const { data, error } = await supabase
      .from("reef_profiles")
      .select("data, updated_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) return { ok: false, data: null, error: error.message };
    return { ok: true, data: data ? data.data : null, updatedAt: data ? data.updated_at : null };
  } catch (e) {
    return { ok: false, data: null, error: String(e && e.message ? e.message : e) };
  }
}
