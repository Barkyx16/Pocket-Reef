// ─────────────────────────────────────────────────────────────────────────────
// Typing a number on a keyboard that isn't American.
//
// Every numeric field in the app sanitised its input the same way:
//
//     onChangeText={(t) => setValue(t.replace(/[^0-9.]/g, ""))}
//
// which is correct in exactly the locales that write decimals with a full
// stop. On a device set to most of Europe and South America, iOS renders the
// decimal-pad with a *comma*, because that is the decimal separator there.
// The keeper presses the key the OS gave them, and the regex deletes it.
//
//     "1,5"  ->  "15"
//
// Not rejected. Not flagged. Multiplied by ten and stored. A 1.5 ml dose
// becomes 15 ml, which is an order of magnitude out and still entirely
// plausible, so nothing downstream catches it — not the bounds check, not the
// anomaly detector on a fresh tank with no history to compare against.
//
// The fix is to treat both separators as what they are — a decimal point —
// rather than treating one of them as a character to delete.
// ─────────────────────────────────────────────────────────────────────────────

// Sanitises a decimal field as it is typed. Accepts either separator, keeps at
// most one, and normalises to the full stop that Number() understands.
export function decimalText(text) {
  if (text == null) return "";
  // Both separators mean the same thing to someone typing a quantity.
  let s = String(text).replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const first = s.indexOf(".");
  if (first !== -1) {
    // A second separator is a typo, not a thousands mark — "1.2.3" keeps "1.2"
    // rather than becoming "123", which would be another silent tenfold error.
    s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, "");
  }
  return s;
}

// Whole-number fields: months, minutes, counts. No separator survives at all.
export function integerText(text) {
  if (text == null) return "";
  return String(text).replace(/[^0-9]/g, "");
}

// Parses a value that may still carry a comma — a figure from an import, a
// synced profile, or a field that predates decimalText.
export function toNumber(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/,/g, "."));
}
