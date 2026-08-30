/**
 * The background scheduler's tick persists its cadence state as the LAST
 * statement inside one big `try { … } catch {}`.
 *
 * That makes an unguarded job failure much worse than a lost job: the state
 * write is skipped, so the timestamps set EARLIER in the same tick are lost
 * too, every later block is skipped, and the outer catch swallows it. The next
 * tick then repeats exactly the same failing work. The scheduler wedges, and
 * nothing anywhere says so.
 *
 * `evaluateTriggers` was already `.catch(() => {})`-guarded. `populateQueue`
 * and `generateMorningBriefing` were not.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const mockPopulateQueue = jest.fn(async () => undefined);
jest.mock('../../services/aiActionQueueService', () => ({
  populateQueue: (...a: any[]) => (mockPopulateQueue as any)(...a),
  addToQueue: jest.fn(async () => undefined),
}));

jest.mock('../../services/workflowPackService', () => ({
  evaluateTriggers: jest.fn(async () => undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundJobScheduler, stopBackgroundJobScheduler } from '../backgroundJobScheduler';

const ctx = () => ({ invoices: [], quotes: [], jobs: [], customers: [], country: 'NL' });
// The tick awaits several dynamic import()s, so microtask flushing is not
// enough — it needs real macrotask turns to settle.
const flush = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };

describe('a failing scheduled job must not wedge the scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stopBackgroundJobScheduler();
    mockPopulateQueue.mockImplementation(async () => undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });
  afterEach(() => stopBackgroundJobScheduler());

  it('persists cadence state on a clean tick', async () => {
    startBackgroundJobScheduler(ctx);
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('STILL persists cadence state when populateQueue throws', async () => {
    mockPopulateQueue.mockImplementation(async () => { throw new Error('boom'); });
    startBackgroundJobScheduler(ctx);
    await flush();
    // Without a guard the state write is skipped entirely and the tick is
    // replayed forever — including the hourly audit that already succeeded.
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('records the hourly run even when a later block fails', async () => {
    mockPopulateQueue.mockImplementation(async () => { throw new Error('boom'); });
    startBackgroundJobScheduler(ctx);
    await flush();
    const write = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1);
    expect(write).toBeTruthy();
    const saved = JSON.parse(write![1]);
    expect(saved.lastHourlyRun).toBeTruthy();
  });
});
