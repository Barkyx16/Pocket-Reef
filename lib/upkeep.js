import { instantOf } from "./day";
import { records } from "./records";
import { TEXT_LIMITS, limitText } from "./textLimits";
// ─────────────────────────────────────────────────────────────────────────────
// Upkeep: everything with an interval.
//
// The app shipped four hardcoded chores — water change, filter clean, gravel
// vac, glass clean — and no way to add a fifth. That's a betta bowl's worth of
// maintenance. A real tank also has media to swap, a skimmer to strip down, an
// RODI membrane with a TDS creep, probes to calibrate, bulbs that lose spectrum
// months before they die, and pumps to descale. None of it could be recorded,
// so the one question a keeper asks constantly — "when did I last do this?" —
// had four possible answers out of twenty.
//
// Chores and equipment servicing are the same model: a thing with an interval
// and a last-done date. Building one system covers both, and means an RODI
// membrane behaves exactly like a water change everywhere in the app.
//
// STORAGE NOTE: task *definitions* live in `tank.upkeep`; the last-done date
// for every task — built-in or custom — stays in the existing
// `tank.maintenance` map, keyed by task id. That's deliberate: it means years
// of existing maintenance history keeps working untouched, and logMaintenance()
// needed no changes at all.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86400000;

// The chores every tank has, whatever's in it.
const COMMON = [
  { id: "waterchange", label: "Water change", emoji: "🔁", days: 7, kind: "chore" },
  { id: "filterclean", label: "Filter clean / rinse", emoji: "🧽", days: 30, kind: "chore" },
  { id: "glassclean", label: "Glass / algae clean", emoji: "✨", days: 10, kind: "chore" },
];

// Freshwater-specific. Gravel vac matters where there's substrate detritus.
const FRESH = [
  { id: "gravelvac", label: "Gravel vacuum", emoji: "🌀", days: 14, kind: "chore" },
  { id: "filtermedia", label: "Replace filter media", emoji: "🧻", days: 60, kind: "gear" },
  { id: "plantrim", label: "Trim plants", emoji: "🌿", days: 21, kind: "chore" },
];

// Reef-specific. These are the jobs that actually fill a reefer's calendar and
// none of them existed.
const SALT = [
  { id: "skimmerclean", label: "Clean the skimmer cup", emoji: "🫧", days: 7, kind: "gear" },
  { id: "filtersock", label: "Change filter socks", emoji: "🧦", days: 4, kind: "gear" },
  { id: "carbon", label: "Replace carbon / GFO", emoji: "⚫", days: 30, kind: "gear" },
  { id: "atotop", label: "Top up ATO reservoir", emoji: "🚰", days: 5, kind: "chore" },
  { id: "probecal", label: "Calibrate probes", emoji: "🎯", days: 60, kind: "gear" },
  { id: "rodi", label: "Check RODI / TDS", emoji: "💧", days: 30, kind: "gear" },
  { id: "pumpclean", label: "Clean pumps & powerheads", emoji: "🌀", days: 90, kind: "gear" },
  { id: "saltmix", label: "Mix fresh saltwater", emoji: "🧂", days: 14, kind: "chore" },
];

export const defaultTasks = (waterType) => [...COMMON, ...(waterType === "salt" ? SALT : FRESH)];

// Suggestions offered when adding a task, so nobody has to think up "replace
// the UV bulb" from a blank field.
export const SUGGESTIONS = {
  salt: [
    { label: "Replace UV bulb", emoji: "💡", days: 180 },
    { label: "Deep clean the sump", emoji: "🧰", days: 180 },
    { label: "Replace heater", emoji: "🌡️", days: 730 },
    { label: "ICP test", emoji: "🔬", days: 90 },
  ],
  fresh: [
    { label: "Replace air stone", emoji: "🫧", days: 90 },
    { label: "Dose fertiliser", emoji: "🌱", days: 7 },
    { label: "Replace heater", emoji: "🌡️", days: 730 },
    { label: "Deep clean the filter", emoji: "🧰", days: 180 },
  ],
};

export const suggestionsFor = (waterType) => SUGGESTIONS[waterType] || SUGGESTIONS.fresh;

// A custom task. Intervals are clamped rather than rejected: somebody typing
// 0 means "often", not "divide by zero in the due-date maths".
function clampDays(days) {
  if (days === null || days === undefined || days === "") return 30;
  const n = Number(days);
  if (Number.isNaN(n)) return 30;
  return Math.max(1, Math.min(3650, Math.round(n)));
}

