// ─────────────────────────────────────────────────────────────────────────────
// What to check when something dies.
//
// Recording a death updated the stock list and said nothing. That is the single
// worst moment in the app to have nothing to say: the keeper is upset, they
// want to know whether it was their fault, and the honest answer is usually
// "here is what the record can tell you" — which the app had and never offered.
//
// Everything here is drawn from this tank rather than from general advice. A
// keeper who has just lost a fish has already read the general advice; what
// they can't do is cross-reference their own last four readings against the
// day the animal arrived.
//
// Two rules govern the tone:
//
//   * It never speculates about blame. Where the record supports a cause it
//     says so with the number; where it doesn't, it says the record can't tell.
//   * It never treats one death as a crisis. Animals die of old age and of
//     nothing at all, and an app that responds to every loss with alarm is one
//     people stop telling about losses — which costs them the pattern that
//     would have mattered.
// ─────────────────────────────────────────────────────────────────────────────

import { getSpecies, getCompatibility, assessParam } from "../core";
import { activeParams } from "./targets";
import { isMortality } from "./livestock";
import { daysInTank } from "./livestock";
import { instantOf } from "./day";

// A fish that has been in the tank less than this didn't die of old age.
const RECENT_ARRIVAL_DAYS = 30;
// A reading older than this can't speak to what happened this week.
const STALE_TEST_DAYS = 14;
// More than this many deaths in the window is a pattern rather than bad luck.
const CLUSTER_DAYS = 30;
const CLUSTER_COUNT = 3;

const dayOf = (d) => instantOf(d);
const daysAgo = (d, now) => (d ? Math.floor((now - dayOf(d)) / 86400000) : null);

export function reviewLoss(loss, tank = {}, { now = Date.now(), waterType = "fresh" } = {}) {
  if (!loss) return { ok: false };

  // Rehoming a fish you outgrew is good tank management. Only a death is a
  // health event, and treating a sale as one would be both wrong and insulting.
  if (!isMortality(loss.reason)) {
    return { ok: true, mortality: false, findings: [], headline: "Recorded. Nothing else to check — this wasn't a loss to the tank's health." };
  }

  const species = getSpecies(loss.name);
  const findings = [];
  const latest = (tank.waterTests || [])[0];
  const testAge = latest ? daysAgo(latest.date, now) : null;

  // ── The readings ──────────────────────────────────────────────────────────
  if (!latest) {
    findings.push({
      id: "no-test",
      tone: "act",
      title: "Test the water now",
      body: "There's no water test on record. Whatever happened, the reading you take today is the one that tells you whether anything else in there is at risk.",
    });
  } else if (testAge != null && testAge > STALE_TEST_DAYS) {
    findings.push({
      id: "stale-test",
      tone: "act",
      title: "Test the water now",
      body: `Your last test was ${testAge} days ago. A current reading is the fastest way to find out whether this was a one-off or something the rest of the tank is still sitting in.`,
    });
  } else if (latest.values) {
    // Name the actual bad readings rather than saying "check your water".
    const bad = activeParams(waterType)
      .filter((p) => latest.values[p.key] != null)
      .map((p) => ({ p, a: assessParam(p, latest.values[p.key]) }))
      .filter((x) => x.a.status === "danger" || x.a.status === "caution");

    if (bad.length) {
      const worst = bad.find((x) => x.a.status === "danger") || bad[0];
      findings.push({
        id: "bad-reading",
        tone: worst.a.status === "danger" ? "act" : "watch",
        title: `${worst.p.label} was ${worst.a.status === "danger" ? "dangerous" : "off"} ${testAge === 0 ? "today" : `${testAge} days ago`}`,
        body: `Your last test read ${worst.p.label} at ${latest.values[worst.p.key]}${worst.p.unit ? ` ${worst.p.unit}` : ""} against a target of ${worst.p.ideal}. That doesn't prove it was the cause, but it's the thing in your record most worth fixing before anything else is affected.`,
      });
    } else {
      findings.push({
        id: "clean-water",
        tone: "good",
        title: "Your water was in range",
        body: `Everything in your test from ${testAge === 0 ? "today" : `${testAge} days ago`} graded fine, so the record doesn't point at water quality. That's worth knowing — it rules out the most common cause.`,
      });
    }
  }

  // ── How long it had been there ────────────────────────────────────────────
  const record = (tank.stockMeta || {})[loss.name] || loss.record || null;
  const tenure = record ? daysInTank(record, new Date(now)) : null;
  if (tenure != null && tenure <= RECENT_ARRIVAL_DAYS) {
    findings.push({
      id: "new-arrival",
      tone: "watch",
      title: `It had only been in the tank ${tenure} day${tenure === 1 ? "" : "s"}`,
      body: "Most losses this soon are the shop, the journey or the acclimation rather than anything you did afterwards. A longer quarantine is the one thing that reliably changes this — it moves the risk out of your display.",
    });
  } else if (tenure != null && tenure > 365) {
    findings.push({
      id: "long-resident",
      tone: "good",
      title: `You kept it ${Math.floor(tenure / 365)} year${tenure >= 730 ? "s" : ""}`,
      body: "That's a full life for many species. Old age is a real cause and it isn't a failure.",
    });
  }

  // ── Was it being bullied? ─────────────────────────────────────────────────
  if (species) {
    const others = (tank.stock || []).filter((n) => n !== loss.name);
    const clash = others
      .map((n) => ({ n, c: getCompatibility(loss.name, n) }))
      .find((x) => x.c.level === "avoid");
    if (clash) {
      findings.push({
        id: "conflict",
        tone: "act",
        title: `${clash.n} is still in there`,
        body: `${clash.c.reason} If that's what happened, it will happen again to the next one.`,
      });
    }

    // A schooling fish kept below its minimum is a slow, invisible stressor.
    const kept = (tank.quantities || {})[loss.name] || 0;
    if (species.minGroup > 1 && kept > 0 && kept < species.minGroup) {
      findings.push({
        id: "under-group",
        tone: "watch",
        title: `You're down to ${kept}, and they want ${species.minGroup}+`,
        body: "Schooling species kept below their group size hide, stop eating and fade. The remaining ones are now at the same risk unless the group is topped back up.",
      });
    }
  }

  // ── Is this a pattern? ────────────────────────────────────────────────────
  const recentDeaths = (tank.losses || []).filter((l) => {
    if (!l || !isMortality(l.reason)) return false;
    const age = daysAgo(l.date, now);
    return age != null && age >= 0 && age <= CLUSTER_DAYS;
  });
  const deathCount = recentDeaths.reduce((n, l) => n + (Number(l.count) || 1), 0);
  if (deathCount >= CLUSTER_COUNT) {
    findings.push({
      id: "cluster",
      tone: "act",
      title: `${deathCount} losses in the last ${CLUSTER_DAYS} days`,
      body: "That's more than bad luck. Something in the tank is ongoing rather than one-off — water, aggression or disease — and it's worth working through the troubleshooter properly rather than replacing what you've lost.",
    });
  }

  // Ordered so the thing to do today is first.
  const rank = { act: 0, watch: 1, good: 2 };
  findings.sort((a, b) => rank[a.tone] - rank[b.tone]);

  const act = findings.filter((f) => f.tone === "act");
  return {
    ok: true,
    mortality: true,
    findings,
    urgent: act.length,
    headline: act.length
      ? `${act.length} thing${act.length === 1 ? "" : "s"} worth doing before this affects anything else.`
      : findings.length
        ? "Nothing in your record points at a cause you can fix."
        : "Recorded. There's not enough in the log yet to say anything useful about why.",
  };
}
