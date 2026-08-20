import { recordDecisionOnTracker } from '../decisionRecording';
import type { CustomerDecisionTracker } from '../../types/decisions';

/**
 * The bug: the contractor taps an option under a decision item and nothing
 * happens. Cause was an identifier mismatch — the card reports `item.id`, the
 * screen matched `item.itemId`, and those differ on the seeded tracker.
 *
 * Decoy proof: reverting `matches` to `item.itemId === itemId` fails
 * "records by the row id" below; reverting to `item.id === itemId` fails
 * "records by the template item key". Neither single-field version passes both.
 */
function tracker(): CustomerDecisionTracker {
  const t: CustomerDecisionTracker = {
    id: 'tracker_1',
    jobId: 'job-1',
    customerId: 'cust-1',
    customerName: 'Familie van den Berg',
    templateId: 'tpl_bathroom',
    templateName: 'Bathroom',
    projectStartDate: '2026-08-01T00:00:00.000Z',
    phases: [],
    categories: [
      {
        id: 'cat_fixtures',
        categoryId: 'cat_fixtures',
        name: 'Fixtures & fittings',
        phase: 'planning' as CustomerDecisionTracker['categories'][number]['phase'],
        dueDate: '2026-09-01T00:00:00.000Z',
        items: [
          {
            id: 'dec_4',
            itemId: 'item_tap_style',
            name: 'Tap/Faucet Finish',
            description: 'Chrome, brushed nickel, black, or brass',
            inputType: 'select',
            options: [{ value: 'chrome', label: 'Chrome' }],
            priority: 'important',
            status: 'pending',
            dueDate: '2026-09-01T00:00:00.000Z',
            isOverdue: true,
            remindersSent: 2,
          },
          {
            id: 'dec_5',
            itemId: 'item_wall_tile',
            name: 'Wall Tile Selection',
            description: 'Choose wall tile',
            inputType: 'select',
            priority: 'critical',
            status: 'pending',
            dueDate: '2026-09-01T00:00:00.000Z',
            isOverdue: true,
            remindersSent: 3,
          },
        ],
        isOverdue: true,
        completedCount: 0,
        totalCount: 2,
      },
    ],
    totalDecisions: 2,
    decidedCount: 0,
    pendingCount: 2,
    overdueCount: 2,
    reminderFrequency: 'weekly',
    preferredChannel: 'whatsapp',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  return t;
}

const decided = (t: CustomerDecisionTracker, id: string) =>
  t.categories[0].items.find(i => i.id === id)!;

describe('recordDecisionOnTracker', () => {
  it('records by the row id — what DecisionTracker actually reports', () => {
    const { tracker: next, matched } = recordDecisionOnTracker(tracker(), 'dec_4', 'chrome');
    expect(matched).toBe(true);
    expect(decided(next, 'dec_4').status).toBe('decided');
    expect(decided(next, 'dec_4').value).toBe('chrome');
  });

  it('records by the template item key — the shape the screen used to expect', () => {
    const { tracker: next, matched } = recordDecisionOnTracker(tracker(), 'item_wall_tile', 'matt-white');
    expect(matched).toBe(true);
    expect(decided(next, 'dec_5').status).toBe('decided');
  });

  it('reports no match for an unknown id rather than silently doing nothing', () => {
    const { tracker: next, matched } = recordDecisionOnTracker(tracker(), 'nope', 'x');
    expect(matched).toBe(false);
    expect(next.decidedCount).toBe(0);
  });

  it('leaves the other items alone and keeps the counts consistent', () => {
    const { tracker: next } = recordDecisionOnTracker(tracker(), 'dec_4', 'chrome');
    expect(decided(next, 'dec_5').status).toBe('pending');
    expect(next.decidedCount).toBe(1);
    expect(next.pendingCount).toBe(1);
    expect(next.categories[0].completedCount).toBe(1);
  });

  it('counts a second decision instead of overwriting the first', () => {
    const first = recordDecisionOnTracker(tracker(), 'dec_4', 'chrome').tracker;
    const second = recordDecisionOnTracker(first, 'dec_5', 'matt-white').tracker;
    expect(second.decidedCount).toBe(2);
    expect(second.pendingCount).toBe(0);
  });

  it('never drives pendingCount negative when the template over-claims', () => {
    const t = tracker();
    t.totalDecisions = 1; // template says 1, tracker holds 2
    const a = recordDecisionOnTracker(t, 'dec_4', 'chrome').tracker;
    const b = recordDecisionOnTracker(a, 'dec_5', 'matt-white').tracker;
    expect(b.pendingCount).toBe(0);
  });
});
