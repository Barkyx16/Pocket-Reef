// ─────────────────────────────────────────────────────────────────────────────
// The rest of what the app knows, on the screen it opens to.
//
// getTodayActions was written before the analysis engines existed and has never
// been told about any of them. So the app can now work out that a bucket of
// salt runs out on Thursday, that alkalinity is swinging hard enough to burn
// tissue, that the lights are on four hours longer than this tank wants — and
// none of it reaches the one screen a keeper actually opens.
//
// That's the difference between an app with features and an app that helps.
// Analysis nobody navigates to is analysis nobody reads.
//
// Kept in its own module rather than bolted into getTodayActions: that function
// is covered by its own tests and used in several places, and the new signals
// need tank-shaped input it was never given. The caller concatenates.
// ─────────────────────────────────────────────────────────────────────────────

import { forecastInventory, LOW_STOCK_DAYS } from "./inventory";
import { tankStability } from "./stability";
import { assessLighting } from "./lighting";
import { assessArrival } from "./quarantine";
import { records } from "./records";

// Ranks match getTodayActions: 0 is act today, 1 is this week, 2 is when you
// get to it. Anything from here that outranks a real overdue chore would be
// wrong — an analysis insight is never more urgent than ammonia.
// "Salt mix, Carbon and 2 more" — a shopping list in a sentence.
function listNames(rows) {
  const names = rows.map((r) => r.item.name);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

// The engines keep four decimals for their own arithmetic; a home screen
// showing "1.3333 dKH" is a machine talking to itself.
const show = (n) => String(Math.round(Number(n) * 100) / 100);

export function getExtraActions(tank = {}, { waterType = "fresh", now = Date.now() } = {}) {
  const out = [];

  // ── Consumables ───────────────────────────────────────────────────────────
  //
  // Grouped, not listed. Three empty tubs produced three separate lines, and a
  // hub that says the same thing three times is a hub people stop reading —
  // they're one trip to the shop, so they're one action.
  const { needs } = forecastInventory(tank.inventory || [], tank, { now });
  const outOf = needs.filter((n) => n.state === "out");
  const expired = needs.filter((n) => n.state === "expired");
  const low = needs.filter((n) => n.state === "low" && n.daysLeft != null);

  if (outOf.length === 1) {
    out.push({ rank: 0, icon: "🛒", to: "tank", text: `Out of ${outOf[0].item.name} — restock before your next water change` });
  } else if (outOf.length > 1) {
    out.push({ rank: 0, icon: "🛒", to: "tank", text: `Out of ${outOf.length} things — ${listNames(outOf)}` });
  }

  if (expired.length === 1) {
    out.push({ rank: 1, icon: "🛒", to: "tank", text: `${expired[0].item.name} has expired — a bad test kit reads as good news` });
  } else if (expired.length > 1) {
    out.push({ rank: 1, icon: "🛒", to: "tank", text: `${expired.length} things have expired — ${listNames(expired)}` });
  }

  if (low.length === 1) {
    out.push({ rank: 1, icon: "🛒", to: "tank", text: `${low[0].item.name} runs out in about ${low[0].daysLeft} day${low[0].daysLeft === 1 ? "" : "s"}` });
  } else if (low.length > 1) {
    const soonest = low.reduce((a, b) => (a.daysLeft <= b.daysLeft ? a : b));
    out.push({ rank: 1, icon: "🛒", to: "tank", text: `${low.length} things running low — ${soonest.item.name} first, in about ${soonest.daysLeft} days` });
  }

  // ── Stability ─────────────────────────────────────────────────────────────
  // Only the worst one, and only when it's genuinely moving. A list of five
  // parameters that are "fine" is noise on a screen meant for actions.
  const stability = tankStability(tank.waterTests || [], waterType, { now });
  if (stability.ok && stability.worst) {
    const w = stability.worst;
    if (w.grade === "unstable") {
      out.push({ rank: 0, icon: "⚖️", to: "log", text: `${w.label} is swinging ${show(w.perDay)}${w.unit ? ` ${w.unit}` : ""} a day — steadier matters more than closer to ideal` });
    } else if (w.grade === "swinging") {
      out.push({ rank: 1, icon: "⚖️", to: "log", text: `${w.label} is moving faster than it should — worth watching` });
    }
  }

  // ── Lighting ──────────────────────────────────────────────────────────────
  const light = assessLighting(tank);
  if (light.ok && light.verdict === "too-long") {
    out.push({ rank: 1, icon: "💡", to: "log", text: `Lights run ${light.hours} hours — ${light.excess} more than this tank needs, and it's the free algae fix` });
  }

  // ── Quarantine ────────────────────────────────────────────────────────────
  // The old action fired purely on 21 days elapsed. Time alone was never
  // clearance, and telling somebody a fish is "ready" when it stopped eating
  // on day nineteen is the app actively causing the thing quarantine prevents.
  (tank.quarantine || []).forEach((q) => {
    const a = assessArrival(q, { now });
    if (!a.ok) return;
    if (a.ready) {
      out.push({ rank: 2, icon: "✅", to: "tank", text: `${q.name} passed every quarantine check — ready for the display` });
    } else if (a.overdue) {
      out.push({ rank: 1, icon: "⏳", to: "tank", text: `${q.name} is past ${a.days} days but ${a.outstanding.length} check${a.outstanding.length === 1 ? "" : "s"} aren't met` });
    } else {
      out.push({ rank: 2, icon: "👀", to: "tank", text: `${q.name}, quarantine day ${a.day}: ${a.phase.watch[0].toLowerCase()}` });
    }
  });

  return out;
}

// Merges the extras into the existing list without disturbing its contract:
// same shape, same ranks, same ordering rule, and capped so the hub stays a
// list of actions rather than a report.
export function withExtras(actions = [], tank = {}, opts = {}) {
  actions = records(actions);

  const extras = getExtraActions(tank, opts);
  // Sorted even when there's nothing to add. The hub caps the list now, so the
  // cut falls wherever the order puts it — returning the caller's array
  // untouched made "the least urgent item is the one hidden" true only by
  // coincidence, and a hidden ammonia warning is not a coincidence to rely on.
  // Stable: equal ranks keep the order the caller assembled them in.
  return [...actions, ...extras]
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.rank || 0) - (y.a.rank || 0) || x.i - y.i)
    .map((x) => x.a);
}

export { LOW_STOCK_DAYS };
