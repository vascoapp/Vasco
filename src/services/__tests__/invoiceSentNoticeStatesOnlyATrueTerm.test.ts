/**
 * The customer's "invoice is on its way" message states a payment term only
 * when one is known and still ahead.
 *
 * It fell back to a flat "14 days", and a draft sent after its due date was
 * told a term the PDF beside it contradicts (2026-10-04). "1 dagen" needs the
 * singular (CLAUDE.md: copy with a count needs `_one`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../i18n/i18n';
import { queueInvoiceSentNotice } from '../aiActionQueueService';

async function noticeText(dueInDays: number | undefined): Promise<string> {
  await AsyncStorage.clear();
  await queueInvoiceSentNotice({ invoiceId: 'RE-9', customerName: 'Familie Jansen', amount: 121, dueInDays });
  const q = JSON.parse((await AsyncStorage.getItem('@vasco_ai_queue')) ?? '[]');
  return q[0]?.preparedData?.template ?? '';
}

beforeAll(async () => { await i18n.changeLanguage('nl'); });

it('states the days still to go, singular included', async () => {
  expect(await noticeText(28)).toMatch(/Betaaltermijn: 28 dagen/);
  expect(await noticeText(1)).toMatch(/Betaaltermijn: 1 dag\b/);
});

it('names no term for a due date already past or unknown — never a flat 14', async () => {
  for (const d of [0, -3, undefined]) {
    const text = await noticeText(d);
    expect(text).toMatch(/is onderweg/);
    expect(text).not.toMatch(/Betaaltermijn|14/);
  }
});
