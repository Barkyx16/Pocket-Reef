// ─────────────────────────────────────────────────────────────────────────────
// Turning StoreKit's failures into sentences.
//
// The same problem as authErrors.js, one shop down. purchasePackage and
// restorePurchases returned `String(e.message)` and three Alerts showed it
// verbatim. RevenueCat's messages are written for whoever is reading the
// crash report:
//
//     Error fetching offerings - The operation couldn't be completed.
//     (RevenueCat.OfferingsManager.Error error 1.)
//
// Two of these matter more than the wording, because they are not failures at
// all and the app was presenting them as one:
//
//   PRODUCT_ALREADY_PURCHASED — they are already subscribed. Telling a paying
//     customer "Purchase failed" is the worst possible reading of this. The
//     right move is to unlock and say so.
//
//   PAYMENT_PENDING — common with Ask to Buy and some payment methods. Nothing
//     has failed; it is waiting on someone. "Purchase failed" tells a parent
//     and child that the thing they just set up is broken.
//
// Matching is on `code` rather than the message, because the codes are a
// documented API and the strings are not.
// ─────────────────────────────────────────────────────────────────────────────

// How the app should treat a failure, beyond what to say about it.
export const OUTCOME = {
  failed: "failed",       // a real failure; show it
  pending: "pending",     // nothing is wrong yet; waiting on approval
  owned: "owned",         // already entitled; unlock
  cancelled: "cancelled", // the user backed out; say nothing
};

const BY_CODE = {
  PURCHASE_CANCELLED_ERROR: { outcome: OUTCOME.cancelled, message: null },
  PRODUCT_ALREADY_PURCHASED_ERROR: {
    outcome: OUTCOME.owned,
    title: "You already have Premium",
    message: "This purchase is already on your Apple ID — everything is unlocked.",
  },
  PAYMENT_PENDING_ERROR: {
    outcome: OUTCOME.pending,
    title: "Waiting for approval",
    message: "Your purchase needs approval before it completes. Premium unlocks as soon as it goes through.",
  },
  PURCHASE_NOT_ALLOWED_ERROR: {
    outcome: OUTCOME.failed,
    message: "This device isn't allowed to make purchases. Check Screen Time restrictions and try again.",
  },
  PURCHASE_INVALID_ERROR: {
    outcome: OUTCOME.failed,
    message: "The App Store refused the payment. Check your payment method and try again.",
  },
  STORE_PROBLEM_ERROR: {
    outcome: OUTCOME.failed,
    message: "The App Store is having trouble. Try again in a few minutes — nothing was charged.",
  },
  NETWORK_ERROR: {
    outcome: OUTCOME.failed,
    message: "Couldn't reach the App Store. Check your connection and try again.",
  },
  OFFLINE_CONNECTION_ERROR: {
    outcome: OUTCOME.failed,
    message: "You're offline. Reconnect and try again.",
  },
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: {
    outcome: OUTCOME.failed,
    message: "Premium isn't available on this account's store region yet.",
  },
  RECEIPT_ALREADY_IN_USE_ERROR: {
    outcome: OUTCOME.failed,
    message: "That purchase is already linked to a different account. Sign in with the Apple ID you bought it on.",
  },
  INVALID_RECEIPT_ERROR: {
    outcome: OUTCOME.failed,
    message: "The App Store receipt couldn't be read. Try Restore Purchases.",
  },
  MISSING_RECEIPT_FILE_ERROR: {
    outcome: OUTCOME.failed,
    message: "No purchase was found on this device. Try Restore Purchases.",
  },
  OPERATION_ALREADY_IN_PROGRESS_ERROR: {
    outcome: OUTCOME.failed,
    message: "That's already running — give it a moment.",
  },
  CONFIGURATION_ERROR: {
    outcome: OUTCOME.failed,
    message: "Purchases aren't set up correctly in this build.",
  },
};

const FALLBACK = "Something went wrong with the App Store. Please try again.";

// `err` is what purchasePackage/restorePurchases put in their result: a code
// and a message. Returns { outcome, title, message }.
export function friendlyPurchaseError(err) {
  const code = err && typeof err.code === "string" ? err.code : null;
  const known = code ? BY_CODE[code] : null;
  if (known) return { title: known.title || "Purchase failed", ...known };

  // Unknown codes fall back to a sentence rather than the SDK's own text: a
  // message naming a Swift error enum tells the keeper nothing they can act on,
  // and the code is preserved on the result for anyone reading a bug report.
  return { outcome: OUTCOME.failed, title: "Purchase failed", message: FALLBACK };
}

// Pulls the parts worth keeping off a thrown SDK error.
export function describeError(e) {
  if (!e) return { code: null, message: null };
  const code = typeof e.code === "string" ? e.code
    : e.userInfo && typeof e.userInfo.readableErrorCode === "string" ? e.userInfo.readableErrorCode
      : null;
  return { code, message: typeof e.message === "string" ? e.message : String(e) };
}
