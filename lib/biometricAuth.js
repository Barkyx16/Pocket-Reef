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
    return false;
  }
}

export async function disableBiometricLogin() {
  try {
    await SecureStore.deleteItemAsync(CRED_KEY);
    await SecureStore.deleteItemAsync(ENABLED_KEY);
  } catch (e) {
    /* ignore — nothing stored is the same as disabled */
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