export function newUpkeepTask({ label, emoji = "🧰", days = 30, kind = "chore", notes = "" } = {}) {
  const clean = String(label || "").trim();
  if (!clean) return null;
  return {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: limitText(clean, TEXT_LIMITS.name),
    emoji: emoji || "🧰",
    // `Number(days) || 30` would turn a typed 0 into 30 — silently the
    // opposite of what the keeper asked for. Only a missing value defaults.
    days: clampDays(days),
    kind: kind === "gear" ? "gear" : "chore",
    notes: limitText(String(notes || "").trim(), TEXT_LIMITS.shortNote),
    custom: true,
  };
}

// Every task for a tank: the built-ins for its water type, plus custom ones,
// minus any built-in the keeper has switched off. A tank without a skimmer
// shouldn't be nagged about the skimmer cup forever.
export function allTasks(tank = {}) {
  const water = tank.water === "salt" ? "salt" : "fresh";
  const custom = Array.isArray(tank.upkeep) ? tank.upkeep.filter((t) => t && t.id && t.label) : [];
  const off = new Set(custom.filter((t) => t.disabled).map((t) => t.id));
  // A custom entry can also *override* a built-in's interval by sharing its id.
  const overrides = new Map(custom.filter((t) => !t.custom).map((t) => [t.id, t]));

  const builtIns = defaultTasks(water)
    .filter((t) => !off.has(t.id))
    .map((t) => (overrides.has(t.id) ? { ...t, ...overrides.get(t.id) } : t));

  return [...builtIns, ...custom.filter((t) => t.custom && !t.disabled)];
}

// Calendar days, in the keeper's own timezone. Stored maintenance dates are
// local day-keys; parsing them as UTC midnight and subtracting a local `now`
// mixed two clocks and shifted "done 4 days ago" by one either way.
const dayDiff = (from, to) => Math.floor((to - instantOf(from)) / DAY);

// Where a task stands right now.
//
// "soon" exists so the list can warn before something is late — a filter sock
// you're told about on the day it's due is a filter sock you change tomorrow.
export function taskStatus(task, maintenance = {}, now = Date.now()) {
  const last = maintenance[task.id];
  const interval = Math.max(1, task.days || 30);

  if (!last || Number.isNaN(new Date(last).getTime())) {
    return { state: "never", daysSince: null, dueIn: null, pct: 0, interval };
  }

  const daysSince = Math.max(0, dayDiff(last, now));
  const dueIn = interval - daysSince;
  const pct = Math.min(100, Math.round((daysSince / interval) * 100));

  let state = "ok";
  if (dueIn < 0) state = "overdue";
  else if (dueIn === 0) state = "due";
  else if (dueIn <= Math.max(1, Math.round(interval * 0.2))) state = "soon";

  return { state, daysSince, dueIn, pct, interval };
}

const RANK = { overdue: 0, due: 1, never: 2, soon: 3, ok: 4 };

// Tasks ordered by how much they need you, so the top of the list is always
// the thing to do next.
export function sortedByUrgency(tasks, maintenance = {}, now = Date.now()) {
  tasks = records(tasks);

  return [...tasks]
    .map((t) => ({ task: t, status: taskStatus(t, maintenance, now) }))
    .sort((a, b) => {
      const r = RANK[a.status.state] - RANK[b.status.state];
      if (r !== 0) return r;
      // Within a state, the most overdue (or soonest due) first.
      const ad = a.status.dueIn == null ? 0 : a.status.dueIn;
      const bd = b.status.dueIn == null ? 0 : b.status.dueIn;
      return ad - bd;
    });
}

// The one-line answer for the Home screen and the tank report.
export function upkeepSummary(tank = {}, now = Date.now()) {
  const tasks = allTasks(tank);
  const rows = sortedByUrgency(tasks, tank.maintenance || {}, now);
  const overdue = rows.filter((r) => r.status.state === "overdue");
  const due = rows.filter((r) => r.status.state === "due");
  const soon = rows.filter((r) => r.status.state === "soon");
  const neverLogged = rows.filter((r) => r.status.state === "never");

  return {
    total: rows.length,
    overdue: overdue.length,
    due: due.length,
    soon: soon.length,
    neverLogged: neverLogged.length,
    // What to actually do next — overdue beats due beats never-logged.
    next: (overdue[0] || due[0] || soon[0] || null),
    rows,
  };
}

// Human phrasing, used by the card, Today's actions and the report so all three
// say the same thing about the same task.
export function statusLabel(status) {
  if (status.state === "never") return `Every ${status.interval}d · never logged`;
  if (status.state === "overdue") return `Overdue by ${-status.dueIn}d`;
  if (status.state === "due") return "Due today";
  if (status.daysSince === 0) return `Done today · next in ${status.dueIn}d`;
  return `Done ${status.daysSince}d ago · due in ${status.dueIn}d`;
}
