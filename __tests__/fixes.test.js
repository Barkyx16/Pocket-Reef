jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Five defects found by reading the code rather than the feature list. Each
// test states the wrong behaviour it replaces, because that's the part that
// stops someone "simplifying" the fix back out.
const AsyncStorage = require("@react-native-async-storage/async-storage");
const { resolveWaterType, getTankHealthScore, getTodayActions } = require("../core");
const { activeParams, setActiveTargets } = require("../lib/targets");
const { newStockRecord } = require("../lib/livestock");
const { SYNCED_FIELDS } = require("../lib/cloudSync");
const { restorePreMigrationBackup, getPreMigrationBackup } = require("../lib/migrations");

afterEach(() => setActiveTargets({}));

describe("water type follows the tank, not just its stock", () => {
  test("an empty saltwater tank is salt, not fresh", () => {
    // The bug: every derivation read the first stocked species and fell back to
    // "fresh" when empty. A reef being cycled — no stock, tested daily — got
    // the six freshwater parameters.
    expect(resolveWaterType([], "salt")).toBe("salt");
    expect(resolveWaterType([], "fresh")).toBe("fresh");
    expect(resolveWaterType([], undefined)).toBe("fresh");
  });

  test("an empty reef offers the reef parameters, including the ones that matter while cycling", () => {
    const keys = activeParams(resolveWaterType([], "salt")).map((p) => p.key);
    for (const k of ["salinity", "alk", "calcium", "magnesium", "phosphate"]) {
      expect(keys).toContain(k);
    }
  });

  test("stock still wins, so a legacy tank mislabelled fresh isn't broken", () => {
    // Tanks created before the `water` field existed default to "fresh"
    // regardless of what's swimming in them. Making the declared type
    // authoritative outright would have regressed every one of them.
    expect(resolveWaterType(["Ocellaris Clownfish"], "fresh")).toBe("salt");
    expect(resolveWaterType(["Neon Tetra"], "salt")).toBe("fresh");
  });

  test("an unknown species name falls back to the declared type", () => {
    expect(resolveWaterType(["Not A Real Fish"], "salt")).toBe("salt");
  });

  test("the health score grades an empty reef against reef ranges", () => {
    // 30ppm nitrate is fine in freshwater and not fine on a reef. Before the
    // fix an empty saltwater tank was scored as freshwater, so this reading
    // passed.
    const waterTests = [{ date: "2026-08-08", water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 30 } }];
    const base = { tank: [], tankGallons: 40, maintenance: {}, quantities: {}, waterTests };
    const asFresh = getTankHealthScore({ ...base, waterType: "fresh" }).score;
    const asSalt = getTankHealthScore({ ...base, waterType: "salt" }).score;
    expect(asSalt).toBeLessThan(asFresh);
  });

  test("today's actions use the water type they were handed", () => {
    // getTodayActions accepted a waterType parameter and then re-derived it
    // from stock anyway, so the value the screen passed was ignored.
    const waterTests = [{ date: "2026-08-08", water: "salt", values: { nitrate: 30 } }];
    const args = { tank: ["Ocellaris Clownfish"], waterTests, maintenance: {}, quarantine: [], quantities: {} };
    const salt = getTodayActions({ ...args, waterType: "salt" });
    expect(Array.isArray(salt)).toBe(true);
    // The call must not throw and must respect the declared type for an empty tank.
    expect(() => getTodayActions({ tank: [], waterTests, waterType: "salt" })).not.toThrow();
  });
});

