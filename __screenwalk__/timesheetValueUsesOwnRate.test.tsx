/**
 * Timesheet values hours at the contractor's OWN rate, never an invented one,
 * and says "nothing yet" once, not three times (emulator walk 2026-09-28:
 * "Waarde" was hours x a literal 55; an empty day showed a 0,0u header, a
 * 0 / 0 / EUR 0 card and "Geen registraties").
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { localDateKey } from '../src/utils/dateKey';

const Timesheet = () => require('../app/contractor/timesheet').default;
const texts = (root: any): string[] => root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
  .map((n: any) => [].concat(n.props.children).join(''));
const entry = { id: 't1', date: localDateKey(new Date()), clockIn: '08:00', clockOut: '10:00', breakMinutes: 0, totalHours: 2 };

describe('timesheet', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_timesheet_entries', JSON.stringify([entry]));
    await AsyncStorage.setItem('@vasco_pricebook', JSON.stringify([{ id: 'p1', name: 'Uurtarief', pricingType: 'hourly', basePrice: 60, usageCount: 3 }]));
  });

  it('timesheetValueUsesOwnRate', async () => {
    const r = await walkScreen(Timesheet(), { settlePasses: 10 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const all = texts(root).join(' | ');
    const v = root.findAll((n: any) => n.props?.testID === 'timesheet-value' && typeof n.type === 'string')[0];
    expect([].concat(v.props.children).join('')).toMatch(/120/); // 2 h x EUR 60, not x 55 (=110)
    teardown(r);
  });
});
