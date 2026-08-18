import { tenureLabel, mortalitySummary, livestockSpend, isMortality } from "./livestock";
import { effectiveParams } from "./targets";
import { upkeepSummary, statusLabel } from "./upkeep";
import { summarise as summariseChanges } from "./waterChanges";
import { byCategory, ageLabel, warrantyLabel } from "./equipment";
import { DOSABLE, recentDoseDays, consumptionRate, describeConsumption } from "./dosingLog";
import { REEF_TARGETS } from "./dosing";
import { assessParam } from "../data/waterParams";
import { versionLabel } from "./buildInfo";
import { dayKey } from "./day";
import { fmtMoney } from "./format";

// ─────────────────────────────────────────────────────────────────────────────
// The tank report.
//
// Export already existed, but it produced a JSON blob (a backup, for the app to
// read back) and a water-only CSV. Neither is the thing a keeper actually needs
// to hand over. When you walk into a fish store with a sick fish, or post on a
// forum, the first reply is always the same list of questions: how big, how
// old, what's in it, what are your parameters, what have you already tried.
//
// This answers all of them in one paste-able block. It's plain text on purpose:
// it survives a forum post, a text message, and an email to a shop, none of
// which will open a .json.
// ─────────────────────────────────────────────────────────────────────────────

const line = (label, value) => (value == null || value === "" ? null : `${label}: ${value}`);
const section = (title, body) => (body && body.length ? `\n${title}\n${"-".repeat(title.length)}\n${body}` : "");

