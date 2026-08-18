// ─────────────────────────────────────────────────────────────────────────────
// One rotten row shouldn't take out the card it appeared in.
//
// Every engine here iterates a list of records and reaches straight into each
// one: `entry.date`, `task.id`, `dose.ml`. That is correct for a record and
// throws for a null, and a throw inside a card is caught by the boundary — so
// the keeper doesn't see "one reading was unreadable", they see the whole
// chart replaced by an apology.
//
// Nulls get into those arrays from a write interrupted mid-save, a sync merge
// that resolved badly, or an import that half-parsed. ensureTankShape now
// strips them on load, which covers everything read from storage. It does not
// cover arrays built at runtime and handed straight to an engine, so the
// engines guard their own doorways too. Two cheap filters are worth more than
// one assumption about who calls what.
// ─────────────────────────────────────────────────────────────────────────────

// The records in a list, skipping anything that isn't one. Arrays are excluded
// deliberately: `typeof [] === "object"`, and an array where a record belongs
// is rot of exactly the kind this exists to drop.
export function records(list) {
  if (!Array.isArray(list)) return [];
  // The common case is a clean list, and returning the original array keeps
  // callers that compare by reference working as they did.
  let dirty = false;
  for (const e of list) {
    if (!e || typeof e !== "object" || Array.isArray(e)) { dirty = true; break; }
  }
  if (!dirty) return list;
  return list.filter((e) => e && typeof e === "object" && !Array.isArray(e));
}
