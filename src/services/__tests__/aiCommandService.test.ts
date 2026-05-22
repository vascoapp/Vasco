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

  // R95 — 4 new intents.

  it('parses "cancel job for {name}" into cancel_job', async () => {
    const resp = await sendAiCommand('cancel job for Anna');
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('cancel_job');
    expect(resp.result.action?.params.customerName).toBe('anna');
  });

  it('parses status queries into query_job_status with active-jobs list', async () => {
    const resp = await sendAiCommand('status of active jobs', {
      activeJobs: [
        { id: 'j1', customer: 'Alice', status: 'in-progress' },
        { id: 'j2', customer: 'Bob', status: 'scheduled' },
      ],
    });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('query_job_status');
    expect(resp.result.humanResponse).toContain('Alice');
    expect(resp.result.humanResponse).toContain('Bob');
    expect(resp.result.humanResponse).toContain('2');
  });

  it('returns "no active jobs" when activeJobs is empty', async () => {
    const resp = await sendAiCommand('status update', { activeJobs: [] });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('query_job_status');
    expect(resp.result.humanResponse.toLowerCase()).toContain('no active');
  });

  it('parses "find {name}" into find_customer with matches', async () => {
    const resp = await sendAiCommand('find Alice', {
      customers: [
        { id: 'c1', name: 'Alice Johnson' },
        { id: 'c2', name: 'Bob Smith' },
        { id: 'c3', name: 'Alice Roberts' },
      ],
    });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('find_customer');
    expect(resp.result.action?.params.query).toBe('Alice');
    expect(resp.result.humanResponse).toContain('Alice Johnson');
    expect(resp.result.humanResponse).toContain('Alice Roberts');
    expect(resp.result.humanResponse).not.toContain('Bob');
  });

  it('returns "no match" when find_customer has no hits', async () => {
    const resp = await sendAiCommand('lookup Carol', {
      customers: [{ id: 'c1', name: 'Alice' }],
    });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('find_customer');
    expect(resp.result.humanResponse.toLowerCase()).toContain('no customer');
  });

  it('parses weekly summary asks into weekly_summary intent', async () => {
    const resp = await sendAiCommand('how was my week', {
      weeklyRevenue: 3200,
      weeklyJobsCompleted: 4,
      weeklyQuotesSent: 7,
    });
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('weekly_summary');
    expect(resp.result.humanResponse).toContain('3,200');
    expect(resp.result.humanResponse).toContain('4');
    expect(resp.result.humanResponse).toContain('7');
  });

  it('handles "recap" with zeros when no context', async () => {
    const resp = await sendAiCommand('recap');
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    expect(resp.result.intent).toBe('weekly_summary');
    expect(resp.result.humanResponse).toContain('0');
  });
});
