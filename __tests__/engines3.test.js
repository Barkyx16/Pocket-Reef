// Source water, medication arithmetic, CSV import, the sitter plan, and the
// predictive alerts.
//
// Two of these carry real-world risk if they're wrong — a medication dose and
// an imported history — so both are tested for what they REFUSE as hard as for
// what they produce. The CSV reader in particular is tested against the shapes
// spreadsheets actually emit rather than the tidy one it would like.

const { newSourceProfile, analyseSource, sourceValuesFor, explainsStubborn } = require("../lib/sourceWater");
const { planMedDose, safetyFor, courseTotal, newMedDose, classOf, CARBON_WARNING } = require("../lib/meds");
const { parseCsv, parseDate, mapColumns, importWaterTests } = require("../lib/csvImport");
const { buildSitterPlan, sitterSheet, preparationSteps, SAFE_ALONE_DAYS } = require("../lib/vacation");
const { getWaterChangeEffect } = require("../core");

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
const test0 = (date, values, water = "fresh") => ({ date, water, values });



// ─────────────────────────────────────────────────────────────────────────────
// Source water
// ─────────────────────────────────────────────────────────────────────────────
describe("the water you put in", () => {
  // 60ppm is inside freshwater's caution band, so this is a tap that genuinely
  // limits what a water change can do.
  const dirtyTap = {
    gallons: 40,
    water: "fresh",
    sourceWater: newSourceProfile({ kind: "tap", values: { nitrate: 60 } }),
    waterTests: [test0(dayAgo(0), { nitrate: 70 })],
  };
  // A tap that's fine in absolute terms but still sets a floor the tank has
  // already reached — a different finding, and not a harmful one.
  const mildTap = {
    gallons: 40,
    water: "fresh",
    sourceWater: newSourceProfile({ kind: "tap", values: { nitrate: 20 } }),
    waterTests: [test0(dayAgo(0), { nitrate: 25 })],
  };

  test("without a profile it asks for one rather than assuming pure water", () => {
    expect(analyseSource({ waterTests: [] }, "fresh").ok).toBe(false);
  });

  test("a dirty tap is named as the ceiling on every water change", () => {
    const a = analyseSource(dirtyTap, "fresh");
    expect(a.ok).toBe(true);
    expect(a.clean).toBe(false);
    const nitrate = a.findings.find((f) => f.key === "nitrate");
    expect(nitrate.floor).toBe(60);
    expect(nitrate.note).toMatch(/never take the tank below/i);
  });

  test("it suggests the actual fix rather than repeating the problem", () => {
    expect(analyseSource(dirtyTap, "fresh").advice).toMatch(/RO/i);
  });

  test("clean RODI is confirmed as clean", () => {
    const clean = { ...dirtyTap, sourceWater: newSourceProfile({ kind: "rodi", values: { nitrate: 0 } }) };
    const a = analyseSource(clean, "fresh");
    expect(a.clean).toBe(true);
    expect(a.headline).toMatch(/clean/i);
  });

  test("RODI reading above zero is diagnosed as spent resin, not as a dirty tap", () => {
    const spent = { ...dirtyTap, sourceWater: newSourceProfile({ kind: "rodi", values: { nitrate: 60 } }) };
    expect(analyseSource(spent, "fresh").advice).toMatch(/resin|membrane/i);
  });

  test("source no cleaner than the tank is called out as pointless, not harmful", () => {
    const equal = {
      gallons: 40,
      sourceWater: newSourceProfile({ kind: "tap", values: { ph: 7.4 } }),
      waterTests: [test0(dayAgo(0), { ph: 7.4 })],
    };
    const ph = analyseSource(equal, "fresh").findings.find((f) => f.key === "ph");
    expect(ph.useless).toBe(true);
    expect(ph.harmful).toBe(false);
  });

  test("the profile plugs into the water-change maths that always assumed zero", () => {
    const tests = [test0(dayAgo(0), { nitrate: 40 })];
    const pure = getWaterChangeEffect({ waterTests: tests, waterType: "fresh", percent: 50, sourceValues: {} });
    const tap = getWaterChangeEffect({ waterTests: tests, waterType: "fresh", percent: 50, sourceValues: sourceValuesFor(mildTap) });
    // 50% with pure water halves it; with 20ppm tap water it barely moves.
    expect(pure.changes.find((c) => c.key === "nitrate").after).toBe(20);
    expect(tap.changes.find((c) => c.key === "nitrate").after).toBe(30);
  });

  test("a stubborn reading gets an explanation instead of another water change", () => {
    expect(explainsStubborn(mildTap, "nitrate")).toMatch(/as low as water changes can take it/i);
    // Well above the floor: nothing to explain, the change will work.
    const high = { ...mildTap, waterTests: [test0(dayAgo(0), { nitrate: 80 })] };
    expect(explainsStubborn(high, "nitrate")).toBeNull();
  });

  test("junk values are refused at the door", () => {
    const p = newSourceProfile({ kind: "tap", values: { nitrate: -5, alk: 8, phosphate: "abc" } });
    expect(p.values.nitrate).toBeUndefined();
    expect(p.values.phosphate).toBeUndefined();
    expect(p.values.alk).toBeUndefined(); // not a source-water parameter
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Medication dosing
// ─────────────────────────────────────────────────────────────────────────────
describe("medication arithmetic", () => {
  test("the dose is computed on real water volume, not the number on the box", () => {
    // 5ml per 10 gal, on a "75 gallon" tank that actually holds about 67.5.
    const r = planMedDose({ labelDose: 5, labelPer: 10, ratedGallons: 75 });
    expect(r.ok).toBe(true);
    expect(r.actualGallons).toBeLessThan(75);
    expect(r.fullDose).toBeCloseTo(33.75, 1);
    expect(r.fullDose).toBeLessThan(37.5); // what dosing rated volume would give
  });

  test("re-dosing after a water change replaces only what the change removed", () => {
    const r = planMedDose({ labelDose: 5, labelPer: 10, ratedGallons: 75, waterChangePct: 30 });
    expect(r.topUp).toBeCloseTo(r.fullDose * 0.3, 1);
    expect(r.topUpNote).toMatch(/not a full dose/i);
  });

  test("no water change means no top-up, not a second full dose", () => {
    expect(planMedDose({ labelDose: 5, labelPer: 10, ratedGallons: 40 }).topUp).toBe(0);
  });

  test("it refuses to guess when the label figures are missing", () => {
    expect(planMedDose({ ratedGallons: 40 }).ok).toBe(false);
    expect(planMedDose({ labelDose: 5, labelPer: 10 }).ok).toBe(false);
    expect(planMedDose({ labelDose: 0, labelPer: 10, ratedGallons: 40 }).ok).toBe(false);
  });

  test("carbon is always warned about — it's why courses silently fail", () => {
    expect(safetyFor("other")).toContain(CARBON_WARNING);
  });

  test("copper in a tank with inverts leads with the thing that kills them", () => {
    const warnings = safetyFor("copper", { hasInverts: true });
    expect(warnings[0]).toMatch(/invertebrates/i);
    expect(classOf("copper").invertSafe).toBe(false);
  });

  test("an invert-safe class doesn't raise a false alarm", () => {
    expect(safetyFor("antibiotic", { hasInverts: true }).some((w) => /will kill them/i.test(w))).toBe(false);
  });

  test("antibiotics warn about the filter, which is the real collateral damage", () => {
    expect(safetyFor("antibiotic").some((w) => /ammonia|filter/i.test(w))).toBe(true);
  });

  test("the running total counts only this course", () => {
    const doses = [
      newMedDose({ name: "Med", amount: 10, date: dayAgo(1) }),
      newMedDose({ name: "Med", amount: 10, date: dayAgo(3) }),
      newMedDose({ name: "Med", amount: 99, date: dayAgo(90) }),
    ];
    expect(courseTotal(doses, dayAgo(7))).toBe(20);
  });

  test("a nonsense dose isn't recorded", () => {
    expect(newMedDose({ name: "Med", amount: 0 })).toBeNull();
    expect(newMedDose({ name: "", amount: 5 })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CSV import
// ─────────────────────────────────────────────────────────────────────────────
describe("importing an existing log", () => {
  test("quoted fields containing commas survive, which a naive split doesn't", () => {
    const rows = parseCsv('Date,Note\n2026-01-01,"Cloudy, then cleared"\n');
    expect(rows[1][1]).toBe("Cloudy, then cleared");
  });

  test("doubled quotes are one quote", () => {
    expect(parseCsv('A\n"say ""hi"""\n')[1][0]).toBe('say "hi"');
  });

  test("dates arrive in whatever shape the other app used", () => {
    expect(parseDate("2026-08-17")).toBe("2026-08-17");
    expect(parseDate("2026-8-7")).toBe("2026-08-07");
    expect(parseDate("17/08/2026")).toBe("2026-08-17"); // first field can't be a month
    expect(parseDate("08/17/26")).toBe("2026-08-17");
    expect(parseDate("nonsense")).toBeNull();
  });

  test("columns are matched by the names people actually use", () => {
    const map = mapColumns(["Date", "NO3", "Ammonia (ppm)", "pH", "Notes"], "fresh");
    expect(map.date).toBe(0);
    expect(map.params.nitrate).toBe(1);
    expect(map.params.ammonia).toBe(2);
    expect(map.params.ph).toBe(3);
  });

  test("a spreadsheet export becomes water tests, newest first", () => {
    const csv = "Date,Nitrate,pH,Ammonia\n2026-01-01,10,7.2,0\n2026-02-01,20,7.4,0\n";
    const r = importWaterTests(csv, { waterType: "fresh" });
    expect(r.ok).toBe(true);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0].date).toBe("2026-02-01");
    expect(r.entries[0].values.nitrate).toBe(20);
  });

  test("units left in the cells are stripped rather than rejected", () => {
    const r = importWaterTests("Date,Nitrate\n2026-01-01,12 ppm\n2026-01-08,15ppm\n", { waterType: "fresh" });
    expect(r.entries.map((e) => e.values.nitrate).sort()).toEqual([12, 15]);
  });

  test("dates already logged are counted, not duplicated", () => {
    const r = importWaterTests("Date,Nitrate\n2026-01-01,10\n2026-01-08,12\n", {
      waterType: "fresh",
      existing: [test0("2026-01-01", { nitrate: 10 })],
    });
    expect(r.entries).toHaveLength(1);
    expect(r.duplicates).toBe(1);
  });

  test("one bad cell in 2013 doesn't cost you the other readings", () => {
    const r = importWaterTests("Date,Nitrate\n2026-01-01,10\n2026-01-08,banana\n2026-01-15,14\n", { waterType: "fresh" });
    expect(r.entries).toHaveLength(2);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].line).toBe(3);
  });

  test("an impossible value is dropped rather than imported", () => {
    const r = importWaterTests("Date,pH\n2026-01-01,7.2\n2026-01-08,78\n", { waterType: "fresh" });
    expect(r.entries).toHaveLength(1);
    expect(r.skipped[0].reason).toMatch(/out of range/i);
  });

  test("a file with no date column is refused with a fixable reason", () => {
    const r = importWaterTests("Nitrate,pH\n10,7.2\n", { waterType: "fresh" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/date column/i);
  });

  test("a file with no recognisable parameters is refused too", () => {
    const r = importWaterTests("Date,Mood\n2026-01-01,good\n", { waterType: "fresh" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no parameter columns/i);
  });

  test("unrecognised columns are reported rather than silently ignored", () => {
    const r = importWaterTests("Date,Nitrate,Notes\n2026-01-01,10,fine\n", { waterType: "fresh" });
    expect(r.unmatched).toContain("Notes");
  });

  test("it never writes anything itself", () => {
    const existing = [test0("2020-01-01", { nitrate: 5 })];
    importWaterTests("Date,Nitrate\n2026-01-01,10\n", { waterType: "fresh", existing });
    expect(existing).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Going away
// ─────────────────────────────────────────────────────────────────────────────
describe("the tank sitter plan", () => {
  const tank = {
    name: "Reef",
    gallons: 40,
    stock: ["Ocellaris Clownfish"],
    quantities: { "Ocellaris Clownfish": 2 },
    waterTests: [test0(dayAgo(1), { nitrate: 10, ph: 8.1 }, "salt")],
  };

  test("a short trip is told to do nothing, which is the correct answer", () => {
    const plan = buildSitterPlan(tank, { days: 3, waterType: "salt" });
    expect(plan.unattended).toBe(true);
    expect(plan.feeding.awayPerDay).toBe(0);
    expect(sitterSheet(plan)).toMatch(/NOTHING NEEDS DOING/);
  });

  test("a longer trip feeds LESS than normal, not more", () => {
    const plan = buildSitterPlan(tank, { days: 10, waterType: "salt" });
    expect(plan.unattended).toBe(false);
    expect(plan.feeding.awayPerDay).toBeLessThanOrEqual(plan.feeding.normalPerDay);
    expect(plan.doList.join(" ")).toMatch(/less is safe/i);
  });

  test("the don't-list covers what sitters actually do with good intentions", () => {
    const plan = buildSitterPlan(tank, { days: 10, waterType: "salt" });
    const dont = plan.dontList.join(" ").toLowerCase();
    expect(dont).toMatch(/look hungry/);
    expect(dont).toMatch(/change any water/);
    expect(dont).toMatch(/unplug/);
  });

  test("the sheet is plain text that survives a text message", () => {
    const sheet = sitterSheet(buildSitterPlan(tank, { days: 10, sitterName: "Sam", contact: "555-0100", waterType: "salt" }));
    expect(sheet).toContain("REEF — CARE NOTES");
    expect(sheet).toContain("Sam");
    expect(sheet).toContain("555-0100");
    expect(sheet).toContain("Ocellaris Clownfish");
    expect(sheet).toMatch(/CALL ME IF/);
    expect(sheet).not.toMatch(/<|\{/); // no markup, no JSON
  });

  test("readings are handed over as reference, with an instruction not to test", () => {
    const sheet = sitterSheet(buildSitterPlan(tank, { days: 10, waterType: "salt" }));
    expect(sheet).toMatch(/please don't test/i);
  });

  test("preparation happens a week ahead, which is the half that prevents disasters", () => {
    const steps = preparationSteps(tank, 10);
    expect(steps.some((s) => s.when === "A week before")).toBe(true);
    expect(steps.some((s) => /pre-portion/i.test(s.text))).toBe(true);
  });

  test("a short trip needs no food portioning", () => {
    expect(preparationSteps(tank, SAFE_ALONE_DAYS).some((s) => /pre-portion/i.test(s.text))).toBe(false);
  });

  test("an empty tank doesn't throw", () => {
    expect(() => sitterSheet(buildSitterPlan({ name: "New" }, { days: 7 }))).not.toThrow();
  });
});
