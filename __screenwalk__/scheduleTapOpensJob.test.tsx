/**
 * Planning: tapping a job block opens the job.
 *
 * It raised an Alert repeating the title, customer and time already printed
 * on the block ("Houd ingedrukt om te verwijderen"), while its hint promised
 * "Tap for details" (emulator walk 2026-09-28). Long-press still removes it
 * from the day.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const Schedule = () => require('../app/contractor/schedule').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('schedule block', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('opens the job, raises no alert', async () => {
    const r = await walkScreen(Schedule(), { settlePasses: 14 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const blocks = root.findAll((n: any) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('schedule-block-') && typeof n.props?.onPress === 'function', { deep: true });
    expect(blocks.length).toBeGreaterThan(0); // the demo day has scheduled jobs
    const b = blocks[0];
    const id = b.props.testID.slice('schedule-block-'.length);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();
    await act(async () => { b.props.onPress(); });
    expect(nav.push).toHaveBeenCalledWith(`/contractor/job/${id}`);
    expect(alert).not.toHaveBeenCalled();
    expect(typeof b.props.onLongPress).toBe('function'); // remove stays on long-press
    alert.mockRestore();
    teardown(r);
  });
});
