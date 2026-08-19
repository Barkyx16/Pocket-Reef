import fs from "fs";
import path from "path";
import { usingTestKeys, ENTITLEMENT_ID } from "../lib/purchases";

const ROOT = path.join(__dirname, "..");
const purchases = fs.readFileSync(path.join(ROOT, "lib/purchases.js"), "utf8");
const paywall = fs.readFileSync(path.join(ROOT, "screens/PremiumTab.js"), "utf8");

describe("shipping with sandbox keys cannot happen quietly", () => {
  // RevenueCat prefixes sandbox keys with "test_". Ship one and the SDK
  // configures fine, offerings come back empty, and the paywall reports
  // "check your connection" — a lie nobody can act on. Nothing crashes,
  // nothing logs, and the only symptom is that no one ever subscribes.
  //
  // This test does not demand production keys: a build for the simulator
  // legitimately has sandbox ones. It demands that the two facts agree —
  // if the keys are still sandbox, the note saying so must still be there,
  // and once they are real it must go. Neither can be removed alone.
  const hasTodo = /TODO: these are TEST-mode keys/.test(purchases);

  test("the warning and the keys tell the same story", () => {
    expect([usingTestKeys(), hasTodo]).toEqual([usingTestKeys(), usingTestKeys()]);
  });

  test("the paywall says what is actually wrong", () => {
    // Not "check your connection", which sends a developer chasing a network
    // problem that does not exist.
    expect(paywall).toContain("usingTestKeys()");
    expect(paywall).toMatch(/sandbox keys.*no products load/i);
    expect(paywall).toMatch(/production keys before shipping/i);
  });

  test("the real-connection message is still there for the real case", () => {
    expect(paywall).toMatch(/Check your connection and try again/);
  });
});

describe("the rest of the store wiring is release-ready", () => {
  test("the entitlement id is set and not a placeholder", () => {
    expect(ENTITLEMENT_ID).toBe("premium");
    expect(ENTITLEMENT_ID).not.toMatch(/todo|xxx|change|your/i);
  });

  test("nothing else in the app carries an unresolved TODO", () => {
    // One is deliberate and pinned above. A second would mean this check has
    // stopped meaning anything.
    const files = ["components", "screens", "lib", "data"].flatMap((dir) =>
      fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)))
      .concat(["App.js", "core.js"]);
    const todos = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      src.split("\n").forEach((line, i) => {
        if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) todos.push(`${f}:${i + 1}`);
      });
    }
    expect(todos).toEqual(["lib/purchases.js:25"]);
  });

  test("no test is skipped or focused", () => {
    // A .only silently stops every other test in its file from running.
    const dir = path.join(ROOT, "__tests__");
    const bad = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".js"))) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      if (/\b(describe|test|it)\.(only|skip)\s*\(/.test(src) || /\b(xit|xdescribe)\s*\(/.test(src)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});
