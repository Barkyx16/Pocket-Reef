// ─────────────────────────────────────────────────────────────────────────────
// Which tank needs you, and why.
//
// Multi-tank keepers had no way to find out. The tank chip named the active
// tank, the switcher listed size, water type and a fish count — three facts
// that never change — and every card in the app reports on the active tank
// only. So a second tank with ammonia in it looked exactly like a second tank
// that was fine, and the only way to tell them apart was to switch to each one
// in turn and read Home. The information existed in every tank's own record;
// nothing ever compared them.
//
// This is deliberately narrow. It answers "does this tank need me today", not
// "is this tank well kept" — a stocking warning is real but permanent, and a
// badge that never clears is a badge people stop seeing.
// ─────────────────────────────────────────────────────────────────────────────

import { assessParam } from "../core";
import { activeParams } from "./targets";
import { instantOf } from "./day";

// Used when reminders are off, or set to a cadence that doesn't apply. Whether
// a tank is overdue is a fact about the tank, not about notification settings —
// turning reminders off should silence notifications, not blind the app.
const DEFAULT_TEST_DAYS = 7;
const DEFAULT_CHANGE_DAYS = 14;

const CADENCE = { weekly: 7, biweekly: 14 };

export const daysSince = (date, now = Date.now()) => {
  if (!date) return null;
  const t = instantOf(date);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86400000);
};

// "urgent" outranks "due" outranks "ok" — used to sort and to pick one colour
// for a tank with several things wrong.
const RANK = { ok: 0, due: 1, urgent: 2 };

export function tankAttention(tank = {}, { reminderPrefs = {}, now = Date.now() } = {}) {
  const reasons = [];
  let level = "ok";
  const raise = (next) => { if (RANK[next] > RANK[level]) level = next; };

  const tests = tank.waterTests || [];
  const latest = tests[0];

  // A dangerous reading on the most recent test outranks every schedule. It is
  // also the only reason here that isn't about elapsed time — the tank can be
  // perfectly on schedule and still be poisoning its fish.
  if (latest && latest.values) {
    const params = activeParams(latest.water || tank.water || "fresh");
    const bad = params.filter((p) => assessParam(p, latest.values[p.key]).status === "danger");
    if (bad.length) {
      raise("urgent");
      reasons.push(bad.length === 1 ? `${bad[0].label} dangerous` : `${bad.length} readings dangerous`);
    }
  }

  const testEvery = CADENCE[reminderPrefs.waterTest] || DEFAULT_TEST_DAYS;
  const changeEvery = CADENCE[reminderPrefs.waterChange] || DEFAULT_CHANGE_DAYS;

  // A tank with nothing in it isn't overdue for anything — it's unused, and
  // badging an empty tank teaches people to ignore the badge.
  const stocked = (tank.stock || []).length > 0;

  if (stocked) {
    const sinceTest = latest ? daysSince(latest.date, now) : null;
    if (sinceTest == null) {
      raise("due");
      reasons.push("Never tested");
    } else if (sinceTest >= testEvery) {
      raise("due");
      reasons.push(`Test ${sinceTest}d ago`);
    }

    const sinceChange = daysSince((tank.maintenance || {}).waterchange, now);
    if (sinceChange != null && sinceChange >= changeEvery) {
      raise("due");
      reasons.push(`Change ${sinceChange}d ago`);
    }
  }

  return { level, reasons, needsAttention: level !== "ok" };
}

// The same verdict for a list of tanks, keyed by id, plus whether anything
// other than `exceptId` is asking for attention. The active tank is excluded
// from the summary on purpose: its problems are already the entire Home
// screen, and a dot on the tank chip should mean "somewhere you aren't".
export function attentionFor(tanks = [], opts = {}) {
  const { exceptId = null } = opts;
  const byId = {};
  let elsewhere = "ok";
  tanks.forEach((tk) => {
    if (!tk || !tk.id) return;
    const a = tankAttention(tk, opts);
    byId[tk.id] = a;
    if (tk.id !== exceptId && RANK[a.level] > RANK[elsewhere]) elsewhere = a.level;
  });
  return { byId, elsewhere, anyElsewhere: elsewhere !== "ok" };
}
