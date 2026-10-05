/**
 * The queue stays bounded without losing work (sweep A5).
 *
 * addToQueue kept `slice(0, 50)` after putting the new card first, so the
 * OLDEST card went — whatever it was. A pending maintenance-visit card (its
 * preparedData is the only copy of the visit, #366) could be evicted while a
 * week of approved history stayed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { capQueue, addToQueue } from '../aiActionQueueService';

const KEY = '@vasco_ai_queue';
const NOW = '2026-10-05T12:00:00.000Z';
let n = 0;
const card = (over: Record<string, unknown>) => ({
  id: `q${n++}`, type: 'draft_reminder', status: 'pending', title: `t${n}`, description: '',
  preparedData: {}, actionLabel: 'a', estimatedImpact: '', createdAt: '2026-10-01T00:00:00.000Z', ...over,
}) as any;

describe('capQueue', () => {
  it('evicts history first, then rebuilt-every-run cards, never a pending one-off', () => {
    const visit = card({ sourceGeneratorId: 'service_agreement_ag1', createdAt: '2026-09-01T00:00:00.000Z' });
    // Resolved more than 3 days before NOW — the first to go.
    const history = Array.from({ length: 30 }, () => card({ status: 'approved', createdAt: '2026-09-20T00:00:00.000Z', resolvedAt: '2026-09-25T00:00:00.000Z' }));
    const rebuilt = Array.from({ length: 25 }, () => card({ sourceGeneratorId: 'automation_overdue' }));
    const items = [visit, ...history, ...rebuilt];
    const kept = capQueue(items, 50, 200, NOW);
    expect(kept).toHaveLength(50);
    expect(kept).toContain(visit);
    expect(kept.filter((q: any) => q.status === 'approved')).toHaveLength(0 + 30 - 6); // 6 over → 6 history gone
    expect(kept.filter((q: any) => q.sourceGeneratorId === 'automation_overdue')).toHaveLength(25);
  });

  it('expired pending cards count as history', () => {
    const expired = Array.from({ length: 5 }, () => card({ expiresAt: '2026-10-02T00:00:00.000Z' }));
    const oneOffs = Array.from({ length: 50 }, () => card({ sourceGeneratorId: 'event_invoice_sent' }));
    const kept = capQueue([...oneOffs, ...expired], 50, 200, NOW);
    expect(kept).toHaveLength(50);
    expect(kept.some((q: any) => q.expiresAt)).toBe(false);
  });

  it('pending one-offs over the soft cap are kept; only the hard cap trims', () => {
    const oneOffs = Array.from({ length: 60 }, () => card({ sourceGeneratorId: 'event_x' }));
    expect(capQueue(oneOffs, 50, 200, NOW)).toHaveLength(60);
    expect(capQueue(oneOffs, 50, 55, NOW)).toHaveLength(55);
  });
});

it('addToQueue on a full queue keeps the pending maintenance visit', async () => {
  await AsyncStorage.clear();
  const visit = card({ id: 'visit-1', sourceGeneratorId: 'service_agreement_ag1', createdAt: '2020-01-01T00:00:00.000Z' });
  const history = Array.from({ length: 49 }, (_, i) => card({ status: 'rejected', createdAt: '2026-10-04T00:00:00.000Z', title: `h${i}` }));
  // The visit is the OLDEST and last — exactly what slice(0, 50) dropped.
  await AsyncStorage.setItem(KEY, JSON.stringify([...history, visit]));
  await addToQueue({ type: 'draft_reminder', title: 'Nieuw', description: '', preparedData: {}, actionLabel: 'a', estimatedImpact: '', entityKey: 'new-1', sourceGeneratorId: 'event_new' } as any);
  const stored = JSON.parse((await AsyncStorage.getItem(KEY))!);
  expect(stored.some((q: any) => q.id === 'visit-1')).toBe(true);
  expect(stored).toHaveLength(50);
});

describe('capQueue — what the reviews asked for', () => {
  it('a card approved minutes ago outlives rebuilt cards (the 3-day "just chased" guard reads it)', () => {
    const justChased = card({ status: 'approved', type: 'draft_reminder', createdAt: '2026-09-28T00:00:00.000Z', resolvedAt: '2026-10-05T11:50:00.000Z' });
    const rebuilt = Array.from({ length: 30 }, () => card({ sourceGeneratorId: 'automation_overdue' }));
    const oneOffs = Array.from({ length: 25 }, () => card({ sourceGeneratorId: 'event_x' }));
    const kept = capQueue([justChased, ...rebuilt, ...oneOffs], 50, 200, NOW);
    expect(kept).toContain(justChased);
    expect(kept.filter((q: any) => q.sourceGeneratorId === 'event_x')).toHaveLength(25);
    expect(kept).toHaveLength(50);
  });

  it('with no history, rebuilt cards go before any one-off', () => {
    const rebuilt = Array.from({ length: 10 }, () => card({ sourceGeneratorId: 'trade_x' }));
    const oneOffs = Array.from({ length: 45 }, () => card({ sourceGeneratorId: 'service_agreement_y' }));
    const kept = capQueue([...oneOffs, ...rebuilt], 50, 200, NOW);
    expect(kept.filter((q: any) => q.sourceGeneratorId === 'service_agreement_y')).toHaveLength(45);
    expect(kept.filter((q: any) => q.sourceGeneratorId === 'trade_x')).toHaveLength(5);
  });

  it('old history goes oldest-RESOLVED first, not oldest-created', () => {
    const waitedLong = card({ status: 'approved', createdAt: '2026-08-01T00:00:00.000Z', resolvedAt: '2026-09-30T00:00:00.000Z' });
    const resolvedEarly = card({ status: 'approved', createdAt: '2026-09-01T00:00:00.000Z', resolvedAt: '2026-09-02T00:00:00.000Z' });
    const oneOffs = Array.from({ length: 49 }, () => card({ sourceGeneratorId: 'event_x' }));
    const kept = capQueue([...oneOffs, waitedLong, resolvedEarly], 50, 200, NOW);
    expect(kept).toContain(waitedLong);
    expect(kept).not.toContain(resolvedEarly);
  });
});
