import Constants from "expo-constants";
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Which runtime are we in?
//
// Expo Go has no native modules for in-app purchases, push notifications,
// haptics or biometrics. Loading them there doesn't fail loudly — it degrades:
// RevenueCat silently falls back to "Browser Mode" and starts posting analytics
// events for a store that cannot transact, and expo-notifications logs warnings
// about functionality that was removed from Expo Go in SDK 53.
//
// None of that is broken, but all of it is noise that hides real problems in
// the log. Guarding on this lets those subsystems stay quiet until they're in
// a build where they can actually do their job.
// ─────────────────────────────────────────────────────────────────────────────

// "storeClient" is Expo Go; a dev/standalone build reports "bare"/"standalone".
export const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

// Native modules only exist off the web too.
export const IS_WEB = Platform.OS === "web";

// True only where the native side is genuinely present.
export const HAS_NATIVE_MODULES = !IS_EXPO_GO && !IS_WEB;
