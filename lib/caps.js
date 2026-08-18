// ─────────────────────────────────────────────────────────────────────────────
// How many records a tank keeps.
//
// Every log in this app is capped, and the caps were magic numbers scattered
// through App.js at the point each record was added. Collected here they are
// comparable for the first time, and one of them was obviously wrong:
//
//     doses         2000        waterChanges   500        losses    400
//     costs          300        feedings       300        journal   200
//     medDoses       200        quarantine      50        waterTests  60   ←
//
// Water tests are the app's primary record — the thing stability, trends,
// forecasts, correlations and the health score are all computed from — and they
// had the tightest cap in the app bar one. A keeper testing weekly lost
// everything past fourteen months; testing twice a week, everything past seven.
// Silently: no warning, no undo, no mention. The 61st test deleted the 1st.
//
// It was not even buying anything. A water test serialises to about 143 bytes,
// so the whole 60 came to 8 KB while the app was happily storing 2000 doses at
// 119 KB. The cap cost a keeper their history to save a rounding error.
//
// These numbers are ceilings against a runaway loop or a bad import, not a
// storage budget. They are set so that nobody keeping fish reaches one: 1000
// water tests is nineteen years of weekly testing.
// ─────────────────────────────────────────────────────────────────────────────

export const CAPS = {
  waterTests: 1000,
  doses: 2000,
  waterChanges: 500,
  losses: 400,
  costs: 300,
  feedings: 300,
  journal: 200,
  medDoses: 200,
  quarantine: 200,
  // Observations are per species, not per tank, so this one is a smaller
  // number that still nobody reaches: 200 notes about one fish.
  observationsPerSpecies: 200,
};

// Prepends a record to a log, keeping the newest and never exceeding the cap.
// Returns the same array when nothing would be dropped, so the common path
// doesn't reallocate.
export function capped(list, cap) {
  if (!Array.isArray(list)) return [];
  if (!Number.isFinite(cap) || cap <= 0) return list;
  return list.length > cap ? list.slice(0, cap) : list;
}
