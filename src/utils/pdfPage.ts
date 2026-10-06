/**
 * The page every PDF the app makes is printed on: A4, in points.
 *
 * expo-print's default is US Letter (612 × 792). Only the quote PDF passed a
 * size, so every invoice, VAT report and receipt left on Letter — the wrong
 * paper in all six markets, and shorter, so a one-line French invoice spilled
 * its legal footer onto a second page (FR walk, 2026-10-06).
 */
export const A4_PAGE = { width: 595, height: 842 } as const;
