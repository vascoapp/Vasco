// Job-quality feedback survives no network: it is queued and sent on
// reconnect, instead of "Opslaan mislukt" dropping what the contractor typed
// (emulator walk 2026-09-29). A real rejection (it carries a code) stays one.
const mockUpsert = jest.fn();
const mockQueue = jest.fn(async () => undefined);
jest.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: () => ({ upsert: mockUpsert }) } }));
jest.mock('../../lib/currentUser', () => ({ ...jest.requireActual('../../lib/currentUser'), getAuthedUserId: () => 'u1' }));
jest.mock('../offlineWriteQueue', () => ({
  ...jest.requireActual('../offlineWriteQueue'),
  queueWrite: (...a: any[]) => (mockQueue as any)(...a),
}));

import { upsertJobQualitySignal } from '../intelligenceCaptureService';

const input = { jobId: '6f1c1e0e-0000-4000-8000-000000000001', customerReviewScore: 5, customerReviewText: 'Top', paidOnTime: true };

beforeEach(() => { mockUpsert.mockReset(); mockQueue.mockClear(); });

it('no network: queued with the SAME payload, reported as saved-offline', async () => {
  mockUpsert.mockResolvedValue({ error: { message: 'TypeError: Network request failed' } });
  const res = await upsertJobQualitySignal(input);
  expect(res).toEqual({ ok: true, queued: true });
  expect(mockQueue).toHaveBeenCalledTimes(1);
  const q = (mockQueue.mock.calls[0] as any)[0];
  expect(q).toMatchObject({ table: 'job_quality_signals', op: 'upsert' });
  expect(q.payload).toEqual(mockUpsert.mock.calls[0][0]);
  expect(q.payload).toMatchObject({ job_id: input.jobId, customer_review_score: 5, customer_review_text: 'Top', paid_on_time: true });
});

it('a thrown fetch is the network too', async () => {
  mockUpsert.mockRejectedValue(new Error('Failed to fetch'));
  expect(await upsertJobQualitySignal(input)).toEqual({ ok: true, queued: true });
});

it('a rejection is an error, not queued', async () => {
  mockUpsert.mockResolvedValue({ error: { code: '23503', message: 'violates foreign key constraint' } });
  const res = await upsertJobQualitySignal(input);
  expect(res.ok).toBe(false);
  expect(mockQueue).not.toHaveBeenCalled();
});

it('online success is plain ok', async () => {
  mockUpsert.mockResolvedValue({ error: null });
  expect(await upsertJobQualitySignal(input)).toEqual({ ok: true });
});
