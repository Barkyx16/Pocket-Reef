import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// Face ID / Touch ID sign-in, mirroring Pocket Planter's lib/biometricAuth.js.
// Credentials live in the device keychain/keystore (encrypted at rest) and are
// only handed back after a successful biometric check — they never touch
// AsyncStorage and are never logged.
const CRED_KEY = "pr_bio_credentials";
const ENABLED_KEY = "pr_bio_enabled";

// True only when the device has biometric hardware AND the user has enrolled a
// face/finger. Both are required — hardware alone isn't enough.
export async function isBiometricAvailable() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch (e) {
    return false;
  }
}

// Human label for the button/prompt: "Face ID", "Touch ID", or a generic fallback.
export async function getBiometricLabel() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Touch ID";
    return "Biometric Login";
  } catch (e) {
    return "Face ID";
  }
}

export async function isBiometricEnabled() {
  try {
    return (await SecureStore.getItemAsync(ENABLED_KEY)) === "true";
  } catch (e) {
    return false;
  }
}

// Stores the credentials behind the keychain and flips the enabled flag on.
export async function enableBiometricLogin(email, password) {
  try {
    await SecureStore.setItemAsync(CRED_KEY, JSON.stringify({ email, password }));
    await SecureStore.setItemAsync(ENABLED_KEY, "true");
    return true;
  } catch (e) {
    // The credentials may have landed before the flag did. Leaving them there
    // means a password sitting in the keychain for a feature the app reports as
    // off, with no way for anyone to remove it.
    try { await SecureStore.deleteItemAsync(CRED_KEY); } catch (e2) { /* nothing more to try */ }
    return false;
  }
}

// Returns whether the credentials are actually gone.
//
// This used to swallow every failure and return nothing, so the caller flipped
// its toggle to "off" regardless. A keeper who turned biometric login off and
// was told it was off could still have their password in the keychain.
export async function disableBiometricLogin() {
  let ok = true;
  // The flag first: if only one of the two deletions succeeds, the feature
  // being off with credentials still present is far better than the reverse.
  try { await SecureStore.deleteItemAsync(ENABLED_KEY); } catch (e) { ok = false; }
  try { await SecureStore.deleteItemAsync(CRED_KEY); } catch (e) { ok = false; }
  return ok;
}

// The email on the stored credentials, without prompting for a face. Used to
// notice that the account email has moved on since they were saved.
export async function storedCredentialEmail() {
  try {
    const raw = await SecureStore.getItemAsync(CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.email === "string" ? parsed.email : null;
  } catch (e) {
    return null;
  }
}

// Repoints the saved credentials at a new address, keeping the password.
//
// Changing the account email left the keychain holding the old one, so the next
// biometric sign-in submitted an address that no longer existed and failed with
// nothing to explain why — it reads as Face ID having broken.
export async function updateStoredEmail(email) {
  try {
    if (!email || typeof email !== "string") return false;
    const raw = await SecureStore.getItemAsync(CRED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.password !== "string") return false;
    await SecureStore.setItemAsync(CRED_KEY, JSON.stringify({ email, password: parsed.password }));
    return true;
  } catch (e) {
    return false;
  }
}

// Prompts the biometric check; on success returns the stored { email, password },
// otherwise null (cancelled, failed, or nothing stored).
export async function authenticateAndGetCredentials(promptMessage) {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || "Sign in to Pocket Reef",
      fallbackLabel: "Use password",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    if (!result.success) return null;
    const raw = await SecureStore.getItemAsync(CRED_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
