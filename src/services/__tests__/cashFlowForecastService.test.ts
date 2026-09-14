// The Finanzen cash-flow card read "Eingang € 17.848" beside "Offen € 5,4 Tsd."
// on a German device: sent quotes at an invented 45%, open invoices × 0.85, all
// dated by a field that does not exist. These pin the honest version.

const mockPredict = jest.fn();
jest.mock('../../intelligence/mlModels', () => ({
  // The real constant, not undefined — a wholesale mock that forgets it makes
  // every `confidence >= undefined` false and the test passes for the wrong
  // reason (learnings #312).
  PREDICTION_MIN_DISPLAY_CONFIDENCE: 0.6,
  predictPaymentTiming: (...args: unknown[]) => mockPredict(...args),
}));

import { buildForecast } from '../cashFlowForecastService';
import type { Invoice } from '../../domain/documents';

const TODAY = new Date(2026, 8, 14, 15, 0, 0); // 14 Sep 2026, local

function inv(p: Partial<Invoice>): Invoice {
  return { id: 'x', customer: 'c', job: 'j', amount: 1000, status: 'sent', dueInDays: 14, ...p } as Invoice;
}

beforeEach(() => {
  // Cold start: the 21-day default at confidence 0.3.
  mockPredict.mockReset().mockResolvedValue({ predictedDays: 21, confidence: 0.3 });
});

describe('buildForecast', () => {
  it('counts an open invoice at its face amount on its due date', async () => {
    const f = await buildForecast({ today: TODAY, invoices: [inv({ amount: 5200, dueDate: '2026-09-24' })] });
    expect(f.totalInflow).toBe(5200);
    expect(f.days[10]).toMatchObject({ date: '2026-09-24', inflow: 5200 });
  });

  it('counts an overdue invoice today', async () => {
    const f = await buildForecast({ today: TODAY, invoices: [inv({ status: 'overdue', amount: 180, dueDate: '2026-08-31' })] });
    expect(f.days[0]).toMatchObject({ date: '2026-09-14', inflow: 180 });
  });

  it('does not count an invoice that falls due after the horizon', async () => {
    const f = await buildForecast({ today: TODAY, invoices: [inv({ amount: 9000, dueDate: '2026-11-13', dueInDays: 60 })] });
    expect(f.totalInflow).toBe(0);
  });

  it('ignores drafts and paid invoices', async () => {
    const f = await buildForecast({
      today: TODAY,
      invoices: [inv({ status: 'draft', dueDate: '2026-09-20' }), inv({ status: 'paid', dueDate: '2026-09-20' })],
    });
    expect(f.totalInflow).toBe(0);
  });

  it('a cold-start prediction does not move the due date', async () => {
    const f = await buildForecast({
      today: TODAY,
      invoices: [inv({ dueDate: '2026-09-16', sentAt: '2026-09-02T10:00:00Z' })],
    });
    expect(f.days[2].inflow).toBe(1000);
  });

  it('a confident prediction dates the invoice from when it was sent', async () => {
    mockPredict.mockResolvedValue({ predictedDays: 20, confidence: 0.8 });
    const f = await buildForecast({
      today: TODAY,
      invoices: [inv({ dueDate: '2026-09-16', sentAt: '2026-09-02T10:00:00Z' })],
    });
    // 2 Sep + 20 days = 22 Sep = today + 8
    expect(f.days[8]).toMatchObject({ date: '2026-09-22', inflow: 1000 });
  });

  it('falls back to dueInDays when no due date is stored', async () => {
    const f = await buildForecast({ today: TODAY, invoices: [inv({ dueInDays: 5 })] });
    expect(f.days[5].inflow).toBe(1000);
  });

  it('reads an ISO-instant due date as the LOCAL day it falls on', async () => {
    // 22:30 UTC — already the next day in CEST. The in-app writers store this shape.
    const iso = '2026-09-23T22:30:00.000Z';
    const local = new Date(iso);
    const expected = Math.round(
      (Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) - Date.UTC(2026, 8, 14)) / 86_400_000,
    );
    const f = await buildForecast({ today: TODAY, invoices: [inv({ dueDate: iso })] });
    expect(f.days[expected].inflow).toBe(1000);
  });

  it('does not claim an outflow it was never given', async () => {
    const f = await buildForecast({ today: TODAY, invoices: [inv({ dueDate: '2026-09-20' })] });
    expect(f.outflowKnown).toBe(false);
    const g = await buildForecast({ today: TODAY, invoices: [], purchaseOrders: [{ amount: 400, expectedDate: '2026-09-15' }] });
    expect(g.outflowKnown).toBe(true);
    expect(g.days[1].outflow).toBe(400);
    expect(g.minCashDay.cumulative).toBe(-400);
  });

  it('does not skip or repeat a calendar day across the October DST change', async () => {
    const f = await buildForecast({ today: new Date(2026, 9, 20), invoices: [] });
    const keys = f.days.map((d) => d.date);
    expect(new Set(keys).size).toBe(30);
    expect(keys[5]).toBe('2026-10-25');
    expect(keys[6]).toBe('2026-10-26');
  });
});
