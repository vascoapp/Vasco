// Mock supabase before importing the service so isSupabaseConfigured
// is false (forces the demo-mode stub path that we want to test).
jest.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
  isSupabaseConfigured: false,
}));

import { sendAiCommand } from '../aiCommandService';

describe('aiCommandService demo-mode stub', () => {
  it('parses "invoice {name} for {amount}" into create_invoice intent', async () => {
    const resp = await sendAiCommand('invoice John for $500');
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('create_invoice');
    expect(resp.result.action?.type).toBe('create_invoice');
    expect(resp.result.action?.params.customerName).toBe('john');
    expect(resp.result.action?.params.amount).toBe(500);
    expect(resp.result.humanResponse).toContain('500');
  });

  it('parses "what did I make last month" into query_revenue', async () => {
    const resp = await sendAiCommand('what did I make last month', { recentInvoiceTotal: 4280 });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('query_revenue');
    expect(resp.result.humanResponse).toContain('4,280');
  });

  it('returns "no revenue activity" when total is 0', async () => {
    const resp = await sendAiCommand('revenue', { recentInvoiceTotal: 0 });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('query_revenue');
    expect(resp.result.humanResponse.toLowerCase()).toContain('no invoice activity');
  });

  it('parses "show overdue" into list_overdue', async () => {
    const resp = await sendAiCommand('show overdue', { overdueCount: 3 });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('list_overdue');
    expect(resp.result.humanResponse).toContain('3');
  });

  it('returns "no overdue" when overdueCount is 0', async () => {
    const resp = await sendAiCommand('who hasn\'t paid', { overdueCount: 0 });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('list_overdue');
    expect(resp.result.humanResponse.toLowerCase()).toContain('no overdue');
  });

  it('parses "schedule {name}" into schedule_job', async () => {
    const resp = await sendAiCommand('schedule Sarah for Friday');
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('schedule_job');
    expect(resp.result.action?.params.customerName).toBe('sarah');
  });

  it('parses "remind {name}" into send_reminder', async () => {
    const resp = await sendAiCommand('remind Mike to pay');
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('send_reminder');
    expect(resp.result.action?.params.customerName).toBe('mike');
  });

  it('falls back to unknown intent for nonsense input', async () => {
    const resp = await sendAiCommand('hello there general kenobi');
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('unknown');
    expect(resp.result.humanResponse).toContain('invoice');
  });
});
