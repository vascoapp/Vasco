/**
 * THE rounding rule for money in Vasco — one definition, imported everywhere
 * a figure reaches a document, a filing, a bill or a stored amount (guard:
 * src/__tests__/oneRoundingRule.test.ts). A leaf module on purpose: it imports
 * nothing, so src/constants/taxRates.ts can use it although
 * src/domain/business.ts (which re-exports it) imports taxRates.
 */
/*
 * Money to the cent, corrected for float REPRESENTATION.
 *
 * `1.5 * 0.19` is `0.28499999999999998`, so a plain `Math.round(n * 100) / 100`
 * gives € 0,28 where the exact decimal 0,285 rounds up to € 0,29 — a cent of
 * VAT lost on an amount as ordinary as € 1,50 at 19 %. Normalising to twelve
 * significant digits first restores the value the arithmetic actually means
 * before rounding it (#354).
 */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return n;
  // Half away from zero — commercial rounding. `Math.round` rounds half toward
  // +∞, which sends a credit note's −0,285 to −0,28 while +0,285 goes to
  // +0,29: the same amount rounded two different ways depending on its sign.
  const cents = Math.round(Number((Math.abs(n) * 100).toPrecision(12)));
  return (n < 0 ? -cents : cents) / 100;
}
