import { dayKey, isValidDayKey } from "./day";
// ─────────────────────────────────────────────────────────────────────────────
// Livestock records.
//
// The tank used to be `stock: ["Ocellaris Clownfish", …]` — a list of names and
// nothing else. That's a shopping list, not a record. Anyone who keeps fish
// seriously wants to know:
//
//   • how long has this animal actually been in my tank?
//   • where did it come from, and what did I pay?
//   • what have I lost, when, and what did I think killed it?
//
// The last one matters most and was the one thing the app actively destroyed:
// removing a fish deleted it, so a tank's mortality history — the single most
// diagnostic record a keeper has — could not exist.
//
// Records live in `stockMeta`, keyed by species name, alongside `quantities`.
// Keying by name rather than reshaping `stock` into objects means every
// existing screen, the compatibility engine and the bioload maths keep working
// untouched, and a tank written by an older build loses nothing.
// ─────────────────────────────────────────────────────────────────────────────

export const LOSS_REASONS = [
  { id: "died", label: "Died", icon: "heart-dislike-outline" },
  { id: "rehomed", label: "Rehomed / sold", icon: "swap-horizontal-outline" },
  { id: "moved", label: "Moved to another tank", icon: "git-branch-outline" },
  { id: "removed", label: "Just removing it", icon: "close-circle-outline" },
];

// Only a death is a health event. Rehoming a fish you outgrew is good tank
// management, and counting it against a survival rate would punish it.
export const isMortality = (reason) => reason === "died";

export const LOSS_CAUSES = [
  "Unknown",
  "Disease",
  "Aggression",
  "Water quality",
  "Jumped",
  "Old age",
  "Didn't eat",
  "Arrived weak",
];

const isoDay = (d = new Date()) => dayKey(d);

// A record for a newly added animal. Everything except the name is optional —
// a keeper who just wants the fish in the list must not be made to fill a form.
export function newStockRecord({ addedAt, source = "", price = null, notes = "" } = {}) {
  return {
    addedAt: isValidDayKey(addedAt) ? addedAt : isoDay(),
    source: String(source || "").trim(),
    price: price == null || price === "" ? null : Number(price),
    notes: String(notes || "").trim(),
  };
}

// Days an animal has been in the tank. Null when undated, which is different
// from zero — an undated record shouldn't render as "0 days".
//
// Both sides are normalised to a UTC day boundary, matching getTodayKey and
// every date the app already stores. Using local midnight here instead looked
// right and was off by a full day for every keeper west of UTC: "2026-08-09"
// parses as UTC midnight, and setHours(0,0,0,0) on that instant lands on the
// 8th in any negative offset. A fish added today would have read "1 day".
const MS_DAY = 86400000;
// Local midnight, not UTC midnight.
//
// Stored dates are local calendar keys ("2026-08-17"). Reducing both sides to
// UTC days compared a local key against a UTC day boundary, which in any
// non-UTC zone shifted the answer by one — a fish added yesterday reading as
// "Added today", and a tank's age off by a day either way.
function dayStart(value) {
  if (value == null) return NaN;
  const key = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key) && String(value).length <= 10) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NaN;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function daysInTank(record, now = new Date()) {
  if (!record || !record.addedAt) return null;
  const then = dayStart(record.addedAt);
  const today = dayStart(now);
  if (Number.isNaN(then) || Number.isNaN(today)) return null;
  return Math.max(0, Math.round((today - then) / MS_DAY));
}

// "3 years", "5 months", "12 days" — the unit a keeper would actually say.
export function tenureLabel(record, now = new Date()) {
  const d = daysInTank(record, now);
  if (d == null) return null;
  if (d === 0) return "Added today";
  if (d < 31) return `${d} day${d === 1 ? "" : "s"}`;
  if (d < 365) { const m = Math.round(d / 30.4); return `${m} month${m === 1 ? "" : "s"}`; }
  const y = Math.floor(d / 365);
  const rem = Math.round((d % 365) / 30.4);
  return rem ? `${y}y ${rem}m` : `${y} year${y === 1 ? "" : "s"}`;
}

