import { allTasks, sortedByUrgency, statusLabel } from "./upkeep";
import { DOSABLE, dosedToday } from "./dosingLog";
import { REEF_TARGETS } from "./dosing";
import { todayKey as localDayKey, daysSinceKey } from "./day";
import { records } from "./records";

// ─────────────────────────────────────────────────────────────────────────────
// What this tank needs, right now, in one list.
//
// The app grew a lot of good record-keeping and spread it across seven cards on
// two tabs. Each one is fine on its own; together they mean a keeper doing their
// evening round has to remember where everything lives, and check each place to
// find out whether it needs them. That's the opposite of what a daily routine
// should feel like.
//
// This assembles the whole round into one ordered list. Crucially every item is
// *completable in place* — the sheet that shows it can tick it off, so the
// answer to "what does my tank need?" and the doing of it are the same gesture.
//
// It is deliberately different from getTodayActions, which produces prompts
// that navigate somewhere. These are things you finish without leaving.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86400000;
// Local, not UTC — see lib/day.js.
const todayKey = () => localDayKey();
// Calendar days, not elapsed milliseconds.
//
// `new Date("2026-08-17")` is parsed as UTC midnight, and subtracting that from
// a local `Date.now()` mixes two different clocks — in California it made every
// stored day-key look a day older than it was, so "tested 20 days ago" read as
// 21. Full ISO timestamps (quarantine start dates) still measure elapsed time,
// which is what they mean.
const daysSince = (d) => {
  if (!d) return Infinity;
  const key = String(d).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const n = daysSinceKey(key);
    return n == null ? Infinity : n;
  }
  return Math.floor((Date.now() - new Date(d).getTime()) / DAY);
};

// Cadence in days, matching the reminder preferences vocabulary.
const cadence = (pref) => (pref === "biweekly" ? 14 : pref === "weekly" ? 7 : null);

// `kind` tells the sheet how to complete the item:
//   upkeep  — mark a maintenance task done (needs task id)
//   feed    — log a feeding
//   test    — routed: opens the water-test form, which needs real input
//   dose    — routed: opens the dose log
//   qt      — routed: a quarantine animal is ready to move
// waterType is passed in rather than derived here: resolving it properly needs
// the species catalog, and a small scheduling helper importing core.js would
// create an import cycle (core already depends on upkeep). The caller has it.
export function pendingNow(tank = {}, { reminderPrefs = {}, feedings = [], waterType = "fresh", now = Date.now() } = {}) {
  if (!tank || typeof tank !== "object") return [];
  const out = [];
  const maintenance = tank.maintenance || {};

  // 1. Overdue and due jobs, most overdue first. These are the bulk of a round
  //    and the only items that can be finished with a single tap.
  const jobs = sortedByUrgency(allTasks(tank), maintenance, now)
    .filter((r) => r.status.state === "overdue" || r.status.state === "due");

  jobs.forEach(({ task, status }) => {
    out.push({
      id: `upkeep:${task.id}`,
      kind: "upkeep",
      taskId: task.id,
      label: task.label,
      sub: statusLabel(status),
      urgent: status.state === "overdue",
      icon: task.emoji,
    });
  });

  // 2. A water test that's come due on the keeper's own cadence. Routed rather
  //    than one-tap: a test is real numbers, and a button that claimed to log
  //    one without them would be recording a fiction.
  const testEvery = cadence(reminderPrefs.waterTest || "weekly");
  const lastTest = (tank.waterTests || [])[0];
  if (testEvery != null) {
    const since = daysSince(lastTest && lastTest.date);
    if (since >= testEvery) {
      out.push({
        id: "test",
        kind: "test",
        label: "Test your water",
        sub: lastTest ? `Last tested ${since} days ago` : "No test logged yet",
        urgent: since >= testEvery * 2,
        icon: "🧪",
      });
    }
  }

  // 3. Dosing, only for a reef that has actually established a routine. Nagging
  //    someone who has never dosed to dose is how an app invents a chore.
  if (waterType === "salt") {
    const doses = tank.doses || [];
    if (doses.length) {
      const done = dosedToday(doses, todayKey());
      // What they normally dose, judged by the last fortnight.
      const recent = new Set(
        doses.filter((d) => daysSince(d.date) <= 14).map((d) => d.key)
      );
      const missing = DOSABLE.filter((k) => recent.has(k) && !done.includes(k));
      if (missing.length) {
        out.push({
          id: "dose",
          kind: "dose",
          label: `Dose ${missing.map((k) => REEF_TARGETS[k].label.toLowerCase()).join(", ")}`,
          sub: "Part of your daily routine — not logged today",
          urgent: false,
          icon: "💉",
        });
      }
    }
  }

  // 4. Feeding, if it's a habit they track and today is blank.
  if ((feedings || []).length) {
    const fedToday = feedings.some((f) => f && f.date === todayKey());
    if (!fedToday) {
      out.push({
        id: "feed",
        kind: "feed",
        label: "Log a feeding",
        sub: "Nothing recorded today",
        urgent: false,
        icon: "🍤",
      });
    }
  }

  // 5. Quarantine finished — the animal is waiting on a decision.
  (tank.quarantine || []).forEach((q) => {
    if (q && daysSince(q.startDate) >= 21) {
      out.push({
        id: `qt:${q.id}`,
        kind: "qt",
        label: `${q.name} finished quarantine`,
        sub: "Ready to move into the display tank",
        urgent: false,
        icon: "✅",
      });
    }
  });

  // Urgent first, otherwise the order they were assembled in — which is already
  // roughly the order a keeper would work through them.
  return out.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
}

