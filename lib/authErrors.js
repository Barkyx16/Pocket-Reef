// ─────────────────────────────────────────────────────────────────────────────
// Turning Supabase's API strings into sentences.
//
// Supabase reports failures as developer-facing text: "For security purposes,
// you can only request this after 47 seconds", "New password should be
// different from the old password". Those are diagnostics, not instructions,
// and three screens were showing them to keepers verbatim.
//
// This lived inside AuthScreen, which is why only AuthScreen benefited —
// change-email, change-password and the reset modal each surfaced the raw
// string. One rule used in one of the four places it applies is the same
// defect as no rule.
//
// Anything unrecognised passes through unchanged rather than being swallowed
// by a generic apology: a real error the keeper can act on beats a friendly
// one they can't.
// ─────────────────────────────────────────────────────────────────────────────

// Supabase surfaces these as raw API strings. Rewrite the handful users actually
// hit into something that tells them what to do next; pass anything else through
// rather than swallowing a real error behind a generic apology.
export function friendlyAuthError(message = "") {
  const m = String(message).toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match an account. Check for typos, or reset your password.";
  if (m.includes("email not confirmed")) return "This account still needs to be verified.";
  if (m.includes("token has expired") || m.includes("expired")) return "That code has expired. Send a new one and try again.";
  if (m.includes("invalid") && m.includes("token")) return "That code isn't right. Check the email and re-enter it.";
  if (m.includes("already registered") || m.includes("already been registered")) return "There's already an account with that email. Log in instead, or reset the password.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("weak password") || m.includes("password should be")) return "Pick a stronger password — at least 8 characters.";
  if (m.includes("network") || m.includes("fetch")) return "Couldn't reach the server. Check your connection and try again.";
  return message || "Something went wrong. Try again.";
}

// Does this account exist but sit unverified? Supabase says so in a few
// different phrasings depending on the endpoint.
export function isUnconfirmedError(message = "") {
  const m = String(message).toLowerCase();
  return m.includes("email not confirmed") || m.includes("not confirmed");
}