// Ages the tank in the units people say out loud.
export function tankAge(createdAt, now = new Date()) {
  if (!createdAt) return null;
  const then = new Date(createdAt);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.max(0, Math.round((new Date(now) - then) / 86400000));
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30.4);
  // Past about a year and a half nobody counts in months — "23 months" is a
  // number you have to do arithmetic on to picture.
  if (months < 18) return `${months} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export function buildTankReport(tank, { now = new Date(), unitLabel = "gal", strengths = {} } = {}) {
  if (!tank) return "";
  const water = tank.water === "salt" ? "Saltwater" : "Freshwater";
  const params = effectiveParams(tank.water || "fresh", tank.targets || {});
  const latest = (tank.waterTests || [])[0];
  const stock = tank.stock || [];
  const meta = tank.stockMeta || {};
  const losses = tank.losses || [];

  // ── The tank itself
  const overview = [
    line("Tank", tank.name),
    line("Volume", `${tank.gallons} ${unitLabel}`),
    line("Type", water),
    line("Running for", tankAge(tank.createdAt, now)),
    line("Stock", stock.length ? `${stock.length} species` : "Empty"),
  ].filter(Boolean).join("\n");

  // ── Latest water, graded against THIS tank's targets, with the target shown.
  // A bare number means nothing to a reader who doesn't know what you're
  // aiming for, which is the whole reason the target is printed beside it.
  const waterBody = latest
    ? params
        .map((p) => {
          const v = latest.values ? latest.values[p.key] : null;
          if (v == null) return null;
          const a = assessParam(p, v);
          const flag = a.status === "good" ? "" : a.status === "caution" ? "  <-- watch" : "  <-- OUT OF RANGE";
          return `${p.label}: ${v}${p.unit ? ` ${p.unit}` : ""}   (target ${p.ideal})${flag}`;
        })
        .filter(Boolean)
        .join("\n")
    : "";

  const waterHeader = latest ? `Last tested ${latest.date}` : "";
  const customCount = Object.keys(tank.targets || {}).length;
  const targetNote = customCount ? `\n(${customCount} target${customCount === 1 ? "" : "s"} set for this tank, not app defaults)` : "";

  // ── Livestock, with how long each has been kept. Tenure is the single most
  // useful thing a shop or a forum can know: a fish you've had two years
  // rules out a whole class of answers about acclimation.
  const stockBody = stock
    .map((name) => {
      const rec = meta[name];
      const qty = (tank.quantities || {})[name] || 1;
      const bits = [];
      const t = rec ? tenureLabel(rec, now) : null;
      if (t) bits.push(`kept ${t}`);
      if (rec && rec.source) bits.push(`from ${rec.source}`);
      if (rec && rec.notes) bits.push(rec.notes);
      return `${qty > 1 ? `${qty}x ` : ""}${name}${bits.length ? ` (${bits.join(", ")})` : ""}`;
    })
    .join("\n");

  // ── Losses. The history a shop will ask about and most keepers can't recall.
  const mort = mortalitySummary(losses, { days: 365, now });
  const lossBody = losses
    .slice(0, 20)
    .map((l) => {
      const bits = [l.date];
      if (l.cause) bits.push(l.cause);
      if (l.tenure) bits.push(`kept ${l.tenure}`);
      return `${l.count > 1 ? `${l.count}x ` : ""}${l.name} — ${isMortality(l.reason) ? "died" : l.reason} (${bits.join(", ")})`;
    })
    .join("\n");

  const lossSummary = mort.total
    ? `${mort.total} lost in the last year${mort.topCause ? `, mostly ${mort.topCause.cause.toLowerCase()}` : ""}.`
    : losses.length
      ? "No deaths in the last year."
      : "";

  // ── Upkeep, because "when did you last change water / clean the filter" is
  // question three, every time. Reported by the same status the app shows, so
  // the paste matches what the keeper is looking at — and raw task ids
  // ("filterclean: 2026-07-02") are replaced by the labels a human reads.
  // "When did you last change water, and how much?" is the first question a
  // shop asks and the report could only answer half of it.
  const wc = summariseChanges(tank.waterChanges || [], {
    tankGallons: tank.gallons, now: new Date(now).getTime(),
  });
  const wcBody = wc.count
    ? [
      `Last change: ${wc.last === 0 ? "today" : `${wc.last} days ago`}`,
      wc.volume30 ? `Changed in 30 days: ${wc.volume30} ${unitLabel}${wc.turnover30 != null ? ` (${wc.turnover30}% of volume)` : ""}` : null,
      wc.average != null ? `Typical size: ${wc.average}%` : null,
      wc.cadence.reason,
    ].filter(Boolean).join("\n")
    : "";

  const upkeep = upkeepSummary(tank, new Date(now).getTime());
  const maintBody = upkeep.rows
    .filter((r) => r.status.state !== "never")
    .slice(0, 12)
    .map((r) => `${r.task.label}: ${statusLabel(r.status)}`)
    .join("\n");
  const overdueLine = upkeep.overdue
    ? `${upkeep.overdue} job${upkeep.overdue === 1 ? "" : "s"} overdue.`
    : "";

  // ── Treatments in progress. A shop recommending a medication needs to know
  // what's already in the water.
  const treatBody = (tank.treatments || [])
    .map((t) => `${t.disease} — started ${String(t.startedAt).slice(0, 10)}, ${(t.doneSteps || []).length} steps done`)
    .join("\n");

  const recentNotes = (tank.journal || [])
    .slice(0, 5)
    .map((e) => `${e.date}: ${e.text}`)
    .join("\n");

  const spend = livestockSpend(stock, meta, tank.quantities || {}, losses);

  // ── The hardware. "What's on the tank?" is question two in any diagnostic
  // conversation, and the report couldn't answer it at all.
  const gearBody = byCategory(tank.equipment || [])
    .map(({ category, items }) => {
      const lines = items.map((i) => {
        const bits = [i.brand, ageLabel(i, new Date(now).getTime()), warrantyLabel(i, new Date(now).getTime())].filter(Boolean);
        return `  ${i.name}${bits.length ? ` (${bits.join(", ")})` : ""}`;
      });
      return `${category.label}:\n${lines.join("\n")}`;
    })
    .join("\n");

  // ── Dosing. A shop recommending a supplement needs to know what's already
  // going in, and at what rate the tank is using it.
  const doses = tank.doses || [];
  const doseBody = DOSABLE
    .map((key) => {
      const rate = consumptionRate({
        key, waterTests: tank.waterTests || [], doses,
        ratedGallons: tank.gallons, strengthPerUnit: strengths[key], now: new Date(now).getTime(),
      });
      if (!rate.ok) return null;
      return `${REEF_TARGETS[key].label}: ${describeConsumption(key, rate)}`;
    })
    .filter(Boolean)
    .join("\n");

  const recentDoses = recentDoseDays(doses, 5)
    .map((row) => `  ${row.date}: ${DOSABLE.filter((k) => row.totals[k]).map((k) => `${REEF_TARGETS[k].label} ${row.totals[k]}ml`).join(", ")}`)
    .join("\n");

  return [
    `POCKET REEF — TANK REPORT`,
    // The build that produced the report. Someone answering a forum post needs
    // to know whether the numbers came from a version that had the bug.
    `Generated ${dayKey(new Date(now))} · Pocket Reef ${versionLabel()}`,
    "",
    overview,
    section("WATER" + (waterHeader ? ` (${waterHeader})` : ""), waterBody + targetNote),
    section("LIVESTOCK", stockBody),
    section("HISTORY", [lossSummary, lossBody].filter(Boolean).join("\n\n")),
    section("EQUIPMENT", gearBody),
    section("DOSING", [doseBody, recentDoses ? `Recent doses:\n${recentDoses}` : ""].filter(Boolean).join("\n\n")),
    section("TREATMENTS IN PROGRESS", treatBody),
    section("WATER CHANGES", wcBody),
    section("UPKEEP", [overdueLine, maintBody].filter(Boolean).join("\n\n")),
    section("RECENT NOTES", recentNotes),
    spend.total ? section("SPEND", `Livestock to date: ${fmtMoney(spend.total)}`) : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}
