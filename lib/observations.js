import { todayKey } from "./day";
import { boundedNumber, LIMITS } from "./bounds";
import { TEXT_LIMITS, limitText } from "./textLimits";
import { CAPS, capped } from "./caps";
// ─────────────────────────────────────────────────────────────────────────────
// What this animal has been doing.
//
// The livestock record answers "when did I get it, where from, what did it
// cost" and then goes quiet for the next five years. Everything that happens
// to an animal after it arrives — a coral colouring up, a fish that stopped
// eating for a week in March and recovered, a pair that spawned, growth from
// frag to colony — lands in the tank journal as prose, mixed in with water
// changes and equipment notes, and is unfindable within a month.
//
// A keeper asking "has this coral actually grown, or do I just want it to have"
// has the photographs and no measurements. This adds a dated observation log
// per species, with an optional size, so the answer is arithmetic.
//
// Deliberately keyed by species name, alongside `quantities` and `stockMeta`,
// rather than reshaping stock into per-individual records. Every screen, the
// compatibility engine and the bioload maths keep working untouched, which is
// the same trade lib/livestock.js made and for the same reason.
// ─────────────────────────────────────────────────────────────────────────────

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

// The kinds of thing worth recording. Each is something a keeper would search
// for later, which is the test for whether it belongs here rather than in the
// journal.
export const KINDS = [
  { id: "note", label: "Note", icon: "create-outline" },
  { id: "growth", label: "Growth", icon: "resize-outline" },
  { id: "health", label: "Health", icon: "medkit-outline" },
  { id: "behaviour", label: "Behaviour", icon: "eye-outline" },
  { id: "breeding", label: "Breeding", icon: "egg-outline" },
  { id: "colour", label: "Colour", icon: "color-palette-outline" },
];

export const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[0];

export function newObservation({ kind = "note", text = "", size = null, date, unit = "in", photo = null } = {}) {
  const body = String(text || "").trim();
  const measurement = boundedNumber(size, LIMITS.sizeInches);
  // An observation with no words, no measurement and no photo records nothing.
  // A photo on its own is a perfectly good entry — for a coral it's often the
  // only record that matters, and demanding a caption is how people stop.
  if (!body && !photo && measurement == null) return null;
  return {
    id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind: kindOf(kind).id,
    text: limitText(body, TEXT_LIMITS.shortNote),
    size: measurement == null ? null : round(measurement, 2),
    unit,
    photo: photo || null,
    date: date || todayKey(),
  };
}

export const observationsFor = (tank = {}, name) => ((tank.observations || {})[name] || []);

// Newest first, matching every other log in the app.
export function addObservation(existing = {}, name, observation) {
  if (!observation || !name) return existing;
  const list = [observation, ...(existing[name] || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { ...existing, [name]: capped(list, CAPS.observationsPerSpecies) };
}

export function removeObservation(existing = {}, name, id) {
  const list = (existing[name] || []).filter((o) => o.id !== id);
  const next = { ...existing };
  if (list.length) next[name] = list;
  else delete next[name];
  return next;
}

// Has it actually grown? Only measurements count — a note saying "getting big"
// is a feeling, and the whole point of recording a number is to check it.
export function growth(observations = []) {
  const sized = observations
    .filter((o) => o && Number.isFinite(o.size) && o.size > 0 && o.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (sized.length < 2) {
    return { ok: false, points: sized.length, reason: sized.length ? "One measurement so far — record another to see growth." : "Record a size and Pocket Reef will track growth from it." };
  }

  const first = sized[0];
  const last = sized[sized.length - 1];
  const days = Math.max(1, Math.round((new Date(last.date) - new Date(first.date)) / 86400000));
  const change = round(last.size - first.size, 2);
  const pct = first.size ? round((change / first.size) * 100, 1) : null;

  return {
    ok: true,
    points: sized.length,
    series: sized,
    first,
    last,
    days,
    change,
    pct,
    perMonth: round((change / days) * 30.4, 3),
    // A shrinking coral is a real and important observation, not a rounding
    // error, so it's reported as plainly as growth.
    direction: change > 0 ? "grew" : change < 0 ? "shrank" : "unchanged",
    unit: last.unit || "in",
    summary:
      change === 0
        ? `No measurable change across ${days} days.`
        : `${change > 0 ? "Grew" : "Shrank"} ${Math.abs(change)} ${last.unit || "in"}${pct != null ? ` (${Math.abs(pct)}%)` : ""} over ${days} days.`,
  };
}

// The photographic record for one animal, oldest first — the sequence somebody
// actually wants to look at, which is the opposite of the newest-first order
// everything else uses.
//
// A coral's growth is far more legible as two photographs six months apart than
// as any number, and the app has stored photos against journal entries for
// years without ever being able to line up the same subject over time.
export function photoTimeline(observations = []) {
  const shots = observations
    .filter((o) => o && o.photo && o.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (!shots.length) return { ok: false, shots: [] };

  const first = shots[0];
  const last = shots[shots.length - 1];
  const days = Math.max(0, Math.round((new Date(last.date) - new Date(first.date)) / 86400000));

  return {
    ok: true,
    shots,
    first,
    last,
    days,
    // A pair to compare is only meaningful once there are two on different days.
    comparable: shots.length > 1 && days > 0,
  };
}

// A roll-up across the whole tank, for a card that has to say something before
// anyone has opened an individual animal.
export function summarise(tank = {}) {
  const all = tank.observations || {};
  const names = Object.keys(all).filter((n) => (all[n] || []).length);
  const total = names.reduce((n, name) => n + all[name].length, 0);
  const latest = names
    .flatMap((name) => all[name].map((o) => ({ ...o, name })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
  const growing = names
    .map((name) => ({ name, g: growth(all[name]) }))
    .filter((x) => x.g.ok);
  return { total, tracked: names.length, latest, growing };
}
