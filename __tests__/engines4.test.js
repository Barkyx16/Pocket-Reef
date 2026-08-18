// Lighting, algae, running cost, the established-tank setup and observations.
//
// The algae engine is the one that most needs holding to account: it makes
// claims about causes, and the failure mode of every algae guide ever written
// is confident generic advice. So it's tested for the cases where it must
// contradict the usual answer, and for refusing to assert a cause it can't
// measure.

const { newLightSchedule, dailyHours, assessLighting, suggestProfile, suggestSchedule, toMinutes, profileOf } = require("../lib/lighting");
const { ALGAE_TYPES, typeOf, typesFor, diagnose } = require("../lib/algae");
const { runningCost, itemDraw, ownershipTotal, TYPICAL_WATTS, DEFAULT_RATE } = require("../lib/running");
const { buildSetup, createdAtFor, whatsMissing, inferCreatedAt, ageOf } = require("../lib/existingTank");
const { newObservation, addObservation, removeObservation, growth, summarise, observationsFor } = require("../lib/observations");
const { newEquipment } = require("../lib/equipment");

// Day keys built the way the app builds them: local calendar fields, not UTC.
// These fixtures previously used toISOString(), which is the exact assumption
// the app was fixed for — so in any non-UTC zone the fixture's "today" and the
// app's "today" were different days.
function localDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


const NOW = new Date("2026-08-17T12:00:00Z").getTime();
const dayAgo = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values, water = "salt") => ({ date, water, values });



