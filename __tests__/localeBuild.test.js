jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

let mockLocales = [{ languageCode: "en" }];
jest.mock("expo-localization", () => ({ getLocales: () => mockLocales }));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.4.0", nativeBuildVersion: "42" }));
jest.mock("expo-device", () => ({ osVersion: "18.2", modelName: "iPhone 15", isDevice: true }));

const fs = require("fs");
const path = require("path");
const { deviceLanguage, isSupported, setLanguage, t, LANGUAGES } = require("../lib/i18n");
const { versionLabel, deviceLabel, supportLine, isRealDevice } = require("../lib/buildInfo");
const { buildTankReport } = require("../lib/report");

const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

afterEach(() => { mockLocales = [{ languageCode: "en" }]; setLanguage("en"); });

describe("the app follows the phone's language", () => {
  // Spanish shipped, and every install defaulted to English — so the only way
  // a Spanish speaker found it was a settings row written in English.
  test("a supported device language is detected", () => {
    mockLocales = [{ languageCode: "es" }];
    expect(deviceLanguage()).toBe("es");
  });

  test("an unsupported language returns null rather than guessing", () => {
    // Falling back to a half-translated locale would be worse than English.
    mockLocales = [{ languageCode: "de" }];
    expect(deviceLanguage()).toBeNull();
  });

  test("it walks the preference list rather than only checking the first", () => {
    // Someone with German first and Spanish second is better served in Spanish
    // than in English.
    mockLocales = [{ languageCode: "de" }, { languageCode: "es" }];
    expect(deviceLanguage()).toBe("es");
  });

  test("region codes and casing don't defeat it", () => {
    mockLocales = [{ languageCode: "ES" }];
    expect(deviceLanguage()).toBe("es");
  });

  test("a broken or absent locale API is survivable", () => {
    mockLocales = null;
    expect(deviceLanguage()).toBeNull();
  });

  test("every advertised language actually resolves", () => {
    for (const l of LANGUAGES) expect(isSupported(l.code)).toBe(true);
  });

  test("detection only applies when no choice is stored", () => {
    // It must never override a language the user picked by hand.
    const block = APP.slice(APP.indexOf("if (lg) {"), APP.indexOf("if (lg) {") + 400);
    expect(block).toContain("deviceLanguage()");
    expect(block).toMatch(/else\s*\{/);
  });

  test("switching language changes what t() returns", () => {
    setLanguage("es");
    const es = t("tabs.home");
    setLanguage("en");
    expect(t("tabs.home")).not.toBe(es);
  });
});

describe("build info for support", () => {
  test("the version reads the way a bug report needs it", () => {
    expect(versionLabel()).toBe("1.4.0 (42)");
    expect(deviceLabel()).toBe("iPhone 15 · iOS 18.2");
    expect(supportLine()).toBe("Pocket Reef 1.4.0 (42) · iPhone 15 · iOS 18.2");
  });

  test("a simulator is distinguishable from a real device", () => {
    expect(isRealDevice()).toBe(true);
  });

  test("the tank report says which build produced it", () => {
    // The report is what gets pasted into a forum; the answer to "what version
    // are you on" should already be in it.
    const tank = {
      name: "The Reef", gallons: 90, water: "salt", createdAt: new Date().toISOString(),
      stock: [], quantities: {}, stockMeta: {}, losses: [], waterTests: [],
      journal: [], maintenance: {}, treatments: [], targets: {},
    };
    expect(buildTankReport(tank)).toContain("Pocket Reef 1.4.0 (42)");
  });
});

describe("missing native values never render as blanks", () => {
  test("unknown is shown rather than an empty string", () => {
    jest.resetModules();
    jest.doMock("expo-application", () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }));
    jest.doMock("expo-device", () => ({ osVersion: null, modelName: null, isDevice: true }));
     
    const bi = require("../lib/buildInfo");
    expect(bi.versionLabel()).toBe("unknown");
    expect(bi.supportLine()).toContain("unknown");
    jest.dontMock("expo-application");
    jest.dontMock("expo-device");
  });
});
