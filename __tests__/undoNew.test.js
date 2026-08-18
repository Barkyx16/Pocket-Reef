const fs = require("fs");
const path = require("path");

// "Everything destructive in this app is undoable" is a stated invariant, and
// five rounds of new record types broke it in four places: an observation
// (which can carry a photograph and half a growth series), a quarantine
// arrival (a running clock plus every clearance check ticked against it), and
// overwriting a source-water profile or a light schedule — both of which are
// measurements somebody actually ran.
//
// Asserted against the source, the way undoCoverage.test.js already does: these
// handlers live inside App and wiring a full app render for each one would test
// the harness more than the behaviour.
const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

// The body of a handler, from its declaration to the start of the next
// top-level one.
//
// Matching the next bare `const ` finds the first variable INSIDE the handler
// and truncates the body a line or two in — which made the sweep below report
// deleteTank as missing an undo it has had all along. Top-level handlers are
// declared at exactly two spaces of indentation, so that's what delimits them.
const HANDLER = /\n {2}const \w+ = useStableCallback/g;
function bodyOf(name) {
  const start = APP.indexOf(`const ${name} = useStableCallback`);
  expect(start).toBeGreaterThan(-1);
  HANDLER.lastIndex = start + 10;
  const next = HANDLER.exec(APP);
  return APP.slice(start, next ? next.index : APP.length);
}

describe("the record types added since the invariant was written", () => {
  test("deleting an observation offers undo", () => {
    const body = bodyOf("removeObservationFor");
    expect(body).toContain("showUndo(");
    // It has to capture the entry before removing it, or there's nothing to
    // put back.
    expect(body).toMatch(/const gone =/);
    expect(body).toContain("addObservation");
  });

  test("removing a quarantine arrival offers undo, and restores its checks", () => {
    const body = bodyOf("removeQuarantine");
    expect(body).toContain("showUndo(");
    expect(body).toMatch(/const gone =/);
    // The whole record goes back, which is what carries the ticked checks.
    expect(body).toMatch(/quarantine: \[gone/);
  });

  test("overwriting source water offers undo", () => {
    const body = bodyOf("setSourceWater");
    expect(body).toContain("showUndo(");
    expect(body).toMatch(/const prior =/);
  });

  test("changing the light schedule offers undo", () => {
    const body = bodyOf("setLightSchedule");
    expect(body).toContain("showUndo(");
    expect(body).toMatch(/const prior =/);
  });

  test("setting either for the FIRST time is not treated as destructive", () => {
    // An undo bar for "you added a thing" is noise, and noise is how people
    // learn to ignore the bar that matters.
    expect(bodyOf("setSourceWater")).toMatch(/if \(prior && Object\.keys/);
    expect(bodyOf("setLightSchedule")).toMatch(/if \(prior && \(prior\.on \|\| prior\.off\)\)/);
  });
});

describe("nothing destructive was missed", () => {
  // A cheap guard against the next one: every remove/delete handler in App
  // should either offer undo or be explicitly exempt.
  const EXEMPT = new Set([
    "removeObservation",   // the pure helper in lib/, not a handler
    "deleteRestorePoint",  // deleting a backup, itself an undo mechanism
  ]);

  test("every remove* / delete* handler mentions showUndo", () => {
    const names = [...APP.matchAll(/const ((?:remove|delete)[A-Z]\w*) = useStableCallback/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(4);
    const missing = names.filter((n) => !EXEMPT.has(n) && !bodyOf(n).includes("showUndo("));
    expect(missing).toEqual([]);
  });
});
