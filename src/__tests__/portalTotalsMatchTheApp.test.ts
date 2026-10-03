/**
 * @jest-environment node
 */
// The customer's quote page (verify-quote-token → admin/src/app/quote/[id])
// shows the total the customer ACCEPTS; the app bills the invoice made from
// that quote with `documentVatBreakdown`. They were two hand-kept copies of one
// rule and drifted: after #360 the portal still took VAT on the unrounded
// lines, so a customer could accept € 143,73 and be invoiced € 143,74 (review,
// 2026-09-30). The portal's rule now lives in a pure module this suite imports.
import { quoteTotals, round2 as portalRound2 } from '../../supabase/functions/_shared/documentTotals';
import { documentVatBreakdown, round2 } from '../domain/business';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const RATES = [0, 5.5, 7, 9, 10, 19, 20, 21, 22];

it('the review\'s own example', () => {
  const lines = [
    { quantity: 1.333, unit_price: 55, vat_rate: 19 },
    { quantity: 2.5, unit_price: 12.99, vat_rate: 19 },
    { quantity: 3, unit_price: 4.995, vat_rate: 19 },
  ];
  const net = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const app = documentVatBreakdown(net, lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unit_price, vatRate: l.vat_rate })), 19);
  expect(quoteTotals({ netTotal: round2(net), lines, standardRate: 0.19 })).toEqual({ net: app.net, vat: app.vat, gross: app.gross, ratePct: 19 });
});

it('the portal and the app state the same quote the same way, 20000 quotes', () => {
  const rand = rng(1234);
  const failures: unknown[] = [];
  for (let i = 0; i < 20000; i++) {
    // Index 0 included: rate 0 is the Kleinunternehmer / KOR seller, the case
    // the first version of this test never generated (review 2026-09-30).
    const standard = RATES[Math.floor(rand() * RATES.length)];
    const mode = Math.floor(rand() * 3); // 0 all rated · 1 some rated · 2 none
    const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, n) => ({
      quantity: Math.round(rand() * 900) / 100,
      unit_price: Math.round(rand() * 20000) / 100,
      vat_rate: mode === 0 || (mode === 1 && n % 2 === 0) ? RATES[Math.floor(rand() * RATES.length)] : null,
    }));
    const raw = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    // documents.total_amount is numeric(12,2); sometimes a hand-edited total.
    const netTotal = rand() < 0.15 ? round2(raw * 0.9) : round2(raw);
    const app = documentVatBreakdown(
      netTotal,
      lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unit_price, ...(l.vat_rate === null ? {} : { vatRate: l.vat_rate }) })),
      standard,
    );
    const portal = quoteTotals({ netTotal, lines, standardRate: standard / 100 });
    // The label: one rate, or none when the document mixes them — the app's
    // `ratePct` answers the same question (null on a mixed document).
    const appLabel = standard === 0 ? 0 : app.ratePct;
    // Compared on EVERY document, a VAT-free one included: only comparing
    // when there were groups hid the zero-VAT label edge (agent batch B).
    const labelDiffers = portal.ratePct !== appLabel;
    if (portal.net !== app.net || portal.vat !== app.vat || portal.gross !== app.gross || labelDiffers) {
      failures.push({ i, standard, mode, lines, netTotal, app: { net: app.net, vat: app.vat, gross: app.gross, ratePct: app.ratePct }, portal });
    }
  }
  expect(failures.slice(0, 2)).toEqual([]);
});

it('one rounding rule on both sides', () => {
  for (const n of [0.285, -0.285, 1.005, -1.005, 2.675, 124.605, 1.5 * 0.19]) expect(portalRound2(n)).toBe(round2(n));
});

describe('a document whose lines are all 0 % is labelled 0 %, not the standard rate', () => {
  // Decisions 2026-09-30 "OPEN (from reviews, low)": lines at 0 % that do not
  // add up to the stored amount (a discount, a hand-edited total) produced no
  // VAT — correctly — under a label reading the standard rate: "BTW (21 %)
  // € 0,00". Both sides.
  const lines = [
    { quantity: 2, unit_price: 100, vat_rate: 0 },
    { quantity: 1, unit_price: 50, vat_rate: 0 },
  ];
  const appLines = lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unit_price, vatRate: l.vat_rate }));

  it.each([
    ['the lines do not add up (a discount)', 225],
    ['the lines add up', 250],
  ])('%s', (_case, netTotal) => {
    const app = documentVatBreakdown(netTotal, appLines, 21);
    const portal = quoteTotals({ netTotal, lines, standardRate: 0.21 });
    expect({ vat: app.vat, ratePct: app.ratePct }).toEqual({ vat: 0, ratePct: 0 });
    expect({ vat: portal.vat, ratePct: portal.ratePct }).toEqual({ vat: 0, ratePct: 0 });
  });

  it('…but an unrated line is at the standard rate, so its label stays', () => {
    const mixed = [{ quantity: 1, unit_price: 100, vat_rate: 0 }, { quantity: 1, unit_price: 0, vat_rate: null }];
    const portal = quoteTotals({ netTotal: 90, lines: mixed, standardRate: 0.21 });
    const app = documentVatBreakdown(90, [{ quantity: 1, unitPrice: 100, vatRate: 0 }, { quantity: 1, unitPrice: 0 }], 21);
    expect(portal.ratePct).toBe(app.ratePct);
    expect(app.ratePct).toBe(21);
  });
});