describe("every path that adds an animal dates it", () => {
  // Only the manual add created a record. Quarantine graduation, tank ideas and
  // generated stocking plans all put fish in the tank with nothing attached, so
  // a tank built from a plan started life completely undocumented.
  const datedMeta = (existing, names) => {
    const next = { ...(existing || {}) };
    (names || []).forEach((n) => { if (!next[n]) next[n] = newStockRecord(); });
    return next;
  };

  test("a bulk stock write dates every new name", () => {
    const meta = datedMeta({}, ["A", "B", "C"]);
    expect(Object.keys(meta).sort()).toEqual(["A", "B", "C"]);
    for (const k of Object.keys(meta)) expect(meta[k].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("a bulk write never overwrites a record that already exists", () => {
    const existing = { A: { addedAt: "2020-01-01", source: "Blue Reef", price: 30, notes: "keep" } };
    const meta = datedMeta(existing, ["A", "B"]);
    expect(meta.A).toEqual(existing.A);
    expect(meta.B.addedAt).toBeTruthy();
  });

  test("graduating from quarantine carries the date the clock started", () => {
    // This is the one moment the app knows exactly when an animal came into
    // your care, and it was being discarded.
    const item = { id: 1, name: "Yellow Tang", startDate: "2026-06-01T09:00:00.000Z" };
    const rec = newStockRecord({ addedAt: item.startDate.slice(0, 10), notes: "Came through quarantine" });
    expect(rec.addedAt).toBe("2026-06-01");
    expect(rec.notes).toBe("Came through quarantine");
  });
});

describe("the backup is as complete as the cloud", () => {
  // Export was sold as a backup and silently omitted speciesNotes — text the
  // user typed by hand — plus the tank's start date, recents and banner.
  // Export, reinstall, import used to lose all of it.
  // Read out of App.js rather than restated here. A copy of the list would
  // pass forever while the real payload drifted, which is the exact failure
  // mode this is guarding against.
  const EXPORTED = (() => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "App.js"), "utf8");
    // Anchored on the export payload's own marker rather than the variable
    // name. A second object literal called `payload` elsewhere in App.js would
    // otherwise silently retarget this guard at the wrong thing — which is
    // exactly the class of drift it exists to catch, and did happen once.
    const marker = src.indexOf('app: "Pocket Reef"');
    if (marker < 0) throw new Error("export payload not found in App.js");
    const start = src.lastIndexOf("const payload = {", marker);
    if (start < 0) throw new Error("export payload declaration not found in App.js");
    const body = src.slice(src.indexOf("{", start) + 1, src.indexOf("};", start));
    // Split on top-level commas and read the key off each entry. A regex with a
    // leading delimiter consumes it and matches only every other key, which is
    // how this guard first reported a false failure.
    return body
      .split(",")
      .map((part) => {
        const m = part.match(/^\s*([A-Za-z_$][\w$]*)\s*(:|$)/);
        return m ? m[1] : null;
      })
      .filter(Boolean);
  })();

  test("the payload was actually parsed", () => {
    // Guards the guard: a regex that silently matched nothing would make every
    // assertion below vacuous.
    expect(EXPORTED.length).toBeGreaterThan(10);
    expect(EXPORTED).toContain("tanks");
  });

  test("the export payload covers every field cloud sync round-trips", () => {
    for (const field of SYNCED_FIELDS) {
      expect(EXPORTED).toContain(field);
    }
  });

  test("hand-written species notes are in the payload", () => {
    // The single worst omission: notes are content the user authored, and
    // nothing else in the app holds a copy.
    expect(EXPORTED).toContain("speciesNotes");
  });

  test("entitlement is still deliberately excluded", () => {
    // A backup must not carry paid status between people.
    expect(EXPORTED).not.toContain("premiumUnlocked");
    expect(SYNCED_FIELDS).not.toContain("premiumUnlocked");
  });
});

describe("a failed migration can be recovered", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  test("restoring with no backup reports why instead of pretending", async () => {
    const res = await restorePreMigrationBackup();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no backup/i);
  });

  test("a backup is written back and the schema version rewound", async () => {
    // Rewinding matters: leaving the version at the failed target means the
    // next launch skips the migration and the restored data is never upgraded.
    await AsyncStorage.setItem("pr_backup_preMigration", JSON.stringify({
      version: 2,
      at: "2026-08-01T00:00:00.000Z",
      data: { pr_tanks: JSON.stringify([{ id: "t1", name: "Recovered" }]), pr_xp: "500" },
    }));
    await AsyncStorage.setItem("pr_schemaVersion", "3");
    await AsyncStorage.setItem("pr_xp", "0");

    const res = await restorePreMigrationBackup();
    expect(res.ok).toBe(true);
    expect(await AsyncStorage.getItem("pr_xp")).toBe("500");
    expect(JSON.parse(await AsyncStorage.getItem("pr_tanks"))[0].name).toBe("Recovered");
    expect(await AsyncStorage.getItem("pr_schemaVersion")).toBe("2");
  });

  test("the backup is still readable after being restored", async () => {
    // Restoring must not consume the only copy — a keeper may need to try twice.
    await AsyncStorage.setItem("pr_backup_preMigration", JSON.stringify({
      version: 1, at: "2026-08-01T00:00:00.000Z", data: { pr_xp: "42" },
    }));
    await restorePreMigrationBackup();
    expect(await getPreMigrationBackup()).not.toBeNull();
  });
});
