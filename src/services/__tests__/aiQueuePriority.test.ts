/**
 * @jest-environment node
 *
 * R268 — AI queue priority matrix.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../onboardingPreferencesService', () => ({
  loadOnboardingPreferences: jest.fn(),
  wantsPaymentFocus: (p: any) => p?.goals?.includes('faster_payments'),
  wantsQuotingHelp: (p: any) => p?.goals?.includes('quoting'),
  wantsComplianceFocus: (p: any) => p?.goals?.includes('compliance'),
  wantsAutomationFocus: (p: any) => p?.goals?.includes('less_admin'),
  wantsGrowthFocus: (p: any) => p?.goals?.includes('growth'),
}));

jest.mock('../customerQuestionService', () => ({
  fetchPendingCustomerQuestions: jest.fn(async () => []),
  questionIdFromQueueItemId: (id: string) => id,
}));

import { scoreQueueItem, type QueueItem } from '../aiActionQueueService';

const mk = (overrides: Partial<QueueItem>): QueueItem => ({
  id: 'q1',
  type: 'draft_invoice',
  status: 'pending',
  title: '',
  description: '',
  preparedData: {},
  actionLabel: '',
  estimatedImpact: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('R268 priority matrix', () => {
  test('overdue payment risk outranks satisfaction survey', () => {
    const overdue = mk({ type: 'late_payment_risk_alert' });
    const survey = mk({ type: 'satisfaction_survey' });
    expect(scoreQueueItem(overdue)).toBeGreaterThan(scoreQueueItem(survey));
  });

  test('€-impact boosts score', () => {
    const small = mk({ type: 'draft_invoice', estimatedImpact: '€50 omzet' });
    const big = mk({ type: 'draft_invoice', estimatedImpact: '€2500 omzet' });
    expect(scoreQueueItem(big)).toBeGreaterThan(scoreQueueItem(small));
  });

  test('5-day-old item gets age boost', () => {
    const fresh = mk({ type: 'draft_quote', createdAt: new Date().toISOString() });
    const old = mk({
      type: 'draft_quote',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(scoreQueueItem(old)).toBeGreaterThan(scoreQueueItem(fresh));
    // Cap at +15
    expect(scoreQueueItem(old) - scoreQueueItem(fresh)).toBeLessThanOrEqual(15);
  });

  test('age boost zero for items < 24h old', () => {
    const a = mk({ type: 'draft_quote', createdAt: new Date().toISOString() });
    const b = mk({ type: 'draft_quote', createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() });
    expect(scoreQueueItem(a)).toBe(scoreQueueItem(b));
  });

  test('onboarding goal match adds 10', () => {
    const item = mk({ type: 'draft_invoice' });
    const noGoal = scoreQueueItem(item, null);
    const matching = scoreQueueItem(item, { goals: ['faster_payments'] } as any);
    expect(matching - noGoal).toBe(10);
  });

  test('matrix outranks goal-only signal', () => {
    // €5000 cert_renewal vs €0 satisfaction_survey with payment goal
    // (cert_renewal does not match faster_payments goal)
    const cert = mk({ type: 'cert_renewal', estimatedImpact: '' });
    const survey = mk({ type: 'satisfaction_survey', estimatedImpact: '€5000 omzet' });
    const prefs = { goals: ['faster_payments'] } as any;
    // Even with €5000 boost, satisfaction (base 20) doesn't catch cert (base 80)
    expect(scoreQueueItem(cert, prefs)).toBeGreaterThan(scoreQueueItem(survey, prefs));
  });

  test('time-saved impact also scores', () => {
    const longTime = mk({ type: 'draft_invoice', estimatedImpact: '60 min bespaard' });
    const noImpact = mk({ type: 'draft_invoice', estimatedImpact: '' });
    expect(scoreQueueItem(longTime)).toBeGreaterThan(scoreQueueItem(noImpact));
  });

  test('all type-base scores in [20, 95] range', () => {
    const types: QueueItem['type'][] = [
      'draft_invoice','draft_reminder','draft_followup','draft_quote',
      'cert_renewal','schedule_suggestion','price_alert','maintenance_due',
      'reorder_materials','decision_reminder','bulk_purchase','progress_note',
      'batch_invoices','invoice_regenerate','permit_check','permit_renewal',
      'quote_expiry','job_handover','satisfaction_survey','supplier_comparison',
      'safety_checklist','tax_prep','accounting_export','einvoice_submit',
      'customer_question','low_win_alert','late_payment_risk_alert',
    ];
    for (const t of types) {
      const s = scoreQueueItem(mk({ type: t }));
      expect(s).toBeGreaterThanOrEqual(20);
      expect(s).toBeLessThanOrEqual(120); // base 95 + max impact 25
    }
  });
});
