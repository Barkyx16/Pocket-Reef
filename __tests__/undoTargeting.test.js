import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

describe("undo restores into the tank the record came from", () => {
  // Every undo restore in App.js goes through updateActiveTank, and "active"
  // means whichever tank is open when Undo is *tapped*. The snackbar lasts five
  // seconds and the tank switcher is one tap away in the header, so:
  //
  //   1. delete a water test on the reef
  //   2. switch to the quarantine tank
  //   3. tap Undo
  //
  // filed the reef's reading into the quarantine tank, and the reef never got
  // it back. Both tanks end up wrong from one tap inside a five-second window.

  // The mechanism, reproduced rather than described.
  const simulate = ({ redirect }) => {
    let tanks = [{ id: "A", waterTests: [] }, { id: "B", waterTests: [] }];
    let activeTankId = "A";
    let undoTank = null;
    const updateActiveTank = (fn) => {
      const target = (redirect && undoTank) || activeTankId;
      tanks = tanks.map((tk) => (tk.id === target ? { ...tk, ...fn(tk) } : tk));
    };
    const gone = { date: "2026-08-01", values: { alk: 8.4 } };
    const undo = { tankId: activeTankId,
      onUndo: () => updateActiveTank((tk) => ({ waterTests: [gone, ...(tk.waterTests || [])] })) };
    activeTankId = "B";                    // the keeper switches tanks
    undoTank = undo.tankId;
    undo.onUndo();
    return tanks;
  };

  test("without the redirect it lands on the wrong tank", () => {
    // Pins the bug itself, so this test would have failed before the fix.
    const tanks = simulate({ redirect: false });
    expect(tanks.find((t) => t.id === "B").waterTests).toHaveLength(1);
    expect(tanks.find((t) => t.id === "A").waterTests).toHaveLength(0);
  });

  test("with it, the record goes home", () => {
    const tanks = simulate({ redirect: true });
    expect(tanks.find((t) => t.id === "A").waterTests).toHaveLength(1);
    expect(tanks.find((t) => t.id === "B").waterTests).toHaveLength(0);
  });
});

describe("the wiring that makes that true", () => {
  test("the tank is captured when the action happens, not when undo is tapped", () => {
    expect(app).toMatch(/setUndo\(\{[^}]*tankId: activeTankId/);
  });

  test("updateActiveTank honours the captured tank while an undo runs", () => {
    expect(app).toMatch(/const target = undoTankRef\.current \|\| activeTankId;/);
  });

  test("the redirect is cleared even if the restore throws", () => {
    // Otherwise every later write in the session points at a tank the keeper
    // closed minutes ago — a far worse bug than the one being fixed.
    expect(app).toMatch(/try \{ undo\.onUndo\(\); \} finally \{ undoTankRef\.current = null; \}/);
  });

  test("it is scoped to undo and nothing else", () => {
    // A ref that anything could set would be a second, invisible notion of
    // "which tank am I writing to".
    expect((app.match(/undoTankRef\.current =/g) || []).length).toBe(2); // set, and cleared
  });

  test("every restore still runs through the one updater", () => {
    // The fix is central precisely so 23 call sites did not have to change; if
    // a new one writes tanks directly it slips out from under this.
    const sites = (app.match(/showUndo\(/g) || []).length;
    expect(sites).toBeGreaterThan(20);
  });
});
