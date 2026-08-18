// ─────────────────────────────────────────────────────────────────────────────
// Rounding, in one place.
//
// Thirteen modules each declared their own:
//
//     const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
//
// Identical in ten of them and defaulted to one decimal in the other three,
// which is the part that matters — the same call, `round(x)`, meant two
// different precisions depending on which file you were reading. Nothing was
// wrong today; there was simply nothing keeping them in step, and a helper
// whose behaviour depends on its file is a helper that will eventually
// disagree with itself.
//
// This is arithmetic for the engines. Formatting a number for a person is a
// different job with different rules, and lives in format.js.
// ─────────────────────────────────────────────────────────────────────────────

export function round(n, dp = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return v;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export const round1 = (n) => round(n, 1);
export const round2 = (n) => round(n, 2);
