// ─────────────────────────────────────────────────────────────────────────────
// The light schedule.
//
// Photoperiod is one of the three levers that decide whether a tank grows algae
// or coral, alongside nutrients and flow. The app tracks nutrients in obsessive
// detail, mentions flow in the gear guide, and has never once asked how long
// the lights are on.
//
// So the single most common cause of an algae outbreak — a light left on
// twelve hours because that's when the keeper is home to look at the tank — is
// invisible to every diagnostic in the app. It's also the cheapest thing in the
// hobby to fix: it costs nothing and takes ten seconds on a timer.
//
// What's "right" depends entirely on what the tank holds. A fish-only tank
// wants the shortest photoperiod its keeper can stand; an SPS reef needs a long
// one and will pale without it. Grading every tank against one number would be
// worse than not grading at all.
// ─────────────────────────────────────────────────────────────────────────────

import { getSpecies } from "../core";

// Hours of light per day that suit each kind of tank, and why.
export const PROFILES = [
  {
    id: "fishonly",
    label: "Fish only",
    ideal: [6, 8],
    max: 9,
    blurb: "Fish don't need light to be healthy — it's for you to see them. Short is safe.",
  },
  {
    id: "planted",
    label: "Planted",
    ideal: [7, 9],
    max: 10,
    blurb: "Long enough for the plants to outcompete algae, short enough that algae can't catch up.",
  },
  {
    id: "soft",
    label: "Soft coral / LPS",
    ideal: [8, 10],
    max: 11,
    blurb: "Forgiving corals. Anything past ten hours mostly feeds algae.",
  },
  {
    id: "sps",
    label: "SPS / mixed reef",
    ideal: [9, 11],
    max: 12,
    blurb: "SPS pale on a short photoperiod. Intensity matters more than hours, but hours matter.",
  },
];

export const profileOf = (id) => PROFILES.find((p) => p.id === id) || PROFILES[0];

// What the tank actually holds decides the profile, so nobody has to know which
// category they're in. Declared stock wins where it's unambiguous.
export function suggestProfile(tank = {}) {
  const species = (tank.stock || []).map(getSpecies).filter(Boolean);
  const corals = species.filter((s) => s.kind === "coral");
  if (corals.length) {
    // Hard corals are the demanding case; the app's care levels are the best
    // available proxy for SPS without a dedicated field.
    const demanding = corals.some((s) => s.careLevel === "Hard");
    return demanding ? "sps" : "soft";
  }
  if ((tank.water || "fresh") === "fresh" && (tank.plants || []).length) return "planted";
  return "fishonly";
}

const pad = (n) => String(n).padStart(2, "0");

// "18:30" → minutes since midnight. Anything unparseable is null rather than 0,
// because midnight is a real answer and "I don't know" is not.
export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export const toClock = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

export function newLightSchedule({ on = "10:00", off = "20:00", profile, rampMinutes = 0 } = {}) {
  return {
    on: toMinutes(on) == null ? "10:00" : on,
    off: toMinutes(off) == null ? "20:00" : off,
    profile: profile || null,
    // Ramp is counted as half-intensity time — a sunrise/sunset does grow
    // algae, just less of it than full blast.
    rampMinutes: Math.max(0, Math.min(240, Number(rampMinutes) || 0)),
  };
}

// Hours per day, handling a schedule that crosses midnight.
export function dailyHours(schedule) {
  if (!schedule) return null;
  const on = toMinutes(schedule.on);
  const off = toMinutes(schedule.off);
  if (on == null || off == null) return null;
  const span = off >= on ? off - on : 1440 - on + off;
  // Ramp sits inside the on-period and counts half.
  const ramp = Math.min(Number(schedule.rampMinutes) || 0, span);
  const effective = span - ramp / 2;
  return Math.round((effective / 60) * 10) / 10;
}

// A schedule that exists but carries no times is the same thing as no schedule.
//
// This matters because migrations.ensureTankShape fills a missing field from
// its default, and `typeof null === "object"` means a null default arrives as
// `{}` rather than null. Every tank stored before this feature therefore has a
// truthy-but-empty lightSchedule, and without this check every one of them
// would be told its schedule "couldn't be read" instead of being asked to set
// one — an error message where the invitation should be.
export const hasSchedule = (schedule) => Boolean(schedule && (schedule.on || schedule.off));

export function assessLighting(tank = {}) {
  const schedule = tank.lightSchedule;
  if (!hasSchedule(schedule)) {
    return { ok: false, reason: "Set your light schedule and Pocket Reef can tell you whether it's feeding algae or your corals." };
  }
  const hours = dailyHours(schedule);
  if (hours == null) return { ok: false, reason: "That schedule couldn't be read — use 24-hour times like 10:00 and 20:00." };

  const profile = profileOf(schedule.profile || suggestProfile(tank));
  const [lo, hi] = profile.ideal;

  let verdict;
  if (hours > profile.max) verdict = "too-long";
  else if (hours > hi) verdict = "long";
  else if (hours < lo - 1) verdict = "short";
  else verdict = "good";

  return {
    ok: true,
    hours,
    schedule,
    profile,
    verdict,
    ideal: `${lo}–${hi} hours`,
    // The excess, which is the number to act on — "cut an hour" is advice
    // somebody can follow tonight.
    excess: hours > hi ? Math.round((hours - hi) * 10) / 10 : 0,
    note:
      verdict === "too-long"
        ? `${hours} hours is well past what a ${profile.label.toLowerCase()} tank needs. This alone will grow algae faster than any amount of water changing removes it.`
        : verdict === "long"
          ? `${hours} hours is longer than the ${lo}–${hi} a ${profile.label.toLowerCase()} tank wants. Cutting ${Math.round((hours - hi) * 10) / 10} hour${hours - hi >= 2 ? "s" : ""} is the cheapest algae control there is.`
          : verdict === "short"
            ? `${hours} hours is on the short side for a ${profile.label.toLowerCase()} tank. ${profile.blurb}`
            : `${hours} hours suits a ${profile.label.toLowerCase()} tank. ${profile.blurb}`,
  };
}

// The change worth making, as a concrete new schedule rather than advice.
export function suggestSchedule(tank = {}) {
  const current = tank.lightSchedule;
  const profile = profileOf((current && current.profile) || suggestProfile(tank));
  const target = profile.ideal[1];
  const on = current ? toMinutes(current.on) : toMinutes("10:00");
  if (on == null) return null;
  // Trimmed from the end of the day: keepers want the lights on when they're
  // home in the evening, and taking it off the front is the change they'll
  // actually keep.
  return newLightSchedule({
    on: toClock(on),
    off: toClock((on + target * 60) % 1440),
    profile: profile.id,
    rampMinutes: current ? current.rampMinutes : 0,
  });
}
