/**
 * The quote→invoice screen states the term the new invoice will carry.
 *
 * Its subtitle read "14 dagen betaaltermijn" for every contractor, while the
 * invoice it creates is due on the contractor's own default terms
 * (AppState.dueDateOnTerms). A contractor on 30 days was told 14.
 *
 * ONE test per file.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const Screen = () => require('../app/quotes/[id]/invoice').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('quote → invoice', () => {
  it('says the contractor\'s 30-day term, not 14', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ businessName: 'Termijn BV', country: 'NL', language: 'nl', defaultPaymentTerms: 30 }));
    await AsyncStorage.setItem('@vasco_quotes', JSON.stringify([
      { id: 'Q-T-9', customer: 'c1', customerId: 'c1', job: 'Onderhoud', amount: 1000, status: 'accepted', lastUpdated: new Date().toISOString() },
    ]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Familie Termijn' }]));

    const r = await walkScreen(Screen(), { settlePasses: 14, params: { id: 'Q-T-9' } });
    expect(r.error).toBeNull();
    const all = r.texts.join(' | ');
    expect(all).toMatch(/30 DAGEN TERMIJN/);
    expect(all).not.toMatch(/14 DAGEN/);
    teardown(r);
  });
});
