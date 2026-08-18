jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Shown once, to the right person.
//
// The two ways this feature goes wrong are both about who sees it: a brand-new
// install getting a tour of features it has never met, and a returning keeper
// getting the same sheet on every launch because dismissing it didn't stick.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { compareVersions, unseenReleases, shouldShow, itemsToShow, RELEASES, LATEST_VERSION } = require("../lib/whatsNew");
const { WhatsNewSheet } = require("../components/WhatsNewSheet");

const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const mount = (el) => {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  return tree;
};

describe("version comparison", () => {
  test("numeric, not alphabetical", () => {
    // The bug a string comparison gives you.
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  test("equal and short forms", () => {
    expect(compareVersions("1.1.0", "1.1.0")).toBe(0);
    expect(compareVersions("1.1", "1.1.0")).toBe(0);
    expect(compareVersions("2", "1.9.9")).toBe(1);
  });

  test("junk doesn't throw or claim to be newer", () => {
    expect(compareVersions(undefined, "1.0.0")).toBe(-1);
    expect(compareVersions("", "")).toBe(0);
  });
});

describe("who sees it", () => {
  test("a brand-new install sees nothing", () => {
    // Nothing to catch up on, and the onboarding already does the tour.
    expect(shouldShow(null, "1.1.0")).toBe(false);
    expect(unseenReleases(null, "1.1.0")).toEqual([]);
  });

  test("a keeper coming from an older version sees the new release", () => {
    expect(shouldShow("1.0.0", "1.1.0")).toBe(true);
    expect(unseenReleases("1.0.0", "1.1.0")[0].version).toBe("1.1.0");
  });

  test("somebody already current sees nothing", () => {
    expect(shouldShow("1.1.0", "1.1.0")).toBe(false);
  });

  test("a release newer than the installed app isn't announced early", () => {
    // Guards against adding the next entry before shipping it.
    expect(unseenReleases("1.0.0", "1.0.5")).toEqual([]);
  });

  test("the list is capped — a changelog is something people dismiss", () => {
    const items = itemsToShow("1.0.0", "1.1.0");
    expect(items.length).toBeLessThanOrEqual(8);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe("the release notes themselves", () => {
  test("every entry is well formed and newest-first", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    RELEASES.forEach((r) => {
      expect(r.version).toMatch(/^\d+\.\d+/);
      expect(r.items.length).toBeGreaterThan(0);
      r.items.forEach((i) => {
        expect(i.title.length).toBeGreaterThan(0);
        expect(i.text.length).toBeGreaterThan(20);
      });
    });
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBe(1);
    }
  });

  test("the latest entry matches the shipped app version", () => {
    // A note announcing a version nobody is running is worse than none.
    const appJson = require("../app.json");
    expect(LATEST_VERSION).toBe(appJson.expo.version);
  });

  test("written as what it does for the keeper, not as a changelog", () => {
    const text = RELEASES.flatMap((r) => r.items).map((i) => `${i.title} ${i.text}`).join(" ");
    // Implementation words nobody outside this repo would recognise.
    expect(text).not.toMatch(/\b(refactor|engine|module|API|component|memoiz)/i);
  });
});

describe("the sheet", () => {
  test("renders the unseen items", () => {
    const tree = mount(<WhatsNewSheet visible seenVersion="1.0.0" currentVersion="1.1.0" onDismiss={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain("Updated to 1.1.0");
    expect(shown).toContain("Your tank, explained");
    // The first item, which is the one most people will read.
    expect(shown).toContain(RELEASES[0].items[0].title);
  });

  test("renders nothing at all when there's nothing to say", () => {
    expect(mount(<WhatsNewSheet visible seenVersion="1.1.0" currentVersion="1.1.0" onDismiss={() => {}} />).toJSON()).toBeNull();
    expect(mount(<WhatsNewSheet visible seenVersion={null} currentVersion="1.1.0" onDismiss={() => {}} />).toJSON()).toBeNull();
  });

  test("dismissing calls back, so the version can be remembered", () => {
    const onDismiss = jest.fn();
    const tree = mount(<WhatsNewSheet visible seenVersion="1.0.0" currentVersion="1.1.0" onDismiss={onDismiss} />);
    const got = tree.root.findAll((n) => typeof n.props?.onPress === "function"
      && n.props.accessibilityLabel === "Close what's new")[0];
    renderer.act(() => { got.props.onPress(); });
    expect(onDismiss).toHaveBeenCalled();
  });

  test("it points at search, so the depth stays findable after dismissal", () => {
    const tree = mount(<WhatsNewSheet visible seenVersion="1.0.0" currentVersion="1.1.0" onDismiss={() => {}} />);
    expect(textOf(tree)).toMatch(/searchable/i);
  });
});

describe("App remembers the dismissal", () => {
  const APP = require("fs").readFileSync(require("path").join(__dirname, "..", "App.js"), "utf8");

  test("it writes the version so the sheet can't reappear every launch", () => {
    expect(APP).toContain('setRaw("pr_seenVersion"');
  });

  test("a first-time install is recorded as current rather than shown the sheet", () => {
    expect(APP).toMatch(/onboardedRaw === "1" \? "1\.0\.0" : null/);
  });
});
