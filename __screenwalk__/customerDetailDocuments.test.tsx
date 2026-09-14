/**
 * The customer screen lists the invoices and quotes that point at the customer
 * by foreign key.
 *
 * It matched `doc.customer === id || doc.customer === name` — a local lookup
 * beside `findDocumentCustomer` (#214) — so a document carrying only
 * `customerId` was missing from its own customer's history. Tapping a customer
 * on the Klanten tab now lands here instead of on global search, which made
 * this list the one a contractor reads.
 *
 * ONE test per file — the harness keeps a module-scoped AppState (see
 * flowTemplateApply.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const CustomerDetail = () => require('../app/contractor/customer/[id]').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('customer detail documents', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('lists an invoice that names the customer only by customerId', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c1', name: 'Bakkerij Smit', email: 'info@bakkerijsmit.nl' },
      { id: 'c2', name: 'Familie de Vries', email: 'devries@example.nl' },
    ]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'F-2026-0042', customerId: 'c1', customer: null, amount: 1210, status: 'sent', date: '2026-09-01', dueDate: '2026-09-15' },
      { id: 'F-2026-0043', customerId: 'c2', customer: null, amount: 500, status: 'sent', date: '2026-09-01', dueDate: '2026-09-15' },
    ]));

    const r = await walkScreen(CustomerDetail(), { settlePasses: 14, params: { id: 'c1' } });
    expect(r.error).toBeNull();
    const text = r.texts.join(' | ');
    expect(text).toContain('F-2026-0042');
    expect(text).not.toContain('F-2026-0043');   // another customer's invoice
    teardown(r);
  });
});
