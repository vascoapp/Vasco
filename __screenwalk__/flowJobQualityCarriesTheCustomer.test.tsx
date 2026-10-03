/**
 * Recursive-learning Loop 5, the WRITER half: the job-quality screen sends the
 * job's customer with the signal. get_customer_quality_weight averages the
 * signals BY customer; the screen never sent one, so customer_id was null on
 * every row and no score could ever weigh a training pair.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const mockUpsert = jest.fn(async (_input: any) => ({ ok: true }));
jest.mock('../src/services/intelligenceCaptureService', () => ({
  ...jest.requireActual('../src/services/intelligenceCaptureService'),
  upsertJobQualitySignal: (i: any) => mockUpsert(i),
}));

const Screen = () => require('../app/contractor/job-quality/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const SAVE = ((nl as any).jobQuality.save as string).toUpperCase();

run('job quality feedback', () => {
  it('is saved with the job\'s customer', async () => {
    const alerts = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-quality', name: 'Familie de Vries' }]));
    await AsyncStorage.setItem('@vasco_jobs', JSON.stringify([
      { id: 'job-quality-1', title: 'CV-ketel vervangen', customerId: 'c-quality', customer: 'Familie de Vries', status: 'completed' },
    ]));

    const r = await walkScreen(Screen(), { settlePasses: 14, params: { id: 'job-quality-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const btns = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === SAVE, { deep: true }).length > 0, { deep: true });
    expect(btns.length).toBeGreaterThan(0);
    await act(async () => { await btns[btns.length - 1].props.onPress(); });
    await settle();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ jobId: 'job-quality-1', customerId: 'c-quality' });
    teardown(r);
    alerts.mockRestore();
  });
});
