import { supabase } from "./supabase";

// Cloud save for the whole reef. One row per user in `reef_profiles`, holding a
// JSON snapshot of everything the app keeps locally. Small enough (tanks, logs,
// prefs — all text) to write as a single upsert, which keeps conflict handling
// trivial: last write wins, and the device that just made the edit is the one
// writing. Photos stay local; only their references travel.

// The exact set of fields that round-trip. Anything not listed here is device-
// local on purpose (splash state, collapsed cards, biometric flags).
// NOTE: premiumUnlocked is deliberately absent. Entitlement is owned by
// RevenueCat (see lib/purchases.js) — syncing it would mean the app could write
// its own paid status and have it persist across devices forever.
export const SYNCED_FIELDS = [
  "tanks", "activeTankId", "xp", "activeDays", "careDone", "wishlist",
  "reminderPrefs", "profileName", "since", "recent", "speciesNotes",
  "challengesDone", "bannerId", "lang", "unit", "currency",
  // Supplement strengths are copied off a product label by hand and the whole
  // consumption calculation is inert without them, so a new device that didn't
  // carry them would silently stop measuring. tankSized is the first-run
  // checklist's memory — without it a fully set-up keeper is asked to confirm
  // their tank size again on every new device.
  "strengths", "tankSized",
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

// ── Server-verified entitlement ──────────────────────────────────────────────
// The copy of Premium status the client cannot write. RevenueCat posts it via
// the revenuecat-webhook Edge Function; RLS lets a signed-in user read only
// their own row and grants no write policy at all.
//
// Returns true/false when the answer is known, or null when it isn't (offline,
// not signed in, table not deployed yet). null must never be read as "not
// entitled" — the caller keeps whatever the RevenueCat SDK already said.
export async function fetchServerEntitlement(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("premium_entitlements")
      .select("is_active, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    // A null expiry means lifetime or an unknown grace period — treat it as
    // not expired, so a missing timestamp can't lock out a paying subscriber.
    const notExpired = !data.expires_at || new Date(data.expires_at).getTime() > Date.now();
    return data.is_active === true && notExpired;
  } catch (e) {
    return null;
  }
}
