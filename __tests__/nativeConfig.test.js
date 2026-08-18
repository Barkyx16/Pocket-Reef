const fs = require("fs");
const path = require("path");

// Native configuration the JS tests can't see, and a device build fails on.
//
// The one that started this file: the app calls
// ImagePicker.launchImageLibraryAsync in two places, expo-image-picker was
// installed as a dependency, and it was NOT in app.json's plugins array with
// no infoPlist entries at all. On iOS, touching the photo library without
// NSPhotoLibraryUsageDescription doesn't degrade — the OS terminates the app.
// Every test in this suite passed, the bundle built, and attaching a photo
// would have crashed on a real phone.
//
// So: anything the app calls that needs a native permission is checked here
// against what's actually declared.

const app = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app.json"), "utf8")).expo;
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const sourceFiles = ["components", "screens", "lib"].flatMap((dir) =>
  fs.readdirSync(path.join(__dirname, "..", dir)).filter((f) => f.endsWith(".js")).map((f) => `${dir}/${f}`)
).concat(["App.js"]);
const ALL_SOURCE = sourceFiles.map(read).join("\n");

const pluginNames = (app.plugins || []).map((p) => (typeof p === "string" ? p : p[0]));
const pluginConfig = (name) => {
  const entry = (app.plugins || []).find((p) => Array.isArray(p) && p[0] === name);
  return entry ? entry[1] || {} : null;
};
const infoPlist = (app.ios && app.ios.infoPlist) || {};

describe("permissions the app actually asks for are declared", () => {
  test("the photo library, which two cards open", () => {
    // Only assert if the app really uses it — the point is to track reality.
    expect(ALL_SOURCE).toContain("launchImageLibraryAsync");
    expect(pkg.dependencies["expo-image-picker"]).toBeTruthy();
    expect(pluginNames).toContain("expo-image-picker");

    const cfg = pluginConfig("expo-image-picker") || {};
    const reason = cfg.photosPermission || infoPlist.NSPhotoLibraryUsageDescription;
    expect(typeof reason).toBe("string");
    // Apple rejects boilerplate. A usable string names the app and the purpose.
    expect(reason.length).toBeGreaterThan(30);
    expect(reason).toMatch(/photo/i);
  });

  test("Face ID, which the auth screen offers", () => {
    expect(ALL_SOURCE).toMatch(/LocalAuthentication|authenticateAsync|biometric/i);
    expect(pluginNames).toContain("expo-local-authentication");
    const reason = infoPlist.NSFaceIDUsageDescription;
    expect(typeof reason).toBe("string");
    expect(reason.length).toBeGreaterThan(30);
  });

  test("notifications, which the reminder system schedules", () => {
    expect(pluginNames).toContain("expo-notifications");
  });

  test("every expo package that needs a config plugin has one", () => {
    // Keeps the next dependency from being added without its plugin.
    const NEEDS_PLUGIN = ["expo-notifications", "expo-image-picker", "expo-local-authentication", "expo-font", "expo-secure-store"];
    NEEDS_PLUGIN.forEach((name) => {
      if (!pkg.dependencies[name]) return;
      expect(pluginNames).toContain(name);
    });
  });
});

describe("the build is identifiable and shippable", () => {
  test("bundle id, package and scheme are set", () => {
    expect(app.ios.bundleIdentifier).toMatch(/^[a-z0-9.]+$/i);
    expect(app.android.package).toMatch(/^[a-z0-9.]+$/i);
    expect(app.scheme).toBeTruthy();
  });

  test("the deep-link scheme matches what the auth redirects use", () => {
    // A mismatch means confirmation and reset links open nothing.
    const cfg = read("lib/supabaseConfig.js");
    // Only the redirect constants — the project URL in the same file is https
    // and matching it would compare the scheme against the wrong thing.
    const redirects = [...cfg.matchAll(/(?:AUTH|RESET)_REDIRECT\s*=\s*"([a-z]+):\/\//g)].map((m) => m[1]);
    expect(redirects.length).toBe(2);
    redirects.forEach((s) => expect(s).toBe(app.scheme));
  });

  test("the app version matches the newest release note", () => {
    const { LATEST_VERSION } = require("../lib/whatsNew");
    expect(app.version).toBe(LATEST_VERSION);
  });

  test("export compliance is answered so uploads don't stall on it", () => {
    expect(infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  test("icon and splash assets exist on disk", () => {
    expect(fs.existsSync(path.join(__dirname, "..", app.icon.replace("./", "")))).toBe(true);
    const splash = app.splash && app.splash.image;
    if (splash) expect(fs.existsSync(path.join(__dirname, "..", splash.replace("./", "")))).toBe(true);
  });

  test("iPad is supported, now that the layout reflows for it", () => {
    expect(app.ios.supportsTablet).toBe(true);
  });
});