// ─────────────────────────────────────────────────────────────────────────────
describe("the light schedule", () => {
  test("hours are counted from the clock, including across midnight", () => {
    expect(dailyHours(newLightSchedule({ on: "10:00", off: "20:00" }))).toBe(10);
    expect(dailyHours(newLightSchedule({ on: "22:00", off: "06:00" }))).toBe(8);
  });

  test("a ramp counts as half — a sunrise grows algae, just less of it", () => {
    expect(dailyHours(newLightSchedule({ on: "10:00", off: "20:00", rampMinutes: 120 }))).toBe(9);
  });

  test("an unreadable time is refused rather than treated as midnight", () => {
    expect(toMinutes("25:00")).toBeNull();
    expect(toMinutes("nonsense")).toBeNull();
    // The constructor falls back rather than storing junk.
    expect(dailyHours(newLightSchedule({ on: "nope", off: "20:00" }))).toBe(10);
  });

  test("the profile follows what's actually in the tank", () => {
    expect(suggestProfile({ stock: [], water: "fresh" })).toBe("fishonly");
    expect(suggestProfile({ stock: ["Ocellaris Clownfish"], water: "salt" })).toBe("fishonly");
  });

  test("twelve hours on a fish-only tank is called out", () => {
    const tank = { stock: [], water: "fresh", lightSchedule: newLightSchedule({ on: "09:00", off: "21:00" }) };
    const a = assessLighting(tank);
    expect(a.verdict).toBe("too-long");
    expect(a.excess).toBe(4);
    expect(a.note).toMatch(/grow algae/i);
  });

  test("the same schedule on an SPS reef is fine, because the tank is different", () => {
    const tank = { stock: [], lightSchedule: newLightSchedule({ on: "09:00", off: "20:00", profile: "sps" }) };
    expect(assessLighting(tank).verdict).toBe("good");
  });

  test("without a schedule it asks for one rather than assuming", () => {
    expect(assessLighting({}).ok).toBe(false);
  });

  test("the suggestion is a real schedule, trimmed from the morning", () => {
    const tank = { stock: [], water: "fresh", lightSchedule: newLightSchedule({ on: "09:00", off: "21:00" }) };
    const next = suggestSchedule(tank);
    expect(next.on).toBe("09:00");
    expect(dailyHours(next)).toBe(profileOf("fishonly").ideal[1]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("diagnosing algae", () => {
  const reefBase = { createdAt: new Date(NOW - 700 * 86400000).toISOString(), water: "salt" };

  test("it works back from the tank's own readings", () => {
    const tank = {
      ...reefBase,
      waterTests: [test0(dayAgo(1), { nitrate: 40, phosphate: 0.3 })],
      lightSchedule: newLightSchedule({ on: "08:00", off: "20:00", profile: "sps" }),
    };
    const d = diagnose("hair", tank, "salt");
    expect(d.ok).toBe(true);
    expect(d.confirmed.map((c) => c.id)).toEqual(expect.arrayContaining(["nitrate", "phosphate"]));
    expect(d.confirmed.some((c) => c.fix.includes("0.3"))).toBe(true);
  });

  test("the free fix is offered first, because that's what gets done today", () => {
    const tank = {
      ...reefBase,
      waterTests: [test0(dayAgo(1), { nitrate: 40, phosphate: 0.3 })],
      lightSchedule: newLightSchedule({ on: "08:00", off: "22:00", profile: "sps" }),
    };
    const d = diagnose("hair", tank, "salt");
    expect(d.firstStep.id).toBe("light");
    expect(d.firstStep.free).toBe(true);
  });

  test("a new tank's brown dust contradicts the usual advice, and says so", () => {
    const tank = {
      createdAt: new Date(NOW - 30 * 86400000).toISOString(),
      waterTests: [test0(dayAgo(1), { nitrate: 0, phosphate: 0 })],
    };
    const d = diagnose("diatoms", tank, "salt");
    expect(d.headline).toMatch(/normal/i);
    expect(d.contradiction).toMatch(/makes it last longer/i);
  });

  test("clean readings are admitted as unexplained rather than blamed on nutrients", () => {
    const tank = {
      ...reefBase,
      waterTests: [test0(dayAgo(1), { nitrate: 2, phosphate: 0.01 })],
      lightSchedule: newLightSchedule({ on: "10:00", off: "19:00", profile: "sps" }),
    };
    const d = diagnose("hair", tank, "salt");
    expect(d.confirmed).toHaveLength(0);
    expect(d.contradiction).toMatch(/nothing in your record explains/i);
  });

  test("causes the record can't measure are offered to check, never asserted", () => {
    const tank = { ...reefBase, waterTests: [test0(dayAgo(1), { nitrate: 2, phosphate: 0.01 })] };
    const d = diagnose("cyano", tank, "salt");
    expect(d.possible.some((p) => p.id === "flow")).toBe(true);
    expect(d.confirmed.some((c) => c.id === "flow")).toBe(false);
  });

  test("reef and freshwater are held to different nutrient thresholds", () => {
    const tests = [test0(dayAgo(1), { nitrate: 30 })];
    const reef = diagnose("hair", { ...reefBase, waterTests: tests }, "salt");
    const fresh = diagnose("hair", { createdAt: reefBase.createdAt, waterTests: tests }, "fresh");
    expect(reef.confirmed.some((c) => c.id === "nitrate")).toBe(true);
    expect(fresh.confirmed.some((c) => c.id === "nitrate")).toBe(false);
  });

  test("the type list suits the water", () => {
    expect(typesFor("salt").some((t) => t.id === "bryopsis")).toBe(true);
    expect(typesFor("fresh").some((t) => t.id === "bryopsis")).toBe(false);
    expect(typesFor("fresh").some((t) => t.id === "bba")).toBe(true);
  });

  test("an unknown type asks rather than guesses", () => {
    expect(diagnose("nope", {}, "salt").ok).toBe(false);
    expect(typeOf("nope")).toBeNull();
    expect(ALGAE_TYPES.length).toBeGreaterThan(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("what the tank costs to run", () => {
  const heater = newEquipment({ name: "Heater", category: "heating", watts: 300 });
  const light = newEquipment({ name: "Light", category: "lighting", watts: 100 });
  const pump = newEquipment({ name: "Return", category: "flow", watts: 30 });

  test("a heater is costed on its duty cycle, not 24 hours flat out", () => {
    const draw = itemDraw(heater);
    expect(draw.hoursPerDay).toBeCloseTo(7.2, 1);
    expect(draw.estimated).toBe(false);
  });

  test("a light is costed on the actual photoperiod", () => {
    const eight = itemDraw(light, { lightHours: 8 });
    const twelve = itemDraw(light, { lightHours: 12 });
    expect(twelve.kWhPerMonth).toBeGreaterThan(eight.kWhPerMonth);
  });

  test("the monthly bill adds up, and names the biggest draw", () => {
    const tank = { equipment: [heater, light, pump], lightSchedule: newLightSchedule({ on: "10:00", off: "20:00" }) };
    const r = runningCost(tank, { rate: 0.2 });
    expect(r.ok).toBe(true);
    expect(r.perMonth).toBeGreaterThan(0);
    expect(r.perYear).toBeCloseTo(r.perMonth * 12, 1);
    expect(r.biggest.name).toBeDefined();
    expect(r.confidence).toBe("measured");
  });

  test("a guessed wattage is marked as guessed rather than passed off as measured", () => {
    const noWatts = newEquipment({ name: "Mystery pump", category: "flow" });
    const r = runningCost({ equipment: [noWatts] });
    expect(r.rows[0].estimated).toBe(true);
    expect(r.rows[0].watts).toBe(TYPICAL_WATTS.flow);
    expect(r.confidence).toBe("estimated");
  });

  test("it prices an hour of photoperiod, which is the lever you can pull", () => {
    const tank = { equipment: [light], lightSchedule: newLightSchedule({ on: "10:00", off: "20:00" }) };
    expect(runningCost(tank, { rate: 0.2 }).perLightHour).toBeGreaterThan(0);
  });

  test("no equipment means no invented bill", () => {
    expect(runningCost({}).ok).toBe(false);
  });

  test("ownership adds the running cost to what was spent", () => {
    const tank = {
      equipment: [heater, light],
      createdAt: new Date(NOW - 365 * 86400000).toISOString(),
      lightSchedule: newLightSchedule({ on: "10:00", off: "20:00" }),
    };
    const o = ownershipTotal(tank, { rate: DEFAULT_RATE, spent: 500, now: NOW });
    expect(o.months).toBeCloseTo(12, 0);
    expect(o.electricity).toBeGreaterThan(0);
    expect(o.total).toBeCloseTo(500 + o.electricity, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("setting up a tank that already exists", () => {
  test("an age becomes a real createdAt, so maturity starts from the truth", () => {
    const created = createdAtFor("years", NOW);
    const days = Math.round((NOW - new Date(created).getTime()) / 86400000);
    expect(days).toBe(ageOf("years").days);
  });

  test("the answers become a patch, not a replacement tank", () => {
    const patch = buildSetup({ ageId: "year", gallons: 75, water: "salt", stock: ["Ocellaris Clownfish"], readings: { nitrate: 10, alk: 8.4 }, now: NOW });
    expect(patch.id).toBeUndefined(); // never invents an id over the existing one
    expect(patch.gallons).toBe(75);
    expect(patch.waterTests[0].values).toEqual({ nitrate: 10, alk: 8.4 });
    expect(patch.stock).toEqual(["Ocellaris Clownfish"]);
  });

  test("blank readings don't become zeroes", () => {
    const patch = buildSetup({ ageId: "new", gallons: 20, water: "fresh", readings: { nitrate: "", ph: "7.4" }, now: NOW });
    expect(patch.waterTests[0].values).toEqual({ ph: 7.4 });
  });

  test("no readings at all means no fabricated test", () => {
    expect(buildSetup({ ageId: "new", gallons: 20, water: "fresh", now: NOW }).waterTests).toBeUndefined();
  });

  test("what's missing is ordered and says what each thing buys", () => {
    const missing = whatsMissing({ gallons: 40, stock: ["Ocellaris Clownfish"], waterTests: [] });
    expect(missing.some((m) => m.id === "test")).toBe(true);
    missing.forEach((m) => expect(m.why.length).toBeGreaterThan(10));
  });

  test("a fully described tank has nothing left to ask for", () => {
    const complete = {
      gallons: 40,
      stock: ["Ocellaris Clownfish"],
      waterTests: [test0(dayAgo(1), { nitrate: 5 }), test0(dayAgo(8), { nitrate: 5 }), test0(dayAgo(15), { nitrate: 5 })],
      equipment: [newEquipment({ name: "Heater", category: "heating" })],
      sourceWater: { values: { nitrate: 0 } },
      lightSchedule: newLightSchedule({}),
    };
    expect(whatsMissing(complete)).toHaveLength(0);
  });

  test("an imported history implies an established tank", () => {
    const created = inferCreatedAt({ waterTests: [test0("2022-01-05", { nitrate: 5 }), test0("2024-06-01", { nitrate: 5 })] });
    expect(created.slice(0, 10)).toBe("2022-01-05");
    expect(inferCreatedAt({})).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("observations and growth", () => {
  const name = "Ocellaris Clownfish";

  test("an observation needs words or a measurement", () => {
    expect(newObservation({ text: "  " })).toBeNull();
    expect(newObservation({ text: "Spawned again" })).toBeTruthy();
    expect(newObservation({ size: 2.5 })).toBeTruthy();
  });

  test("they're stored per species, newest first", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ text: "Older", date: dayAgo(10) }));
    obs = addObservation(obs, name, newObservation({ text: "Newer", date: dayAgo(1) }));
    expect(observationsFor({ observations: obs }, name)[0].text).toBe("Newer");
  });

  test("growth is arithmetic on measurements, never on adjectives", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ kind: "growth", size: 2, date: dayAgo(90) }));
    obs = addObservation(obs, name, newObservation({ kind: "note", text: "looks bigger", date: dayAgo(45) }));
    obs = addObservation(obs, name, newObservation({ kind: "growth", size: 3, date: dayAgo(0) }));

    const g = growth(obs[name]);
    expect(g.ok).toBe(true);
    expect(g.points).toBe(2); // the prose note isn't a data point
    expect(g.change).toBe(1);
    expect(g.pct).toBe(50);
    expect(g.direction).toBe("grew");
  });

  test("shrinking is reported as plainly as growing", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ size: 4, date: dayAgo(60) }));
    obs = addObservation(obs, name, newObservation({ size: 3, date: dayAgo(0) }));
    const g = growth(obs[name]);
    expect(g.direction).toBe("shrank");
    expect(g.summary).toMatch(/shrank/i);
  });

  test("one measurement isn't a trend", () => {
    const g = growth([newObservation({ size: 2, date: dayAgo(0) })]);
    expect(g.ok).toBe(false);
    expect(g.reason).toMatch(/another/i);
  });

  test("removing the last observation leaves no empty shell behind", () => {
    let obs = {};
    const o = newObservation({ text: "Only one" });
    obs = addObservation(obs, name, o);
    obs = removeObservation(obs, name, o.id);
    expect(obs[name]).toBeUndefined();
  });

  test("the tank roll-up counts what's tracked", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ size: 2, date: dayAgo(60) }));
    obs = addObservation(obs, name, newObservation({ size: 3, date: dayAgo(0) }));
    const s = summarise({ observations: obs });
    expect(s.total).toBe(2);
    expect(s.tracked).toBe(1);
    expect(s.growing[0].name).toBe(name);
  });
});