// The same round, across every tank a keeper owns.
//
// pendingNow only ever described the active tank, so someone with a display,
// a frag tank and a quarantine — which is what the paid multi-tank feature is
// for — had to switch tanks three times just to find out whether anything
// needed them. "All in one place" has to mean all of it.
//
// Each item carries the tank it belongs to, so the sheet can tick a job off on
// a tank that isn't the one currently open.
export function pendingAcrossTanks(tanks = [], { reminderPrefs = {}, waterTypeFor = () => "fresh", now = Date.now() } = {}) {
  return (Array.isArray(tanks) ? tanks : [])
    .filter(Boolean)
    .map((tank) => {
      const items = pendingNow(tank, {
        reminderPrefs,
        feedings: tank.feedings || [],
        waterType: waterTypeFor(tank),
        now,
      }).map((item) => ({ ...item, tankId: tank.id, tankName: tank.name, id: `${tank.id}:${item.id}` }));
      // How far behind this tank actually is, not just how many boxes are
      // unticked. One job 90 days overdue is a worse tank than two jobs five
      // days overdue, and counting alone can't tell them apart.
      const worstOverdue = items.reduce((worst, i) => {
        const m = /Overdue by (\d+)d/.exec(i.sub || "");
        return m ? Math.max(worst, Number(m[1])) : worst;
      }, 0);
      return { tank, items, worstOverdue };
    })
    .filter((g) => g.items.length)
    // The tank in the worst state leads, so a neglected frag tank can't hide
    // behind a display that's perfectly on schedule.
    .sort((a, b) => {
      if (a.worstOverdue !== b.worstOverdue) return b.worstOverdue - a.worstOverdue;
      const urgent = b.items.filter((i) => i.urgent).length - a.items.filter((i) => i.urgent).length;
      return urgent !== 0 ? urgent : b.items.length - a.items.length;
    });
}

// Flattened, for a badge count.
export const flattenPending = (groups = []) => records(groups).flatMap((g) => records(g.items));

// One line for a badge or a header.
export function pendingSummary(items = []) {
  items = records(items);

  if (!items.length) return { count: 0, urgent: 0, text: "Nothing needs you right now" };
  const urgent = items.filter((i) => i.urgent).length;
  return {
    count: items.length,
    urgent,
    text: urgent
      ? `${urgent} overdue, ${items.length} thing${items.length === 1 ? "" : "s"} to do`
      : `${items.length} thing${items.length === 1 ? "" : "s"} to do`,
  };
}
