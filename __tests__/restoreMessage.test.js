import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");
const paywall = fs.readFileSync(path.join(ROOT, "screens/PremiumTab.js"), "utf8");

describe("a restore that finds nothing says why it might have", () => {
  // This is the moment a paying customer is most likely to think they have
  // been charged for nothing. The message stated the outcome and stopped:
  // "No active subscription was found for this store account." True, and no
  // help — the cause is almost always the same one, and it is not something
  // the app can fix but is something it can name.
  const block = app.slice(app.indexOf('"Nothing to restore"'), app.indexOf('"Nothing to restore"') + 700);

  test("it names the usual cause: the wrong Apple ID", () => {
    expect(block).toMatch(/different Apple ID/i);
  });

  test("and says where to change it", () => {
    // "Sign into the right account" is useless without the path to it.
    expect(block).toMatch(/Settings.*Media & Purchases/i);
  });

  test("it covers the other real case, a lapsed subscription", () => {
    expect(block).toMatch(/lapsed/i);
    expect(block).toMatch(/resubscribe/i);
  });

  test("the old dead end is gone", () => {
    expect(app).not.toContain("No active subscription was found for this store account.");
  });
});

describe("the paywall itself never leaves you stuck", () => {
  // Checked, not changed — every state already has an explanation and a way on.
  test("plans that will not load say so, and say what to try", () => {
    expect(paywall).toMatch(/Plans aren't available right now\. Check your connection/i);
  });

  test("a build that cannot buy explains why rather than failing silently", () => {
    expect(paywall).toMatch(/need a device build/i);
  });

  test("the button reflects the state instead of lying", () => {
    expect(paywall).toMatch(/"Unavailable right now"/);
    expect(paywall).toMatch(/canBuy && !buying && onPurchase/);
  });

  test("restore stays reachable in every state", () => {
    // The App Store requires it, and it is how a reinstall gets premium back.
    const restore = paywall.slice(paywall.indexOf("onRestore && onRestore()"));
    expect(restore.length).toBeGreaterThan(0);
    expect(paywall).not.toMatch(/canBuy[^\n]{0,40}onRestore/);
  });
});
