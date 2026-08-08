// migrations imports AsyncStorage; the package ships a mock for exactly this.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { validateParam, PARAMS, assessParam } from "../core";
import { ensureTanksShape, ensureTankShape } from "../lib/migrations";

const fresh = (key) => PARAMS.fresh.find((p) => p.key === key);
const salt = (key) => PARAMS.salt.find((p) => p.key === key);

describe("reading plausibility", () => {
  test("empty is always fine — not every field must be filled", () => {
    expect(validateParam(fresh("ph"), "").ok).toBe(true);
    expect(validateParam(fresh("ph"), null).ok).toBe(true);
  });

  test("a mistyped pH is rejected", () => {
    // The classic slip: 7.8 typed as 78. Stored, it would skew every average
    // and forecast built on it afterwards.
    expect(validateParam(fresh("ph"), 78).ok).toBe(false);
    expect(validateParam(fresh("ph"), 7.8).ok).toBe(true);
  });

  test("a mistyped temperature is rejected", () => {
    expect(validateParam(fresh("temp"), 780).ok).toBe(false);
    expect(validateParam(fresh("temp"), 78).ok).toBe(true);
  });

  test("alarming but real readings still go in — this is not a health check", () => {
    // A cycling tank genuinely reads high ammonia and nitrite. Blocking those
    // would stop people logging exactly when logging matters most.
    expect(validateParam(fresh("ammonia"), 8).ok).toBe(true);
    expect(validateParam(fresh("nitrite"), 5).ok).toBe(true);
    expect(validateParam(fresh("nitrate"), 160).ok).toBe(true);
    // And they must still be graded as dangerous.
    expect(assessParam(fresh("ammonia"), 8).status).toBe("danger");
  });

  test("reef chemistry has its own sane bounds", () => {
    expect(validateParam(salt("salinity"), 1.025).ok).toBe(true);
    expect(validateParam(salt("salinity"), 25).ok).toBe(false);
    expect(validateParam(salt("calcium"), 420).ok).toBe(true);
    expect(validateParam(salt("calcium"), 42000).ok).toBe(false);
  });

  test("non-numeric input is rejected", () => {
    expect(validateParam(fresh("ph"), "abc").ok).toBe(false);
  });
});

describe("import normalization", () => {
  test("a backup missing newer fields is repaired, not trusted", () => {
    // Exactly the shape an export taken before treatments existed would have.
    const old = [{ id: "t1", name: "Old Tank", gallons: 20, water: "fresh", stock: ["Neon Tetra"] }];
    const fixed = ensureTanksShape(old);
    expect(fixed).toHaveLength(1);
    expect(Array.isArray(fixed[0].treatments)).toBe(true);
    expect(Array.isArray(fixed[0].waterTests)).toBe(true);
    expect(typeof fixed[0].maintenance).toBe("object");
    expect(fixed[0].stock).toEqual(["Neon Tetra"]);
  });

  test("a tank with no id gets one, so it can still be selected", () => {
    const fixed = ensureTanksShape([{ name: "No id" }]);
    expect(fixed[0].id).toBeTruthy();
  });

  test("wrong types are repaired, which is more dangerous than missing ones", () => {
    const fixed = ensureTankShape({ id: "x", stock: "not-an-array", journal: null });
    expect(Array.isArray(fixed.stock)).toBe(true);
    expect(Array.isArray(fixed.journal)).toBe(true);
  });

  test("unusable entries are dropped rather than crashing the import", () => {
    expect(ensureTanksShape([null, undefined, "nope", { id: "ok" }])).toHaveLength(1);
  });

  test("a garbage payload yields nothing to import", () => {
    expect(ensureTanksShape(null)).toEqual([]);
    expect(ensureTanksShape("nope")).toEqual([]);
  });
});
