/**
 * A quote's net / VAT / gross for the CUSTOMER's page — the same rule as
 * `documentVatBreakdown` in src/domain/business.ts, which the app uses on the
 * same quote and on the invoice made from it.
 *
 * An edge function cannot import from `src/`, so this was a hand-kept copy in
 * verify-quote-token — and it drifted: the app moved to EN 16931 rounding
 * (line nets in cents, VAT per rate on their sum; #360) and the portal kept VAT
 * on the unrounded lines, so a customer could accept € 143,73 and be invoiced
 * € 143,74 (review, 2026-09-30). This module is pure TypeScript with no Deno
 * API, so the app's jest suite imports it and proves the two agree:
 * src/__tests__/portalTotalsMatchTheApp.test.ts.
 */

/** Commercial rounding to cents — identical to `round2` in src/domain/business.ts. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return n;
  const cents = Math.round(Number((Math.abs(n) * 100).toPrecision(12)));
  return (n < 0 ? -cents : cents) / 100;
}

export interface TotalsLine {
  quantity?: number | null;
  unit_price?: number | null;
  vat_rate?: number | null;
}

export function quoteTotals(args: {
  /** `documents.total_amount` — the quote's NET. */
  netTotal: number;
  lines: TotalsLine[] | null | undefined;
  /** Fractional (0.19), the rate for a quote whose lines do not say. */
  standardRate: number;
}): { net: number; vat: number; gross: number } {
  const lines = args.lines ?? [];
  const amount = (l: TotalsLine) => (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
  const raw = lines.reduce((s, l) => s + amount(l), 0);
  const reconciles = lines.length > 0 && Math.abs(raw - args.netTotal) <= 0.01;
  // The lines in cents when they ARE the amount, else the amount itself.
  const net = reconciles ? round2(lines.reduce((s, l) => s + round2(amount(l)), 0)) : round2(args.netTotal);
  // An effective rate of 0 — a Kleinunternehmer / KOR seller, or a country
  // with no rate — charges NO VAT, whatever a line says; the app's
  // `vatRateGroups` returns no groups before it looks at a line. The portal
  // showed a KOR contractor's customer 19 % VAT the invoice never charged
  // (review, 2026-09-30).
  if (args.standardRate === 0) return { net, vat: 0, gross: net };

  // A line without a rate is a line at the document's rate — as the app
  // treats it and as the database stores it (review, 2026-09-30).
  const rateOf = (l: TotalsLine) =>
    l.vat_rate !== null && l.vat_rate !== undefined && Number.isFinite(Number(l.vat_rate))
      ? Number(l.vat_rate)
      // 0.07 × 100 is 7.000000000000001: without normalising, an unrated line
      // formed its own "7 %" group beside the explicit 7 % lines and each was
      // rounded separately — a cent off the app (property test, 2026-09-30).
      : Number((args.standardRate * 100).toPrecision(12));

  let vat: number;
  if (lines.length > 0 && reconciles) {
    // One VAT per rate, on that rate's lines in cents (EN 16931 BT-116/117).
    const byRate = new Map<number, number>();
    for (const l of lines) {
      const r = rateOf(l);
      byRate.set(r, (byRate.get(r) ?? 0) + round2(amount(l)));
    }
    vat = round2([...byRate.entries()].reduce((s, [r, base]) => s + round2(round2(base) * (r / 100)), 0));
  } else {
    const rates = Array.from(new Set(lines.map(rateOf)));
    const rate = lines.length > 0 && rates.length === 1 ? rates[0] / 100 : args.standardRate;
    vat = round2(net * rate);
  }
  return { net, vat, gross: round2(net + vat) };
}
