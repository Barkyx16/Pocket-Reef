import { currencySymbol, currencyDecimals, currencyTrails } from "./currency";
// ─────────────────────────────────────────────────────────────────────────────
// How numbers are shown to a keeper.
//
// The engines round for precision — `round(perDay, 4)` exists so that a rate
// small enough to matter over a month isn't quantised away before the run-out
// date is computed. That is the right call for arithmetic and the wrong one for
// a sentence. Those four decimals were going straight into the UI:
//
//     1.1874/day from measured
//
// Nobody doses 1.1874 of anything. The extra digits read as precision the
// measurement does not have — this is a rate inferred from four water changes,
// and presenting it to a ten-thousandth claims an accuracy that would be
// remarkable in a laboratory.
//
// The rule here is significant figures rather than fixed decimals, because the
// quantities span six orders of magnitude. A fixed 2dp turns a trace-element
// dose of 0.0004 ml into "0.00", which is worse than the noise it was meant to
// tidy: it reads as nothing at all.
// ─────────────────────────────────────────────────────────────────────────────

// Three significant figures is the most any of these measurements supports —
// test kits resolve to two, and inferred rates to fewer still.
const SIG = 3;

// Shows a measured quantity the way a person would say it.
export function fmt(value, { sig = SIG, max = 2 } = {}) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";

  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  // Decimals needed to carry `sig` significant figures, never more than `max`
  // for values above 1 — "1.19" not "1.187" — and never fewer than needed to
  // show something for values below 1.
  let dp = Math.max(0, sig - 1 - magnitude);
  if (Math.abs(n) >= 1) dp = Math.min(dp, max);
  // Below 1, keep going until a figure appears rather than rounding to zero.
  else dp = Math.min(dp, 6);

  // Above 1e21 toFixed switches to exponent notation ("1e+21"), which is not a
  // quantity anybody keeping fish needs to read. Nothing legitimate reaches
  // this, but a corrupted record can, and it should look wrong rather than
  // look scientific.
  if (Math.abs(n) >= 1e21) return "—";

  const out = n.toFixed(dp);
  // Trailing zeros are noise: "1.20" claims a resolution "1.2" doesn't.
  return dp > 0 ? out.replace(/\.?0+$/, "") : out;
}

// Number(null) is 0 and Number("") is 0 — both finite, both a lie. Every
// formatter has to reject the empties before it converts, or a missing figure
// renders as a confident zero.
const isBlank = (v) => v === null || v === undefined || v === "" || typeof v === "boolean";

// Whole things — fish, days, tests. Never fractional.
export function fmtCount(value) {
  if (isBlank(value)) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

// Money always carries both decimal places, because a price that renders as
// "$12.5" looks like a bug in a way that "1.19 ml" does not.
export function fmtMoney(value, currency) {
  if (isBlank(value)) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  // The symbol comes from the keeper's preference unless a caller names one.
  const sym = currency != null ? currency : currencySymbol();
  const dp = currency != null ? 2 : currencyDecimals();
  // Thousands are grouped, because "1235" and "$1,235" read differently at a
  // glance and a tank build reaches four figures easily. Grouping is done with
  // the device's own locale so a keeper who writes 1.235,50 sees that — the
  // hardcoded "en-US" here was the same assumption the decimal-pad fix was
  // about, one layer further out.
  const big = Math.abs(n) >= 1000;
  const body = big ? Math.round(n).toLocaleString() : n.toFixed(dp);
  return currencyTrails() && currency == null ? `${body} ${sym}` : `${sym}${body}`;
}

// A percentage, which is always shown whole — nobody needs 24.7% of a water
// change, and the underlying figure is rarely accurate to a tenth anyway.
export function fmtPct(value) {
  if (isBlank(value)) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

// "1.19 ml/day" — the unit is part of the number as far as a reader is
// concerned, and gluing them here stops each caller inventing its own spacing.
export function fmtWithUnit(value, unit) {
  const v = fmt(value);
  if (v === "—") return v;
  return unit ? `${v} ${unit}` : v;
}
