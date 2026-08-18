jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const fs = require("fs");
const path = require("path");
const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { setUnit, tempToDisplay, tempFromInput, localiseParam, fToC, cToF } = require("../lib/units");
const { activeParams, displayParams, setActiveTargets } = require("../lib/targets");
const { assessParam, DISEASES } = require("../core");
const { WaterTestCard } = require("../components/WaterTestCard");
const { HealthTab } = require("../screens/HealthTab");
const { persistPhoto, forgetPhoto, isPersisted } = require("../lib/photoStore");

const NOTIFS = fs.readFileSync(path.join(__dirname, "..", "lib", "notifications.js"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

function mount(element) {
  let tree;
  renderer.act(() => { tree = renderer.create(element); });
  const raw = tree.unmount.bind(tree);
  tree.unmount = () => renderer.act(() => { raw(); });
  return tree;
}
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (tree) => tree.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const byLabel = (tree, label) => tree.root.findAll((n) => n.props.accessibilityLabel === label);
const byLabelMatch = (tree, re) =>
  tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && re.test(n.props.accessibilityLabel));

// The guide list paginates at six, so a relevant disease can be absent purely
// because it's on page two. Expand fully before asserting on what's present.
function expandAll(tree) {
  for (let i = 0; i < 6; i++) {
    const more = byLabelMatch(tree, /^Show \d+ more guides$/).filter((n) => typeof n.props.onPress === "function");
    if (!more.length) break;
    renderer.act(() => { more[0].props.onPress(); });
  }
}

afterEach(() => { setUnit("imperial"); setActiveTargets({}); });

describe("metric reaches the logging screens, not just the catalog", () => {
  // Species cards honoured the setting; the water-test form did not. A metric
  // keeper read care ranges in °C and then met a field hard-coded to °F.
  test("the temperature parameter converts, and nothing else does", () => {
    setUnit("metric");
    const temp = displayParams("fresh").find((p) => p.key === "temp");
    expect(temp.unit).toBe("°C");
    expect(temp.good).toEqual([fToC(72), fToC(80)]);
    expect(temp.ideal).toBe("22–27°C");

    const nitrate = displayParams("fresh").find((p) => p.key === "nitrate");
    expect(nitrate.unit).toBe("ppm");
    expect(nitrate.good).toEqual([0, 40]);
  });

  test("imperial is untouched", () => {
    const temp = displayParams("fresh").find((p) => p.key === "temp");
    expect(temp.unit).toBe("°F");
    expect(temp.good).toEqual([72, 80]);
  });

  test("a metric reading of 26 grades as good, not as freezing", () => {
    // The actual user-visible bug: type what your thermometer says and the app
    // used to call a perfectly warm tank dangerously cold.
    setUnit("metric");
    const temp = displayParams("fresh").find((p) => p.key === "temp");
    expect(assessParam(temp, 26).status).toBe("good");
    expect(assessParam(temp, 10).status).toBe("danger");
  });

  test("readings are still stored in Fahrenheit whatever the keeper types", () => {
    // Storage must not change, or every existing entry, trend and forecast
    // would silently shift by 30-odd degrees.
    setUnit("metric");
    expect(tempFromInput(26)).toBe(78.8);
    expect(tempToDisplay(78.8)).toBe(26);
    setUnit("imperial");
    expect(tempFromInput(78)).toBe(78);
    expect(tempToDisplay(78)).toBe(78);
  });

  test("the round trip is stable", () => {
    setUnit("metric");
    for (const c of [18, 22, 24, 26, 30]) {
      expect(tempToDisplay(tempFromInput(c))).toBe(c);
    }
  });

  test("grading params stay in Fahrenheit for the core scoring", () => {
    // core grades STORED values. If activeParams localised the band, a stored
    // 78°F would be compared against 22–27°C and every metric user's tank
    // would read as dangerously cold.
    setUnit("metric");
    const grading = activeParams("fresh").find((p) => p.key === "temp");
    expect(grading.unit).toBe("°F");
    expect(assessParam(grading, 78).status).toBe("good");
  });

  test("the form shows the localised unit", () => {
    setUnit("metric");
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    expect(byLabelMatch(tree, /^Temp in °C/).length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("a metric entry is converted before it is handed over", () => {
    setUnit("metric");
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={onLog} />);
    const temp = byLabelMatch(tree, /^Temp in °C/).find((n) => typeof n.props.onChangeText === "function");
    renderer.act(() => { temp.props.onChangeText("26"); });
    renderer.act(() => { byLabel(tree, "Log this water test")[0].props.onPress(); });
    expect(onLog.mock.calls[0][0].values.temp).toBe(78.8);
    tree.unmount();
  });

  test("localiseParam leaves a non-temperature parameter alone", () => {
    setUnit("metric");
    const p = { key: "ph", unit: "", good: [6, 8], caution: [5, 9], ideal: "6–8" };
    expect(localiseParam(p)).toBe(p);
  });

  test("cToF and fToC agree", () => {
    expect(cToF(0)).toBe(32);
    expect(fToC(32)).toBe(0);
    expect(cToF(100)).toBe(212);
  });
});

describe("reminders fire at a fixed hour instead of drifting", () => {
  test("cadence reminders carry an interval in days, not a second count", () => {
    // TIME_INTERVAL repeating from "now" meant the reminder landed at whatever
    // time of day you last edited the tank.
    expect(NOTIFS).toContain("intervalDays");
    expect(NOTIFS).not.toContain("seconds: interval * 24 * 60 * 60");
  });

  test("CARE_HOUR is actually used now", () => {
    // It was collected into every reminder and then never read, because
    // `r.seconds` always won the trigger ternary.
    expect(NOTIFS).toContain("nextOccurrence(r.intervalDays, r.hour)");
    expect(NOTIFS).toContain("target.setHours(hour, 0, 0, 0)");
  });

  test("an unchanged schedule is not torn down and rebuilt", () => {
    // syncReminders cancels every pending notification first, and it ran on
    // every tank edit — so a weekly countdown restarted constantly and an
    // active keeper could never actually receive one.
    expect(APP).toContain("lastReminderSig");
    expect(APP).toContain("if (signature === lastReminderSig.current) return;");
  });
});

describe("health guides match the tank", () => {
  const saltOnly = DISEASES.filter((d) => d.water === "salt").map((d) => d.name);
  const freshOnly = DISEASES.filter((d) => d.water === "fresh").map((d) => d.name);

  test("the fixture has something to filter", () => {
    expect(saltOnly.length).toBeGreaterThan(0);
    expect(freshOnly.length).toBeGreaterThan(0);
  });

  test("a freshwater tank is not offered saltwater-only diseases", () => {
    // Someone on this screen is usually frightened about a specific fish.
    // Offering diagnoses that species cannot possibly have wastes their time
    // and invites the wrong treatment.
    const tree = mount(<HealthTab openDisease={() => {}} waterType="fresh" />);
    expandAll(tree);
    const text = textOf(tree);
    for (const name of saltOnly) expect(text).not.toContain(name);
    for (const name of freshOnly) expect(text).toContain(name);
    tree.unmount();
  });

  test("a reef tank is not offered freshwater-only diseases", () => {
    const tree = mount(<HealthTab openDisease={() => {}} waterType="salt" />);
    expandAll(tree);
    const text = textOf(tree);
    for (const name of freshOnly) expect(text).not.toContain(name);
    for (const name of saltOnly) expect(text).toContain(name);
    tree.unmount();
  });

  test("diseases affecting both are always shown", () => {
    for (const water of ["fresh", "salt"]) {
      const tree = mount(<HealthTab openDisease={() => {}} waterType={water} />);
      expect(textOf(tree)).toContain("Ich (White Spot)");
      tree.unmount();
    }
  });

  test("the narrowing is stated and reversible", () => {
    // Hiding guides silently would look like a missing guide.
    const tree = mount(<HealthTab openDisease={() => {}} waterType="fresh" />);
    expect(textOf(tree)).toMatch(/Showing the \d+ guides relevant to your freshwater tank/);
    renderer.act(() => { byLabelMatch(tree, /Tap to show all/)[0].props.onPress(); });
    expandAll(tree);
    for (const name of saltOnly) expect(textOf(tree)).toContain(name);
    tree.unmount();
  });
});

describe("journal photos survive the OS clearing its cache", () => {
  // ImagePicker returns a cache URI. iOS empties that directory whenever it
  // wants the space, so the entry survived and the image became a grey box.
  test("a picked photo is copied out of the cache", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components", "JournalCard.js"), "utf8");
    expect(src).toContain("persistPhoto(res.assets[0].uri)");
  });

  test("isPersisted distinguishes ours from the picker's", () => {
    expect(isPersisted("file:///var/app/Documents/journal-photos/123.jpg")).toBe(true);
    expect(isPersisted("file:///var/app/Library/Caches/ImagePicker/abc.jpg")).toBe(false);
    expect(isPersisted(null)).toBe(false);
  });

  test("it degrades to the original URI rather than throwing", async () => {
    // On web, or with the native module absent, a photo that can't be copied
    // must still be usable — losing the entry would be worse.
    await expect(persistPhoto("file:///tmp/x.jpg")).resolves.toBe("file:///tmp/x.jpg");
    await expect(persistPhoto(null)).resolves.toBeNull();
  });

  test("cleanup only ever touches files this module wrote", async () => {
    // Deleting a cache URI we didn't create is not ours to do.
    await expect(forgetPhoto("file:///var/Caches/ImagePicker/abc.jpg")).resolves.toBe(false);
  });

  test("a deleted entry's photo outlives the undo window", () => {
    // Removing the file immediately would make Undo restore an entry pointing
    // at nothing.
    expect(APP).toContain("UNDO_WINDOW_MS");
    expect(APP).toContain("if (!undone) forgetPhoto(gone.photo)");
  });
});

describe("the catalog opens on fish you can actually keep", () => {
  test("the water filter defaults to the tank's type", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "screens", "SpeciesTab.js"), "utf8");
    // A reef keeper was met with 174 freshwater fish, every single time.
    expect(src).toContain('usePersistedState("pr_f_water", tankWater');
    expect(src).not.toContain('usePersistedState("pr_f_water", "all"');
  });

  test("App passes the resolved tank type in", () => {
    expect(APP).toContain("tankWater={resolveWaterType(tank, activeTank.water)}");
  });
});
