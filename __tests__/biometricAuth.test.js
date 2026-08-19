import fs from "fs";
import path from "path";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import {
  enableBiometricLogin, disableBiometricLogin, isBiometricEnabled,
  authenticateAndGetCredentials, storedCredentialEmail, updateStoredEmail,
  isBiometricAvailable, getBiometricLabel,
} from "../lib/biometricAuth";

const ROOT = path.join(__dirname, "..");

// A keychain that behaves like one, so ordering and partial failure are visible.
function keychain() {
  const store = new Map();
  SecureStore.getItemAsync.mockImplementation((k) => Promise.resolve(store.has(k) ? store.get(k) : null));
  SecureStore.setItemAsync.mockImplementation((k, v) => { store.set(k, v); return Promise.resolve(); });
  SecureStore.deleteItemAsync.mockImplementation((k) => { store.delete(k); return Promise.resolve(); });
  return store;
}

beforeEach(() => { jest.clearAllMocks(); });

describe("turning it off actually removes the password", () => {
  test("both the flag and the credentials go", async () => {
    const store = keychain();
    await enableBiometricLogin("keeper@example.com", "hunter2");
    expect(store.size).toBe(2);

    expect(await disableBiometricLogin()).toBe(true);
    expect(store.size).toBe(0);
    expect(await isBiometricEnabled()).toBe(false);
  });

  test("a failure is reported rather than swallowed", async () => {
    // This used to return nothing whatever happened, so the caller flipped its
    // toggle to "off" regardless. A keeper who turned it off and was told it
    // was off could still have their password sitting in the keychain.
    keychain();
    await enableBiometricLogin("keeper@example.com", "hunter2");
    SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error("keychain locked"));
    expect(await disableBiometricLogin()).toBe(false);
  });

  test("the flag is cleared first, so a partial failure leaves it OFF", async () => {
    // The two orders fail differently. Flag-last leaves biometric login
    // advertised with no credentials behind it; flag-first leaves credentials
    // with the feature off. Only one of those can mislead someone.
    const store = keychain();
    await enableBiometricLogin("keeper@example.com", "hunter2");
    SecureStore.deleteItemAsync
      .mockImplementationOnce((k) => { store.delete(k); return Promise.resolve(); }) // flag
      .mockRejectedValueOnce(new Error("keychain locked"));                           // creds
    await disableBiometricLogin();
    expect(await isBiometricEnabled()).toBe(false);
  });

  test("disabling when nothing is stored is not an error", async () => {
    keychain();
    expect(await disableBiometricLogin()).toBe(true);
  });
});

describe("enabling never leaves an orphaned password", () => {
  test("credentials are rolled back if the flag cannot be written", async () => {
    // Otherwise a password sits in the keychain for a feature the app reports
    // as off, with no route in the UI to remove it.
    const store = keychain();
    SecureStore.setItemAsync
      .mockImplementationOnce((k, v) => { store.set(k, v); return Promise.resolve(); }) // creds
      .mockRejectedValueOnce(new Error("keychain locked"));                              // flag
    expect(await enableBiometricLogin("keeper@example.com", "hunter2")).toBe(false);
    expect(store.size).toBe(0);
  });

  test("a successful enable stores both", async () => {
    const store = keychain();
    expect(await enableBiometricLogin("keeper@example.com", "hunter2")).toBe(true);
    expect(await isBiometricEnabled()).toBe(true);
    expect(store.size).toBe(2);
  });
});

describe("the stored address keeps up with the account", () => {
  test("changing the email repoints the credentials", async () => {
    // The keychain used to keep the old address, so the next biometric sign-in
    // submitted an email that no longer existed — which reads as Face ID
    // having broken, with nothing to explain it.
    keychain();
    await enableBiometricLogin("old@example.com", "hunter2");
    expect(await updateStoredEmail("new@example.com")).toBe(true);
    expect(await storedCredentialEmail()).toBe("new@example.com");

    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: true });
    expect(await authenticateAndGetCredentials()).toEqual({
      email: "new@example.com", password: "hunter2",
    });
  });

  test("the password is preserved, not blanked", async () => {
    keychain();
    await enableBiometricLogin("old@example.com", "hunter2");
    await updateStoredEmail("new@example.com");
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: true });
    expect((await authenticateAndGetCredentials()).password).toBe("hunter2");
  });

  test("there is nothing to repoint when nothing is stored", async () => {
    keychain();
    expect(await updateStoredEmail("new@example.com")).toBe(false);
    expect(await storedCredentialEmail()).toBe(null);
  });

  test("rubbish is refused rather than stored", async () => {
    keychain();
    await enableBiometricLogin("old@example.com", "hunter2");
    for (const v of [null, undefined, "", 42, {}]) expect(await updateStoredEmail(v)).toBe(false);
    expect(await storedCredentialEmail()).toBe("old@example.com");
  });

  test("corrupt stored JSON does not throw", async () => {
    const store = keychain();
    store.set("pr_bio_credentials", "{not json");
    expect(await storedCredentialEmail()).toBe(null);
    expect(await updateStoredEmail("new@example.com")).toBe(false);
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: true });
    expect(await authenticateAndGetCredentials()).toBe(null);
  });
});

describe("credentials are only released after a successful check", () => {
  test("a cancelled prompt returns nothing", async () => {
    keychain();
    await enableBiometricLogin("keeper@example.com", "hunter2");
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: false });
    expect(await authenticateAndGetCredentials()).toBe(null);
  });

  test("a successful check with nothing stored returns nothing", async () => {
    keychain();
    LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: true });
    expect(await authenticateAndGetCredentials()).toBe(null);
  });

  test("availability needs hardware AND an enrolled face", async () => {
    LocalAuthentication.hasHardwareAsync.mockResolvedValueOnce(true);
    LocalAuthentication.isEnrolledAsync.mockResolvedValueOnce(false);
    expect(await isBiometricAvailable()).toBe(false);

    LocalAuthentication.hasHardwareAsync.mockResolvedValueOnce(true);
    LocalAuthentication.isEnrolledAsync.mockResolvedValueOnce(true);
    expect(await isBiometricAvailable()).toBe(true);
  });

  test("a thrown check reads as unavailable, not available", async () => {
    LocalAuthentication.hasHardwareAsync.mockRejectedValueOnce(new Error("no"));
    expect(await isBiometricAvailable()).toBe(false);
  });

  test("the label always says something", async () => {
    // The shared mock doesn't define this one, so the call throws and the
    // function falls back — which is the path worth pinning anyway.
    expect(typeof await getBiometricLabel()).toBe("string");
    expect((await getBiometricLabel()).length).toBeGreaterThan(0);
  });
});

describe("deleting the account takes the keychain copy with it", () => {
  const src = fs.readFileSync(path.join(ROOT, "components/AccountCloudCard.js"), "utf8");

  test("the delete flow clears biometric credentials", () => {
    // Credentials live in the device keychain, not in the account, so deleting
    // the account left them behind — while the app said "your account and its
    // data are gone".
    const at = src.indexOf('"Delete forever"');
    expect(at).toBeGreaterThan(0);
    const flow = src.slice(at, src.indexOf("Account deleted", at));
    expect(flow).toContain("disableBiometricLogin()");
  });

  test("changing the email repoints the stored credentials", () => {
    expect(src).toContain("updateStoredEmail(clean)");
  });
});
