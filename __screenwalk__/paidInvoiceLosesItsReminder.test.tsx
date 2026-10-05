/**
 * An invoice that ARRIVES paid — a Mollie webhook marked it on the server and
 * the app sees it on refresh/hydrate, never passing markInvoicePaid — loses its
 * "due today" reminder too (review 2026-10-04: the AppState effect was the one
 * path no test covered). Open invoices are never passed as paid.
 *
 * ONE test per file.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';

const mockReconcile = jest.fn(async (_inv: Array<{ id: string; status?: string }>) => 0);
jest.mock('../src/services/pushNotificationService', () => ({
  ...jest.requireActual('../src/services/pushNotificationService'),
  cancelRemindersForPaidInvoices: (inv: any) => mockReconcile(inv),
}));

import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { useAppState } from '../src/state/AppState';

function Probe() { useAppState(); return null; }
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('a paid invoice seen on load', () => {
  it('has its reminder cancelled; an open one does not', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-p', name: 'Familie Betaald' }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-P-1', customerId: 'c-p', customer: 'Familie Betaald', job: 'Onderhoud', amount: 121, status: 'paid', paidAt: new Date().toISOString() },
      { id: 'RE-P-2', customerId: 'c-p', customer: 'Familie Betaald', job: 'Onderhoud', amount: 242, status: 'sent' },
    ]));
    const r = await walkScreen(Probe, { settlePasses: 12 });
    expect(r.error).toBeNull();
    await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
    const ids = mockReconcile.mock.calls.flatMap((c) => c[0].map((i) => i.id));
    expect(ids).toContain('RE-P-1');
    expect(ids).not.toContain('RE-P-2');
    teardown(r);
  });
});
