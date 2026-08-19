// R98 — lock the AI-bot → destination-screen routing contract.
// Destination screens read query params (e.g. customer-crm reads `q`),
// so the param NAMES are a contract. A rename without updating both
// sides would silently regress the AI prefill flow.

import { routeForIntent, buildQueryString } from '../aiCommandRouter';
import type { AiCommandResult } from '../aiCommandService';

function make(intent: AiCommandResult['intent'], action?: AiCommandResult['action']): AiCommandResult {
  return { intent, humanResponse: 'stub', action };
}

describe('buildQueryString', () => {
  it('drops undefined / null / empty values', () => {
    const qs = buildQueryString({ a: 1, b: undefined, c: null, d: '', e: 'ok' });
    expect(qs).toBe('?a=1&e=ok');
  });

  it('returns empty string when all values are skipped', () => {
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString({ a: undefined })).toBe('');
  });

  it('URL-encodes spaces + special chars', () => {
    expect(buildQueryString({ name: 'Alice Smith' })).toBe('?name=Alice%20Smith');
    expect(buildQueryString({ q: 'A&B=C' })).toBe('?q=A%26B%3DC');
  });

  it('coerces non-string values via String()', () => {
    expect(buildQueryString({ amount: 1280.5, n: 0, b: false })).toBe('?amount=1280.5&n=0&b=false');
  });
});

describe('routeForIntent', () => {
  it('routes find_customer with q= search seed', () => {
    const r = routeForIntent(make('find_customer', { type: 'find_customer', params: { query: 'Alice' } }));
    expect(r?.path).toBe('/contractor/customer-crm?q=Alice');
  });

  it('omits q= when find_customer has no query (defensive against bad LLM output)', () => {
    const r = routeForIntent(make('find_customer', { type: 'find_customer', params: {} }));
    expect(r?.path).toBe('/contractor/customer-crm');
  });

  it('routes create_invoice with aiCustomer + aiAmount + aiIntent', () => {
    const r = routeForIntent(make('create_invoice', {
      type: 'create_invoice',
      params: { customerName: 'John', amount: 500, currency: 'USD' },
    }));
    expect(r?.path).toContain('/(contractor)/geld');
    expect(r?.path).toContain('aiCustomer=John');
    expect(r?.path).toContain('aiAmount=500');
    expect(r?.path).toContain('aiIntent=create_invoice');
  });

  it('routes schedule_job with aiCustomer + aiDate + aiTime', () => {
    const r = routeForIntent(make('schedule_job', {
      type: 'schedule_job',
      params: { customerName: 'Sarah', date: '2026-06-01', time: '09:00', title: 'AC repair' },
    }));
    expect(r?.path).toContain('/contractor/schedule');
    expect(r?.path).toContain('aiCustomer=Sarah');
    expect(r?.path).toContain('aiDate=2026-06-01');
    expect(r?.path).toContain('aiTime=09%3A00');
    expect(r?.path).toContain('aiTitle=AC%20repair');
  });

  it('routes send_reminder with aiIntent=send_reminder', () => {
    const r = routeForIntent(make('send_reminder', {
      type: 'send_reminder',
      params: { customerName: 'Mike' },
    }));
    expect(r?.path).toContain('/(contractor)/geld');
    expect(r?.path).toContain('aiIntent=send_reminder');
    expect(r?.path).toContain('aiCustomer=Mike');
  });

  it('routes cancel_job under the werk tab', () => {
    const r = routeForIntent(make('cancel_job', {
      type: 'cancel_job',
      params: { customerName: 'Anna' },
    }));
    expect(r?.path).toContain('/(contractor)/werk');
    expect(r?.path).toContain('aiIntent=cancel_job');
  });

  it('list_overdue + query_job_status carry aiIntent without customer', () => {
    expect(routeForIntent(make('list_overdue'))?.path).toBe('/(contractor)/geld?aiIntent=list_overdue');
    expect(routeForIntent(make('query_job_status'))?.path).toBe('/(contractor)/werk?aiIntent=query_job_status');
  });

  it('query_revenue + weekly_summary route to savings hub without params', () => {
    // Neither may point into app/hub/** — that is the enterprise portfolio
    // surface, gated off by `enterprise_portfolio: false`, so a contractor
    // sent there lands on a screen nobody maintains.
    expect(routeForIntent(make('query_revenue'))?.path).toBe('/(contractor)/geld');
    expect(routeForIntent(make('weekly_summary'))?.path).toBe('/contractor/reports');
  });

  it('returns undefined for unknown intent', () => {
    expect(routeForIntent(make('unknown'))).toBeUndefined();
  });

  it('handles missing action gracefully — never throws on bad LLM output', () => {
    // LLM stub returned no action object at all — route should still
    // resolve to a sensible destination instead of crashing.
    expect(() => routeForIntent(make('find_customer'))).not.toThrow();
    expect(() => routeForIntent(make('create_invoice'))).not.toThrow();
  });
});
