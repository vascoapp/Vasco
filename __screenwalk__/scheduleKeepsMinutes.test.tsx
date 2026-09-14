/**
 * The day planner shows a job at the time it is booked, minutes included.
 *
 * 2026-09-14, German device: an 08:30–10:30 job read "8:00 – 10:00" in the
 * Tagesplan (parseInt kept only the hour) beside "08:30 – 10:30" on Aufträge,
 * the calendar export wrote 08:00, and the utilisation line read
 * "7.5 Std. / 10 Std." with an English decimal point.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { todayKey } from '../src/utils/dateKey';

const Schedule = () => require('../app/contractor/schedule').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('schedule keeps minutes', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('renders 08:30 – 10:30 and no decimal hours', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. de Vries' }]));
    await AsyncStorage.setItem('@vasco_jobs', JSON.stringify([
      {
        id: 'j-830', title: 'Cv-ketel onderhoud', status: 'scheduled', customerId: 'c1',
        scheduledDate: todayKey(), scheduledStartTime: '08:30', scheduledEndTime: '10:30',
        estimatedDuration: 2, photos: [], notes: [], timeEntries: [], materials: [],
      },
      {
        id: 'j-1100', title: 'Badkamer', status: 'scheduled', customerId: 'c1',
        scheduledDate: todayKey(), scheduledStartTime: '11:00', scheduledEndTime: '16:30',
        estimatedDuration: 5.5, photos: [], notes: [], timeEntries: [], materials: [],
      },
    ]));

    const r = await walkScreen(Schedule(), { settlePasses: 14 });
    expect(r.error).toBeNull();
    // Start, dash and end are separate Text nodes — join with a space.
    const all = r.texts.join(' ');

    expect(all).toContain('Cv-ketel onderhoud');
    expect(all).toMatch(/08:30\s*–\s*10:30/);
    expect(all).not.toMatch(/\b8:00\s*–\s*10:00/);
    expect(all).toMatch(/11:00\s*–\s*16:30/);
    // 7.5 booked hours must never print as "7.5".
    expect(all).not.toMatch(/\b\d+\.\d+\s*(u|h|Std)/);
    teardown(r);
  });
});
