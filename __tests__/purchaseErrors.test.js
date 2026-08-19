import fs from "fs";
import path from "path";
import { friendlyPurchaseError, describeError, OUTCOME } from "../lib/purchaseErrors";

const ROOT = path.join(__dirname, "..");

describe("failures that are not failures", () => {
  // Two of RevenueCat's error codes describe situations where nothing has gone
  // wrong, and the app was showing both as "Purchase failed".
  test("already subscribed unlocks instead of erroring", () => {
    // Telling a paying customer their purchase failed is the worst available
    // reading of "you already own this".
    const f = friendlyPurchaseError({ code: "PRODUCT_ALREADY_PURCHASED_ERROR" });
    expect(f.outcome).toBe(OUTCOME.owned);
    expect(f.title).toMatch(/already have Premium/i);
  });

  test("a pending payment says it is pending", () => {
    // Ask to Buy: a parent approves it later. "Purchase failed" tells a parent
    // and child that what they just set up is broken.
    const f = friendlyPurchaseError({ code: "PAYMENT_PENDING_ERROR" });
    expect(f.outcome).toBe(OUTCOME.pending);
    expect(f.message).toMatch(/approval/i);
  });

  test("a cancelled purchase says nothing at all", () => {
    const f = friendlyPurchaseError({ code: "PURCHASE_CANCELLED_ERROR" });
    expect(f.outcome).toBe(OUTCOME.cancelled);
    expect(f.message).toBe(null);
  });
});

describe("real failures get an actionable sentence", () => {
  const cases = [
    ["PURCHASE_NOT_ALLOWED_ERROR", /Screen Time|allowed/i],
    ["STORE_PROBLEM_ERROR", /App Store/i],
    ["NETWORK_ERROR", /connection/i],
    ["OFFLINE_CONNECTION_ERROR", /offline/i],
    ["RECEIPT_ALREADY_IN_USE_ERROR", /different account|Apple ID/i],
    ["MISSING_RECEIPT_FILE_ERROR", /Restore/i],
  ];

  for (const [code, want] of cases) {
    test(`${code} is explained`, () => {
      const f = friendlyPurchaseError({ code });
      expect(f.outcome).toBe(OUTCOME.failed);
      expect(f.message).toMatch(want);
    });
  }

  test("nothing charged is said where it is true", () => {
    // A store outage is the moment people most want to know they weren't billed.
    expect(friendlyPurchaseError({ code: "STORE_PROBLEM_ERROR" }).message).toMatch(/nothing was charged/i);
  });

  test("every message is a sentence, not a fragment", () => {
    for (const [code] of cases) {
      const m = friendlyPurchaseError({ code }).message;
      expect(m[0]).toBe(m[0].toUpperCase());
      expect(m).toMatch(/[.!]$/);
    }
  });
});

describe("an unknown failure never shows the SDK's own words", () => {
  test("a Swift error description is replaced", () => {
    // "Error fetching offerings - The operation couldn't be completed.
    //  (RevenueCat.OfferingsManager.Error error 1.)" is a crash-report line.
    const f = friendlyPurchaseError({
      code: "SOMETHING_NEW_ERROR",
      error: "(RevenueCat.OfferingsManager.Error error 1.)",
    });
    expect(f.message).not.toMatch(/RevenueCat/);
    expect(f.outcome).toBe(OUTCOME.failed);
  });

  test("no code at all still produces something sayable", () => {
    for (const v of [null, undefined, {}, { code: 7 }, { code: "" }]) {
      const f = friendlyPurchaseError(v);
      expect(typeof f.message).toBe("string");
      expect(f.message.length).toBeGreaterThan(10);
      expect(f.outcome).toBe(OUTCOME.failed);
    }
  });
});

describe("describeError keeps the code, which is the documented part", () => {
  test("a code is read straight off the error", () => {
    expect(describeError({ code: "NETWORK_ERROR", message: "boom" }))
      .toEqual({ code: "NETWORK_ERROR", message: "boom" });
  });

  test("it falls back to readableErrorCode where the platform puts it there", () => {
    expect(describeError({ userInfo: { readableErrorCode: "STORE_PROBLEM_ERROR" }, message: "x" }).code)
      .toBe("STORE_PROBLEM_ERROR");
  });

  test("a plain throw still yields a message", () => {
    expect(describeError(new Error("nope")).message).toBe("nope");
    expect(describeError(null)).toEqual({ code: null, message: null });
  });
});

describe("the codes come from the installed SDK, not from memory", () => {
  test("every code mapped here exists in react-native-purchases", () => {
    // Mapping a code the SDK never emits is dead weight that looks like cover.
    const p = path.join(ROOT, "node_modules/@revenuecat/purchases-typescript-internal/dist/generated/error-codes.d.ts");
    if (!fs.existsSync(p)) return; // dependency layout changed; nothing to check against
    const sdk = fs.readFileSync(p, "utf8");
    const src = fs.readFileSync(path.join(ROOT, "lib/purchaseErrors.js"), "utf8");
    const mapped = [...src.matchAll(/^ {2}([A-Z_]+_ERROR):/gm)].map((m) => m[1]);
    expect(mapped.length).toBeGreaterThan(8);
    expect(mapped.filter((c) => !sdk.includes(c))).toEqual([]);
  });
});

describe("App routes purchase failures through it", () => {
  const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

  test("no raw SDK error string reaches an Alert", () => {
    expect(app).not.toContain('Alert.alert("Purchase failed", res.error');
    expect(app).not.toContain(`Alert.alert("Couldn't restore", res.error || "Please try again in a moment.")`);
  });

  test("both purchase paths use the mapper", () => {
    expect((app.match(/friendlyPurchaseError\(res\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test("an already-owned result unlocks rather than erroring", () => {
    expect(app).toMatch(/OUTCOME\.owned[\s\S]{0,120}setPremiumUnlocked\(true\)/);
  });
});
