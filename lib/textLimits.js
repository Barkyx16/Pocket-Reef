// ─────────────────────────────────────────────────────────────────────────────
// How long a typed field is allowed to be.
//
// Not one of the app's sixty-odd text inputs had a maxLength. On its own that
// sounds like a tidiness problem; it isn't, because of where the text goes.
// Everything typed here is held in a single per-profile object, written to
// AsyncStorage on every change, and pushed to Supabase as one JSON blob. A
// journal entry is not a row in a table that grows independently — it is part
// of a document that is serialised, in full, every time anything in it changes.
//
// So a paste of a few hundred kilobytes (a log file, a page of a forum thread,
// the contents of a clipboard nobody checked) is not merely a long note. It
// makes every subsequent save slower, it inflates every sync, and on the
// Supabase side it can push the row past the request limit — at which point
// sync fails silently for everything, not just the note.
//
// The limits below are deliberately generous. They are sized so that no keeper
// writing in good faith will ever meet one: 4000 characters is about two pages
// of typing about a tank, which is far more than the field invites. The point
// is not to ration what people write, it's to have a ceiling at all.
// ─────────────────────────────────────────────────────────────────────────────

export const TEXT_LIMITS = {
  // Short identifiers that appear in lists, where a long value breaks layout
  // long before it breaks storage.
  name: 60,        // tank names, item names, equipment, livestock nicknames
  shortNote: 200,  // one-line notes attached to a record
  note: 4000,      // journal entries, species notes — the long-form fields
  email: 254,      // RFC 5321's limit on a whole address
  password: 128,   // above bcrypt's 72-byte input this changes nothing anyway
  code: 6,         // the OTP
  number: 12,      // enough for 999,999,999.99
  date: 10,        // YYYY-MM-DD
  time: 5,         // HH:MM
  search: 100,     // a query longer than this matches nothing useful
  phone: 32,
};

// Trims a value to a limit at the point it is stored, so a value that arrives
// from somewhere other than a capped TextInput — a CSV import, a restored
// backup, a synced profile written by an older build — is bounded too.
export function limitText(value, limit) {
  if (value === null || value === undefined) return value;
  const s = String(value);
  if (!Number.isFinite(limit) || limit <= 0) return s;
  if (s.length <= limit) return s;
  return trimToBoundary(s, limit);
}

// JavaScript string length counts UTF-16 code units, not characters. An emoji
// is two of them, and a cut that lands between the halves leaves a lone
// surrogate — which renders as the replacement character. A journal entry
// truncated mid-🐠 ends in "" rather than a fish.
//
// The same applies past surrogates: a variation selector (the invisible
// character that makes 🛠️ render as an emoji rather than a glyph) and the
// zero-width joiners in a family or flag sequence are all separate code units
// that mean nothing on their own. So the cut retreats to the last position
// where nothing is left dangling.
const HIGH_SURROGATE = /[\uD800-\uDBFF]/;
const LOW_SURROGATE = /[\uDC00-\uDFFF]/;
// Variation selectors, zero-width joiner, combining marks, and skin-tone
// modifiers — all of which modify the character before them.
// The rule below warns that a combining mark or joiner inside a character
// class matches half of a visible character. Matching exactly that half is the
// point here: this asks whether the cut has left a dangling modifier behind.
// eslint-disable-next-line no-misleading-character-class
const COMBINING = /[\u0300-\u036F\u200D\uFE00-\uFE0F]/;

function trimToBoundary(s, limit) {
  let end = limit;
  // Never end on the first half of a pair.
  if (HIGH_SURROGATE.test(s[end - 1])) end -= 1;
  // Nor immediately after something that modifies what follows it — a trailing
  // joiner is a promise of a character that got cut off.
  while (end > 0) {
    const last = s[end - 1];
    if (COMBINING.test(last)) { end -= 1; continue; }
    // Back off a low surrogate whose high half we just removed.
    if (LOW_SURROGATE.test(last) && (end < 2 || !HIGH_SURROGATE.test(s[end - 2]))) { end -= 1; continue; }
    break;
  }
  return s.slice(0, end);
}
