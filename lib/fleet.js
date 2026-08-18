// ─────────────────────────────────────────────────────────────────────────────
// Every tank, side by side.
//
// Multi-tank is the paid feature, and what it bought you was a switcher. Each
// tank is scored, graded, forecast and analysed in complete isolation, so a
// keeper with three of them has three separate apps and no way to ask the
// question that having three tanks creates:
//
//     why is the nano thriving and the display struggling?
//
// The answer is nearly always visible in the records — one gets tested twice as
// often, or gets water changed on time, or is half as heavily stocked — and it
// took switching back and forth and holding both in your head. This compares
// them on the measures that differ, and says what the gap actually is.
// ─────────────────────────────────────────────────────────────────────────────

import { getTankHealthScore, getBioload } from "../core";
import { tankStability } from "./stability";
import { tankAttention } from "./attention";
import { mortalitySummary } from "./livestock";
import { observedInterval } from "./cadence";
import { round1 as round } from "./num";


// The measures worth comparing across tanks. Each says how to read it, so the
// comparison can explain a gap rather than just rank on it.
const MEASURES = [
  { id: "health", label: "Health", better: "high", format: (v) => (v == null ? "—" : `${v}%`) },
  { id: "stability", label: "Stability", better: "high", format: (v) => (v == null ? "—" : `${v}`) },
  { id: "testEvery", label: "Tested every", better: "low", format: (v) => (v == null ? "—" : `${v}d`) },
  { id: "stocking", label: "Stocked", better: "low", format: (v) => (v == null ? "—" : `${v}%`) },
  { id: "losses", label: "Losses (1y)", better: "low", format: (v) => (v == null ? "—" : `${v}`) },
];

export function profileTank(tank = {}, opts = {}) {
  const now = opts.now || Date.now();
  const water = tank.water || "fresh";
  const tests = tank.waterTests || [];

  const health = getTankHealthScore({
    tank: tank.stock || [],
    tankGallons: tank.gallons,
    waterTests: tests,
    maintenance: tank.maintenance || {},
    quantities: tank.quantities || {},
    waterType: water,
  });
  const stability = tankStability(tests, water, { now });
  const attention = tankAttention(tank, { now, reminderPrefs: opts.reminderPrefs });
  const load = getBioload(tank.gallons, tank.stock || [], tank.quantities || {});
  const mortality = mortalitySummary(tank.losses || [], { now: new Date(now) });

  // Testing cadence across whichever parameter is logged most — a fair proxy
  // for "how often does this tank get tested at all".
  const cadences = ["nitrate", "alk", "ph", "ammonia"]
    .map((k) => observedInterval(tests, k, { now }))
    .filter((v) => v != null);
  const testEvery = cadences.length ? Math.min(...cadences) : null;

  return {
    id: tank.id,
    name: tank.name,
    emoji: tank.emoji || "🐠",
    gallons: tank.gallons,
    water,
    stocked: (tank.stock || []).length,
    measures: {
      health: health && health.score != null ? health.score : null,
      stability: stability.ok ? stability.score : null,
      testEvery,
      stocking: load && load.pct != null ? round(load.pct, 0) : null,
      losses: mortality ? mortality.total : 0,
    },
    attention,
    worstParam: stability.ok ? stability.worst : null,
  };
}

// Ranks tanks and explains the gap between the best and the worst.
export function compareFleet(tanks = [], opts = {}) {
  const profiles = tanks.filter((t) => t && t.id).map((t) => profileTank(t, opts));
  if (profiles.length < 2) {
    return { ok: false, profiles, reason: "Add a second tank and Pocket Reef will compare them." };
  }

  // Rank on health where it exists, falling back to stability. A tank too new
  // to score either sorts last without being called worst.
  const scoreOf = (p) => {
    const parts = [p.measures.health, p.measures.stability].filter((v) => v != null);
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  };
  const scored = profiles.map((p) => ({ p, score: scoreOf(p) }));
  const ranked = [...scored].sort((a, b) => {
    if (a.score == null && b.score == null) return 0;
    if (a.score == null) return 1;
    if (b.score == null) return -1;
    return b.score - a.score;
  });

  const best = ranked[0].score != null ? ranked[0].p : null;
  const worstEntry = [...ranked].reverse().find((r) => r.score != null);
  const worst = worstEntry && best && worstEntry.p.id !== best.id ? worstEntry.p : null;

  // What actually differs between them, biggest gap first — only where both
  // tanks have the measure, because a missing number isn't a difference.
  const differences = [];
  if (best && worst) {
    MEASURES.forEach((m) => {
      const a = best.measures[m.id];
      const b = worst.measures[m.id];
      if (a == null || b == null) return;
      const betterForBest = m.better === "high" ? a > b : a < b;
      if (!betterForBest) return;
      const gap = Math.abs(a - b);
      if (!gap) return;
      differences.push({
        id: m.id,
        label: m.label,
        best: m.format(a),
        worst: m.format(b),
        gap,
        // Normalised so a 30-point health gap and a 4-day cadence gap are
        // comparable; without it the measure with the biggest raw units always
        // wins and the ordering is meaningless.
        weight: gap / Math.max(Math.abs(a), Math.abs(b), 1),
      });
    });
    differences.sort((x, y) => y.weight - x.weight);
  }

  const needsAttention = profiles.filter((p) => p.attention.needsAttention);

  return {
    ok: true,
    profiles,
    ranked: ranked.map((r) => ({ ...r.p, score: r.score == null ? null : Math.round(r.score) })),
    best,
    worst,
    differences,
    needsAttention,
    headline: !best
      ? "None of these tanks has enough logged to compare yet."
      : !worst
        ? `${best.name} is your best-documented tank.`
        : differences.length
          ? `${best.name} is ahead of ${worst.name}, and the biggest difference is ${differences[0].label.toLowerCase()} — ${differences[0].best} against ${differences[0].worst}.`
          : `${best.name} and ${worst.name} are running about the same.`,
  };
}

export { MEASURES };
