/**
 * @jest-environment node
 *
 * R66r62 — cross-device offline doc-number collision fix.
 *
 * Pre-r62: two offline devices both minted Q0008 from local AsyncStorage,
 * BE rejected one with 23505 on reconnect.
 * Post-r62: offline mint returns Q-OFF-XXXXXX; offlineWriteQueue swaps to
 * a canonical Q0008 via next_document_number RPC at flush time, emits on
 * docNumberRemapBus.
 */

import {
  emitDocNumberRemap,
  subscribeDocNumberRemap,
  __resetForTests,
  type DocNumberRemapEvent,
} from '../docNumberRemapBus';

beforeEach(() => {
  __resetForTests();
});

describe('docNumberRemapBus', () => {
  test('subscribers receive emitted events', () => {
    const received: DocNumberRemapEvent[] = [];
    subscribeDocNumberRemap((e) => received.push(e));
    emitDocNumberRemap({
      docType: 'quote',
      placeholderNumber: 'Q-OFF-A1B2C3',
      realNumber: 'Q0008',
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      docType: 'quote',
      placeholderNumber: 'Q-OFF-A1B2C3',
      realNumber: 'Q0008',
    });
  });

  test('unsubscribe stops delivery', () => {
    const received: DocNumberRemapEvent[] = [];
    const unsub = subscribeDocNumberRemap((e) => received.push(e));
    unsub();
    emitDocNumberRemap({
      docType: 'invoice',
      placeholderNumber: 'I-OFF-XYZ',
      realNumber: 'I0042',
    });
    expect(received).toHaveLength(0);
  });

  test('one bad listener does not break the others', () => {
    const received: DocNumberRemapEvent[] = [];
    subscribeDocNumberRemap(() => {
      throw new Error('boom');
    });
    subscribeDocNumberRemap((e) => received.push(e));
    emitDocNumberRemap({
      docType: 'quote',
      placeholderNumber: 'Q-OFF-XX',
      realNumber: 'Q0001',
    });
    expect(received).toHaveLength(1);
  });

  test('multiple subscribers all receive each event', () => {
    let count = 0;
    subscribeDocNumberRemap(() => { count += 1; });
    subscribeDocNumberRemap(() => { count += 1; });
    subscribeDocNumberRemap(() => { count += 1; });
    emitDocNumberRemap({
      docType: 'quote',
      placeholderNumber: 'Q-OFF-X',
      realNumber: 'Q0001',
    });
    expect(count).toBe(3);
  });
});

describe('isOfflineMintedDocNumber + nextDocumentNumber offline mint', () => {
  test('offline placeholder format is Q-OFF-{6 hex}', async () => {
    // Re-import in a fresh module context with isSupabaseConfigured=false
    jest.resetModules();
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: false,
      supabase: { rpc: jest.fn() },
    }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async () => undefined),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nextDocumentNumber, isOfflineMintedDocNumber } = require('../../lib/dataProvider');

    const num = await nextDocumentNumber('quote');
    expect(num).toMatch(/^Q-OFF-[0-9A-F]{6}$/);
    expect(isOfflineMintedDocNumber(num)).toBe(true);

    const inv = await nextDocumentNumber('invoice');
    expect(inv).toMatch(/^I-OFF-[0-9A-F]{6}$/);
    expect(isOfflineMintedDocNumber(inv)).toBe(true);
  });

  test('isOfflineMintedDocNumber rejects canonical numbers', () => {
    // Use the real module (Supabase still mocked false from previous test).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isOfflineMintedDocNumber } = require('../../lib/dataProvider');
    expect(isOfflineMintedDocNumber('Q0008')).toBe(false);
    expect(isOfflineMintedDocNumber('I0042')).toBe(false);
    expect(isOfflineMintedDocNumber('')).toBe(false);
    expect(isOfflineMintedDocNumber(undefined)).toBe(false);
  });
});
