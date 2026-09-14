/**
 * A lead's "Create quote" opens the quote builder for that job.
 *
 * 2026-09-14, German device: "Angebot erstellen" on a lead asked
 * "Status auf „Angebot" ändern?" and, on confirm, changed the job's status —
 * no quote was created, while the job now claimed one existed. The invoicing
 * step beside it had been fixed for exactly this; the quote step had not.
 * The job becomes "quoted" only when tiered-quote.tsx saves a quote.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const JobDetail = () => require('../app/contractor/job/[id]').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('lead → quote', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('pushes the quote builder with the job and its customer, and asks nothing', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. de Vries' }]));
    await AsyncStorage.setItem('@vasco_jobs', JSON.stringify([{
      id: 'j-lead-1', title: 'Cv-ketel controleren', status: 'lead', customerId: 'c1',
      estimatedDuration: 2, photos: [], notes: [], timeEntries: [], materials: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }]));

    const r = await walkScreen(JobDetail(), { settlePasses: 14, params: { id: 'j-lead-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;

    const cta = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function' && n.props?.accessibilityLabel === 'Offerte maken',
      { deep: true },
    );
    expect(cta.length).toBeGreaterThan(0);

    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert');
    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();
    await act(async () => { cta[0].props.onPress(); });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(nav.push).toHaveBeenCalledTimes(1);
    const target = String(nav.push.mock.calls[0][0]);
    expect(target).toMatch(/^\/contractor\/tiered-quote\?/);
    expect(target).toContain('jobId=j-lead-1');
    expect(target).toContain('customerId=c1');
    alertSpy.mockRestore();
    teardown(r);
  });
});
