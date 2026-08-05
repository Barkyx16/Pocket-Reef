import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

// ─────────────────────────────────────────────────────────────────────────────
// Premium entitlement, owned by RevenueCat.
//
// The rule this file exists to enforce: the app never decides whether someone
// has Premium. Apple and Google do, RevenueCat reports it, and we read it.
// That's what makes entitlement survive the things a local flag can't —
// reinstalls, new devices, refunds, expiry, and family sharing.
//
// Nothing here is allowed to WRITE entitlement. A local boolean that the app
// can set is a local boolean a patched build can set too.
// ─────────────────────────────────────────────────────────────────────────────

// The entitlement identifier configured in the RevenueCat dashboard
// (Project → Entitlements). Must match exactly.
export const ENTITLEMENT_ID = "premium";

// SDK keys. These are publishable by design — they identify the app to
// RevenueCat and cannot authorize anything on their own.
//
// TODO: these are TEST-mode keys. Before shipping, replace them with the
// production keys from RevenueCat → Project Settings → API Keys, and configure
// the matching products in App Store Connect and Google Play Console.
const IOS_API_KEY = "test_cdSKJajZAYHzZXjacWIMrAjDxfT";
const ANDROID_API_KEY = "test_cdSKJajZAYHzZXjacWIMrAjDxfT";

let configured = false;

// True once the SDK is live. Until then every entitlement read returns false,
// which is the correct default — unpaid, not "assume paid".
export function isPurchasesReady() {
  return configured;
}

// Starts the SDK. Safe to call more than once.
//
// Returns false when the native module isn't present — which is the normal
// state in Expo Go, since react-native-purchases needs a dev build. The app
// stays fully usable there, just permanently on the free tier.
export async function initPurchases() {
  if (configured) return true;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
    if (!apiKey) return false;
    await Purchases.configure({ apiKey });
    configured = true;
    return true;
  } catch (e) {
    configured = false;
    return false;
  }
}

// Ties the RevenueCat subscriber to the signed-in Supabase account, so store
// events arrive at the webhook with a user id we can attribute. Without this,
// purchases land under an anonymous RevenueCat id and the server-side
// entitlement row can never be written.
export async function identifyUser(userId) {
  if (!configured || !userId) return false;
  try {
    await Purchases.logIn(String(userId));
    return true;
  } catch (e) {
    return false;
  }
}

// Detaches the subscriber on sign-out, so the next account on this device
// doesn't inherit the previous one's entitlement.
export async function forgetUser() {
  if (!configured) return false;
  try {
    await Purchases.logOut();
    return true;
  } catch (e) {
    return false;
  }
}

// Reads the entitlement out of a CustomerInfo payload. The single place that
// decides what "has Premium" means, so every caller agrees.
export function hasPremiumEntitlement(customerInfo) {
  try {
    const ent = customerInfo && customerInfo.entitlements && customerInfo.entitlements.active;
    return Boolean(ent && ent[ENTITLEMENT_ID]);
  } catch (e) {
    return false;
  }
}

// Current entitlement state. Network-backed, but the SDK serves a cached
// CustomerInfo when offline, so a subscriber who opens the app on a plane keeps
// their access instead of being locked out.
export async function checkEntitlement() {
  if (!configured) return false;
  try {
    return hasPremiumEntitlement(await Purchases.getCustomerInfo());
  } catch (e) {
    // Never downgrade a paying user because a request failed — the caller keeps
    // whatever state it already had.
    return null;
  }
}

// Subscribes to entitlement changes (renewal, expiry, refund, restore on
// another device). Returns an unsubscribe function.
export function onEntitlementChange(handler) {
  if (!configured) return () => {};
  try {
    const listener = (customerInfo) => handler(hasPremiumEntitlement(customerInfo));
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { try { Purchases.removeCustomerInfoUpdateListener(listener); } catch (e) {} };
  } catch (e) {
    return () => {};
  }
}

// The packages available to buy, from the current offering.
// Returns [] when offerings aren't configured yet.
export async function getPackages() {
  if (!configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings && offerings.current;
    return current && Array.isArray(current.availablePackages) ? current.availablePackages : [];
  } catch (e) {
    return [];
  }
}

// Buys a package. Returns { ok, entitled, cancelled, error }.
export async function purchasePackage(pkg) {
  if (!configured) return { ok: false, entitled: false, cancelled: false, error: "Purchases unavailable" };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, entitled: hasPremiumEntitlement(customerInfo), cancelled: false, error: null };
  } catch (e) {
    // A user backing out of the sheet is not an error worth showing them.
    if (e && e.userCancelled) return { ok: false, entitled: false, cancelled: true, error: null };
    return { ok: false, entitled: false, cancelled: false, error: String(e && e.message ? e.message : e) };
  }
}

// Restores purchases. This is what makes a reinstall or a new device get
// Premium back, and the App Store requires it to be reachable in the UI.
export async function restorePurchases() {
  if (!configured) return { ok: false, entitled: false, error: "Purchases unavailable" };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { ok: true, entitled: hasPremiumEntitlement(customerInfo), error: null };
  } catch (e) {
    return { ok: false, entitled: false, error: String(e && e.message ? e.message : e) };
  }
}
