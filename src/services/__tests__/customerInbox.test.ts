/**
 * @jest-environment node
 *
 * R271 — customer inbox capture.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete store[k]; }),
      __store: store,
    },
  };
});

import {
  recordInboundMessage,
  getLatestInbound,
  getInboundForCustomer,
  deleteInboundMessage,
} from '../customerInboxService';

const AS = require('@react-native-async-storage/async-storage').default;

describe('customerInboxService (R271)', () => {
  beforeEach(() => {
    for (const k of Object.keys(AS.__store)) delete AS.__store[k];
  });

  test('records and retrieves latest', async () => {
    await recordInboundMessage('cust1', 'When can you come?', 'whatsapp');
    const latest = await getLatestInbound('cust1');
    expect(latest?.body).toBe('When can you come?');
    expect(latest?.channel).toBe('whatsapp');
  });

  test('newest message first', async () => {
    await recordInboundMessage('cust1', 'first', 'sms');
    await new Promise((r) => setTimeout(r, 5));
    await recordInboundMessage('cust1', 'second', 'sms');
    const list = await getInboundForCustomer('cust1');
    expect(list[0].body).toBe('second');
    expect(list[1].body).toBe('first');
  });

  test('caps at 20 per customer', async () => {
    for (let i = 0; i < 25; i++) {
      await recordInboundMessage('cust1', `msg-${i}`, 'sms');
    }
    const list = await getInboundForCustomer('cust1');
    expect(list).toHaveLength(20);
    expect(list[0].body).toBe('msg-24');
    expect(list[19].body).toBe('msg-5');
  });

  test('isolates customers', async () => {
    await recordInboundMessage('a', 'A msg', 'sms');
    await recordInboundMessage('b', 'B msg', 'email');
    const a = await getLatestInbound('a');
    const b = await getLatestInbound('b');
    expect(a?.body).toBe('A msg');
    expect(b?.body).toBe('B msg');
  });

  test('rejects empty body', async () => {
    const result = await recordInboundMessage('cust1', '   ', 'sms');
    expect(result).toBeNull();
  });

  test('trims whitespace', async () => {
    await recordInboundMessage('cust1', '  hello  ', 'sms');
    const latest = await getLatestInbound('cust1');
    expect(latest?.body).toBe('hello');
  });

  test('deleteInboundMessage removes by id', async () => {
    const m1 = await recordInboundMessage('cust1', 'one', 'sms');
    await recordInboundMessage('cust1', 'two', 'sms');
    await deleteInboundMessage(m1!.id);
    const list = await getInboundForCustomer('cust1');
    expect(list).toHaveLength(1);
    expect(list[0].body).toBe('two');
  });

  test('getLatestInbound returns null with no history', async () => {
    expect(await getLatestInbound('nope')).toBeNull();
  });
});
