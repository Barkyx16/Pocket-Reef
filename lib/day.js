// ─────────────────────────────────────────────────────────────────────────────
// What day is it, where the keeper is standing?
//
// Every dated record in this app was stamped with `new Date().toISOString()
// .slice(0, 10)`, which is the date in UTC — not the date on the wall behind
// the tank. For roughly half the world that is silently, routinely wrong:
//
//   • California, 5:30pm on 17 August → stamped 18 August
//   • New Zealand, 9am on 17 August   → stamped 16 August
//
// Everything downstream inherits it. A water test logged after work files under
// tomorrow, so "tested today" reads false and the cadence engine thinks you
// tested a day later than you did. The streak counts a day you didn't log and
// misses one you did. Daily challenges roll over mid-afternoon. Correlation
// brackets an event against the wrong reading.
//
// The fix is to build the key from local calendar fields rather than from an
// instant expressed in UTC. Stored keys are unchanged in format, so existing
// data keeps working — a tank logged in the old scheme just has a handful of
// entries filed a day out, which no migration can reliably distinguish from a
// keeper who genuinely logged at that time.
// ─────────────────────────────────────────────────────────────────────────────

// "YYYY-MM-DD" for the given moment, in the device's own timezone.
export function dayKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const todayKey = () => dayKey(new Date());

// A "YYYY-MM-DD" key back to a Date at LOCAL midnight.
//
// `new Date("2026-08-17")` is parsed as UTC midnight by spec, so in any western
// timezone it lands on the 16th locally — which is how a date the keeper typed
// can come back a day earlier than they typed it.
export function fromDayKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || "").slice(0, 10));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Whole days between two day-keys, calendar-wise. Uses local midnights, so a
// daylight-saving boundary can't turn 24 hours into 23 and round the wrong way.
export function daysBetweenKeys(a, b) {
  const from = fromDayKey(a);
  const to = fromDayKey(b);
  if (!from || !to) return null;
  return Math.round((to - from) / 86400000);
}

// Days from a stored key until now, in the keeper's own days.
export function daysSinceKey(key, now = new Date()) {
  return daysBetweenKeys(key, dayKey(now));
}

export function addDaysToKey(key, n) {
  const d = fromDayKey(key);
  if (!d) return null;
  d.setDate(d.getDate() + Number(n || 0));
  return dayKey(d);
}

// A stored date to a comparable instant.
//
// The engines each had a private `new Date(x).getTime()`, which parses
// "2026-08-17" as UTC midnight. Ahead of Greenwich that instant is later than
// local "now" for most of the day, so today's reading looked like it was in the
// future and every age filter silently discarded it — a keeper in Auckland got
// "not enough readings" from stability, cadence and correlation with a test
// they had just logged.
export function instantOf(value) {
  if (value == null) return NaN;
  const key = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key) && String(value).length <= 10) {
    const d = fromDayKey(key);
    return d ? d.getTime() : NaN;
  }
  return new Date(value).getTime();
}

// Drops entries from a day-keyed map older than `keepDays`.
//
// `careDone` is keyed by day and was never pruned: every day a keeper ticks a
// care task added a key that stayed forever. Nothing reads any day but today —
// but the whole map syncs to the account, goes into every export, and is copied
// into every restore point, so five years of ticked boxes rode along in all of
// them. Kept for a fortnight, which is longer than anything displays it.
export function pruneDayMap(map = {}, keepDays = 14, now = new Date()) {
  const cutoff = dayKey(new Date(new Date(now).getTime() - keepDays * 86400000));
  if (!cutoff) return map;
  const out = {};
  Object.keys(map || {}).forEach((k) => {
    // A key that isn't a day is left alone rather than silently discarded.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k >= cutoff) out[k] = map[k];
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Is a typed date real?
//
// Four screens let a keeper type a date into a plain text field — a water test
// backdated to when it was actually run, an install date, a purchase. Nothing
// checked them, and the Date constructor is famously forgiving: it does not
// reject an impossible date, it rolls it over. "2026-02-30" becomes March 2nd
// and "2026-13-45" lands in February of the following year.
//
// That is worse than a rejection, because the record is stored, sorted, and
// charted at a date the keeper never chose and has no reason to look for. A
// water test filed seven months out doesn't look wrong in a list — it looks
// missing.
// ─────────────────────────────────────────────────────────────────────────────
export function isValidDayKey(value) {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1) return false;
  // Day 0 of the next month is the last day of this one, which handles leap
  // years without a table.
  const lastDay = new Date(y, mo, 0).getDate();
  if (d > lastDay) return false;
  // A tank logged before aquaria existed, or years into the future, is a typo
  // in the year — the single most common way this field goes wrong.
  if (y < 1970 || y > new Date().getFullYear() + 5) return false;
  return true;
}

// Is this day today or earlier?
//
// Every dated record in this app describes something that HAPPENED — a test
// that was run, a fish that went in, a part that was fitted. None of them can
// be in the future, and a year typed wrong is the easiest mistake there is to
// make in a YYYY-MM-DD field.
//
// It matters more than it looks. A water test dated next year sorts to the top
// and stays there: it becomes "your latest reading" on every screen, the health
// score grades the tank on it, and the cadence engine paces testing from it —
// for a whole year, with nothing on screen to explain why the app is describing
// water the keeper does not have.
export function isPastOrToday(value, now = new Date()) {
  if (!isValidDayKey(value)) return false;
  return String(value).trim() <= dayKey(now);
}

// What to tell someone who typed one wrong. Returns null when it's fine, so it
// reads as `const problem = dayKeyProblem(input)`.
export function dayKeyProblem(value, { allowFuture = false, now = new Date() } = {}) {
  if (value == null || value === "") return null; // blank means "today"
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "Use YYYY-MM-DD, like 2026-03-14.";
  if (!allowFuture && isValidDayKey(s) && !isPastOrToday(s, now)) {
    return "That date is in the future — check the year.";
  }
  if (!isValidDayKey(s)) {
    const [y, mo, d] = s.split("-").map(Number);
    if (mo < 1 || mo > 12) return `There's no month ${mo}.`;
    const lastDay = new Date(y, mo, 0).getDate();
    if (d < 1 || d > lastDay) return `${s.slice(0, 7)} only has ${lastDay} days.`;
    return "That year looks like a typo.";
  }
  return null;
}
