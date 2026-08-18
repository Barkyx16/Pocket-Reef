// ─────────────────────────────────────────────────────────────────────────────
// Whose money is this?
//
// Every price in the app was rendered with a dollar sign. Not as a default —
// as a fact. A keeper in Manchester logs 40 for a bag of salt, meaning £40,
// and the app tells them for the rest of the tank's life that they spent $40.
// The running-cost card, the lifetime spend, the equipment build total and the
// cost-per-gallon all inherit it.
//
// The app already knew this was wrong. There is a units preference, and a
// keeper who has switched it to metric has told us fairly plainly that they
// are not in the United States — and still had their money labelled in
// dollars.
//
// What this deliberately does NOT do is convert. Pocket Reef has no exchange
// rates, no way to get them offline, and no business guessing what a figure
// typed three years ago was worth. The number the keeper typed is already in
// their currency; the only thing that was ever wrong was the symbol in front
// of it. So this picks the symbol and nothing else.
//
// Module singleton, matching units.js and i18n: App holds the state, flips
// this on change, and re-renders — no prop threading through forty cards.
// ─────────────────────────────────────────────────────────────────────────────

// Symbol first, because that is what the formatter needs; the code is what
// gets stored and shown in the picker.
export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US$" },
  { code: "EUR", symbol: "€", label: "€" },
  { code: "GBP", symbol: "£", label: "£" },
  { code: "CAD", symbol: "$", label: "CA$" },
  { code: "AUD", symbol: "$", label: "AU$" },
  { code: "JPY", symbol: "¥", label: "¥" },
  { code: "INR", symbol: "₹", label: "₹" },
  { code: "BRL", symbol: "R$", label: "R$" },
  { code: "ZAR", symbol: "R", label: "R" },
  { code: "SEK", symbol: "kr", label: "kr" },
];

const DEFAULT = "USD";
let code = DEFAULT;

export function setCurrency(next) {
  code = CURRENCIES.some((c) => c.code === next) ? next : DEFAULT;
}

export function getCurrency() {
  return code;
}

export function currencySymbol() {
  const found = CURRENCIES.find((c) => c.code === code);
  return found ? found.symbol : "$";
}

// Currencies that don't use minor units — showing ¥1200.00 is wrong in a way
// that showing £12.00 is not.
const NO_DECIMALS = new Set(["JPY"]);

export function currencyDecimals() {
  return NO_DECIMALS.has(code) ? 0 : 2;
}

// Symbols that follow the number rather than leading it.
const TRAILING = new Set(["SEK"]);

export function currencyTrails() {
  return TRAILING.has(code);
}