// A loss entry. `count` matters because someone loses three of a school of six
// and the other three are still swimming.
export function newLoss({ name, reason = "died", cause = "Unknown", count = 1, date, notes = "", record } = {}) {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    name,
    reason,
    // Only a death has a cause; attaching one to a rehoming reads as an
    // accusation about a fish that's fine.
    cause: isMortality(reason) ? cause : null,
    count: Math.max(1, Math.round(Number(count) || 1)),
    date: date || isoDay(),
    notes: String(notes || "").trim(),
    // Snapshotted so the record survives the stockMeta entry being removed —
    // "kept 14 months, from Blue Reef" is the useful part of a loss.
    tenure: record ? tenureLabel(record) : null,
    addedAt: record ? record.addedAt || null : null,
    source: record ? record.source || "" : "",
  };
}

// ── What the record adds up to ───────────────────────────────────────────────

// Total spent on livestock currently in the tank plus everything lost. Kept
// separate: "what's swimming cost me" and "what this hobby has cost me" are
// different questions and keepers ask both.
// How many animals a loss record covers.
//
// newLoss defaults this to 1, so anything this app wrote has it. Records that
// arrive from somewhere else do not: an imported backup, a profile synced from
// a build that predates the field, a hand-edited export. Every arithmetic use
// of it was unguarded, and `0 + undefined` is NaN — which JSON renders as null,
// so the mortality summary came back with a null total, a null top cause and a
// null against every cause. The card shows that where a number should be.
//
// A loss record is at least one animal; that is the honest floor.
export const countOf = (l) => {
  const n = Number(l && l.count);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

export function livestockSpend(stock = [], stockMeta = {}, quantities = {}, losses = []) {
  const priceOf = (name) => {
    const rec = stockMeta[name];
    return rec && typeof rec.price === "number" && !Number.isNaN(rec.price) ? rec.price : 0;
  };
  const current = stock.reduce((sum, name) => sum + priceOf(name) * (quantities[name] || 1), 0);
  // A loss only carries a cost if we knew the price when it was recorded.
  const lost = losses.reduce((sum, l) => sum + (typeof l.price === "number" ? l.price * countOf(l) : 0), 0);
  return { current: round2(current), lost: round2(lost), total: round2(current + lost) };
}

const round2 = (n) => Math.round(n * 100) / 100;

// Mortality summary over a window. This is the number a keeper checks after a
// bad month, and the one that tells them whether it's them or bad luck.
export function mortalitySummary(losses = [], { days = 365, now = new Date() } = {}) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const inWindow = losses.filter((l) => l && isMortality(l.reason) && new Date(l.date) >= cutoff);

  const byCause = {};
  inWindow.forEach((l) => {
    const c = l.cause || "Unknown";
    byCause[c] = (byCause[c] || 0) + countOf(l);
  });

  const total = inWindow.reduce((n, l) => n + countOf(l), 0);
  const topCause = Object.entries(byCause).sort((a, b) => b[1] - a[1])[0] || null;

  return {
    total,
    byCause,
    topCause: topCause ? { cause: topCause[0], count: topCause[1] } : null,
    // A species lost more than once is the signal worth surfacing — one death
    // is bad luck, three of the same fish is a husbandry mismatch.
    repeatOffenders: Object.entries(
      inWindow.reduce((acc, l) => { acc[l.name] = (acc[l.name] || 0) + countOf(l); return acc; }, {})
    ).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
  };
}

// The oldest animal still in the tank, which is the one a keeper is proudest of
// and the best single proxy for whether the tank is actually stable.
export function longestResident(stock = [], stockMeta = {}, now = new Date()) {
  let best = null;
  stock.forEach((name) => {
    const rec = stockMeta[name];
    const d = daysInTank(rec, now);
    if (d == null) return;
    if (!best || d > best.days) best = { name, days: d, label: tenureLabel(rec, now), record: rec };
  });
  return best;
}

// How much of the stock is actually documented. Shown as a nudge, because a
// half-filled record is the state most tanks land in and the app should say so
// rather than implying the history is complete.
export function documentedShare(stock = [], stockMeta = {}) {
  if (!stock.length) return { documented: 0, total: 0, pct: 0 };
  const documented = stock.filter((n) => stockMeta[n] && stockMeta[n].addedAt).length;
  return { documented, total: stock.length, pct: Math.round((documented / stock.length) * 100) };
}
