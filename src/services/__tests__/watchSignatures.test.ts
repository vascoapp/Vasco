/**
 * @jest-environment node
 *
 * R66r57: watchSignatures realtime watcher fires sendInstantNotification
 * on every signatures.INSERT scoped to the current contractor.
 */

const channelState: {
  filter?: Record<string, unknown>;
  callback?: (payload: unknown) => void;
  subscribed?: boolean;
} = {};

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    channel: jest.fn(() => {
      const chain: any = {
        on: jest.fn((_event: string, opts: Record<string, unknown>, cb: (p: unknown) => void) => {
          channelState.filter = opts;
          channelState.callback = cb;
          return chain;
        }),
        subscribe: jest.fn(() => {
          channelState.subscribed = true;
          return chain;
        }),
      };
      return chain;
    }),
    removeChannel: jest.fn(() => {
      channelState.subscribed = false;
    }),
  },
}));

const mockSendInstant: jest.Mock = jest.fn(async () => undefined);
jest.mock('../pushNotificationService', () => ({
  sendInstantNotification: (title: string, body: string, data?: Record<string, string>) =>
    mockSendInstant(title, body, data),
}));

jest.mock('../../i18n/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, fallback?: string | Record<string, unknown>, interp?: Record<string, unknown>) => {
      const variables = typeof fallback === 'object' ? fallback : (interp ?? {});
      const base = typeof fallback === 'string' ? fallback : key;
      // basic {{name}} interpolation
      return Object.entries(variables).reduce<string>(
        (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
        base,
      );
    },
  },
}));

import { watchSignatures, stopSignaturesWatch } from '../invoicePaymentWatcher';

beforeEach(() => {
  channelState.filter = undefined;
  channelState.callback = undefined;
  channelState.subscribed = false;
  mockSendInstant.mockClear();
});

describe('watchSignatures', () => {
  test('subscribes filtered by contractor_user_id', () => {
    const stop = watchSignatures('user-abc');
    expect(channelState.subscribed).toBe(true);
    expect(channelState.filter).toMatchObject({
      event: 'INSERT',
      schema: 'public',
      table: 'signatures',
      filter: 'contractor_user_id=eq.user-abc',
    });
    stop();
    expect(channelState.subscribed).toBe(false);
  });

  test('INSERT payload triggers sendInstantNotification with title/body + data', () => {
    watchSignatures('user-abc');
    expect(channelState.callback).toBeDefined();
    channelState.callback?.({
      new: {
        id: 'sig-1',
        signer_name: 'Marie Dubois',
        signer_role: 'customer',
        job_id: 'job-xyz',
      },
    });
    expect(mockSendInstant).toHaveBeenCalledTimes(1);
    const [title, body, data] = mockSendInstant.mock.calls[0];
    expect(title).toBe('Customer signed');
    expect(body).toContain('Marie Dubois');
    expect(data).toMatchObject({
      type: 'signature',
      signatureId: 'sig-1',
      jobId: 'job-xyz',
    });
  });

  test('omits jobId when row has no job_id (orphan tempId case)', () => {
    watchSignatures('user-abc');
    channelState.callback?.({
      new: {
        id: 'sig-2',
        signer_name: 'Customer',
        signer_role: 'customer',
        job_id: null,
      },
    });
    const [, , data] = mockSendInstant.mock.calls[0];
    expect(data).not.toHaveProperty('jobId');
    expect(data).toMatchObject({ type: 'signature', signatureId: 'sig-2' });
  });

  test('falls back to generic name when signer_name missing', () => {
    watchSignatures('user-abc');
    channelState.callback?.({
      new: { id: 'sig-3', signer_name: '', signer_role: 'customer', job_id: null },
    });
    const [, body] = mockSendInstant.mock.calls[0];
    expect(body).toContain('A customer');
  });

  test('onInsert callback fires alongside the notification', () => {
    const onInsert = jest.fn();
    watchSignatures('user-abc', onInsert);
    channelState.callback?.({
      new: { id: 'sig-4', signer_name: 'Jan', signer_role: 'site_lead', job_id: 'job-1' },
    });
    expect(onInsert).toHaveBeenCalledWith({
      signatureId: 'sig-4',
      signerName: 'Jan',
      signerRole: 'site_lead',
      jobId: 'job-1',
    });
  });

  test('stopSignaturesWatch is idempotent', () => {
    watchSignatures('user-abc');
    stopSignaturesWatch();
    stopSignaturesWatch(); // should not throw
    expect(channelState.subscribed).toBe(false);
  });
});
