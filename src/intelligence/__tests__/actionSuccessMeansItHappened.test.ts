/**
 * An AI action reports success only when its effect HAPPENED (sweep B5).
 *
 * Every handler returned `success: true` — "Purchase order created", "Quote
 * adjusted to €…", "Expense logged" — when nothing was written (no binding,
 * a swallowed throw, or a handler that only opens a screen). The insight card
 * then retired itself and the learning log counted it as executed;
 * adjust_quote without an id routed to /quotes/undefined.
 */
import { executeAction, registerExecutorBindings } from '../actionExecutor';

const run = (type: string, params: Record<string, any> = {}) =>
  executeAction({ type, params, label: type, requiresApproval: false } as any, 'ins-1', 'gen-1');

describe('without a write, nothing claims success — it opens the place to do it', () => {
  it.each([
    ['create_invoice', { jobId: 'job-1' }, '/contractor/job/job-1'],
    ['order_materials', { materialName: 'Koperbuis' }, '/contractor/purchase-orders'],
    ['schedule_job', { jobId: 'job-1' }, '/contractor/schedule'],
    ['adjust_quote', { suggestedPrice: 500 }, '/(contractor)/facturen'],
    ['renew_cert', {}, '/(contractor)/certificaten'],
    ['log_expense', { amount: 40 }, '/contractor/expenses'],
    ['switch_supplier', {}, '/contractor/inkoop'],
  ])('%s', async (type, params, route) => {
    const r = await run(type, params);
    expect(r.success).toBe(false);
    expect(r.data?.route).toBe(route);
    expect(String(r.data?.route)).not.toMatch(/undefined/);
  });
});

describe('with the write, success; a throwing write is not success', () => {
  it('adjust_quote succeeds only when the price was written', async () => {
    registerExecutorBindings({ updateQuoteAmount: async () => {} });
    expect((await run('adjust_quote', { quoteId: 'Q-1', suggestedPrice: 500 })).success).toBe(true);
    registerExecutorBindings({ updateQuoteAmount: async () => { throw new Error('offline'); } });
    expect((await run('adjust_quote', { quoteId: 'Q-1', suggestedPrice: 500 })).success).toBe(false);
  });

  it('order_materials succeeds only with a purchase order id', async () => {
    registerExecutorBindings({ createPurchaseOrder: async () => 'po-9' });
    const ok = await run('order_materials', { materialName: 'Koperbuis' });
    expect(ok.success).toBe(true);
    expect(ok.data?.route).toBe('/contractor/purchase-order/po-9');
    registerExecutorBindings({ createPurchaseOrder: async () => null });
    expect((await run('order_materials', { materialName: 'Koperbuis' })).success).toBe(false);
  });
});
