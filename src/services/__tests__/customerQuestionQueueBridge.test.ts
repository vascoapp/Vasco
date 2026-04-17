/**
 * @jest-environment node
 */

const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-abc',
}));

import {
  fetchPendingCustomerQuestions,
  approveCustomerQuestionReply,
  rejectCustomerQuestionReply,
  questionIdFromQueueItemId,
} from '../customerQuestionQueueBridge';

describe('questionIdFromQueueItemId', () => {
  it('strips cq: prefix', () => {
    expect(questionIdFromQueueItemId('cq:abc-123')).toBe('abc-123');
  });
  it('returns null for non-cq ids', () => {
    expect(questionIdFromQueueItemId('q-someting')).toBeNull();
  });
});

// Helpers for building the Supabase query-builder chain used by the bridge.
function buildSelectChain(data: any[] | null, error: any = null) {
  // Actual query: select → eq(contractor_user_id) → in(status) → is(approved_reply) → order → limit
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        in: jest.fn(() => ({
          is: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(async () => ({ data, error })),
            })),
          })),
        })),
      })),
    })),
  };
}

function buildUpdateChain(error: any = null) {
  return {
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(async () => ({ error })),
      })),
    })),
  };
}

describe('fetchPendingCustomerQuestions', () => {
  afterEach(() => mockFrom.mockReset());

  it('maps rows to QueueItem with cq: prefix + question grounding', async () => {
    mockFrom.mockImplementationOnce(() =>
      buildSelectChain([
        {
          id: 'q-1',
          question: 'Can you come earlier?',
          question_lang: 'nl',
          ai_reply_draft: 'I can move to Thursday 10am — does that work?',
          ai_reply_confidence: 0.82,
          ai_reply_reason: 'Schedule-adjacent ask; low commitment risk.',
          tracker_access_token: 'tok_xyz',
          created_at: '2026-04-17T09:00:00Z',
          status: 'drafted',
        },
      ]),
    );
    const items = await fetchPendingCustomerQuestions();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('cq:q-1');
    expect(items[0].type).toBe('customer_question');
    expect(items[0].entityKey).toBe('cq:q-1');
    expect(items[0].preparedData.questionId).toBe('q-1');
    expect(items[0].preparedData.draftReply).toMatch(/Thursday 10am/);
    expect(items[0].preparedData.trackerAccessToken).toBe('tok_xyz');
  });

  it('truncates long questions into the title snippet with ellipsis', async () => {
    const longQ = 'a'.repeat(100);
    mockFrom.mockImplementationOnce(() =>
      buildSelectChain([
        {
          id: 'q-long',
          question: longQ,
          question_lang: 'nl',
          ai_reply_draft: '',
          ai_reply_confidence: 0.5,
          ai_reply_reason: null,
          tracker_access_token: null,
          created_at: '2026-04-17T09:00:00Z',
          status: 'drafted',
        },
      ]),
    );
    const items = await fetchPendingCustomerQuestions();
    expect(items[0].title.length).toBeLessThanOrEqual(60);
    expect(items[0].title).toMatch(/…$/);
  });

  it('returns [] when Supabase returns an error', async () => {
    mockFrom.mockImplementationOnce(() => buildSelectChain(null, new Error('rpc failed')));
    const items = await fetchPendingCustomerQuestions();
    expect(items).toEqual([]);
  });
});

describe('approveCustomerQuestionReply', () => {
  afterEach(() => mockFrom.mockReset());

  it('writes approved_reply + approver + timestamp + status=approved', async () => {
    let capturedUpdate: any = null;
    mockFrom.mockImplementationOnce(() => ({
      update: (patch: any) => {
        capturedUpdate = patch;
        return { eq: jest.fn(() => ({ eq: jest.fn(async () => ({ error: null })) })) };
      },
    }));
    const ok = await approveCustomerQuestionReply('q-1', 'Sure, Thursday 10am works.');
    expect(ok).toBe(true);
    expect(capturedUpdate.approved_reply).toBe('Sure, Thursday 10am works.');
    expect(capturedUpdate.approved_by).toBe('user-abc');
    expect(capturedUpdate.status).toBe('approved');
    expect(capturedUpdate.approved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('refuses to write an empty reply', async () => {
    const ok = await approveCustomerQuestionReply('q-1', '   ');
    expect(ok).toBe(false);
  });

  it('returns false when DB update errors', async () => {
    mockFrom.mockImplementationOnce(() => buildUpdateChain(new Error('boom')));
    const ok = await approveCustomerQuestionReply('q-1', 'any text');
    expect(ok).toBe(false);
  });
});

describe('rejectCustomerQuestionReply', () => {
  afterEach(() => mockFrom.mockReset());

  it('sets status=declined', async () => {
    let capturedPatch: any = null;
    mockFrom.mockImplementationOnce(() => ({
      update: (patch: any) => {
        capturedPatch = patch;
        return { eq: jest.fn(() => ({ eq: jest.fn(async () => ({ error: null })) })) };
      },
    }));
    const ok = await rejectCustomerQuestionReply('q-1');
    expect(ok).toBe(true);
    expect(capturedPatch.status).toBe('declined');
  });
});
