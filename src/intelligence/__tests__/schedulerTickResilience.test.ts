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

// D2 (sweep 2026-09-23): the first tick fired on app open over the EMPTY
// pre-hydrate arrays and stamped its 2h/12h gates, so the queue blocks did not
// see the contractor's real data again for hours.
describe('the scheduler waits for hydrate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stopBackgroundJobScheduler();
    mockPopulateQueue.mockImplementation(async () => undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });
  afterEach(() => { stopBackgroundJobScheduler(); jest.useRealTimers(); });

  it('not hydrated: runs nothing and writes NO gate timestamps', async () => {
    startBackgroundJobScheduler(() => ({ ...ctx(), ready: false }));
    await flush();
    expect(mockPopulateQueue).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('@vasco_scheduler_state', expect.anything());
  });

  it('the 30-minute tick ALSO waits — a slow hydrate never stamps the gates', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    startBackgroundJobScheduler(() => ({ ...ctx(), ready: false }));
    await jest.advanceTimersByTimeAsync(31 * 60 * 1000);
    jest.useRealTimers();
    await flush();
    expect(mockPopulateQueue).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('@vasco_scheduler_state', expect.anything());
  });

  it('runs the first tick over the REAL data once hydrate lands', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    let ready = false;
    const jobs: any[] = [];
    startBackgroundJobScheduler(() => ({ ...ctx(), jobs, ready }));
    await jest.advanceTimersByTimeAsync(4000);
    expect(mockPopulateQueue).not.toHaveBeenCalled();
    ready = true;
    jobs.push({ id: 'j1', status: 'completed' });
    await jest.advanceTimersByTimeAsync(2500);
    jest.useRealTimers();
    await flush();
    // Briefing on start, the 6-hourly block and the daily briefing each build
    // the queue — every one of them over the hydrated data, none over [].
    expect(mockPopulateQueue).toHaveBeenCalled();
    for (const call of mockPopulateQueue.mock.calls as any[]) {
      expect(call[0].completedJobs).toEqual([{ id: 'j1', status: 'completed' }]);
    }
  });
});
