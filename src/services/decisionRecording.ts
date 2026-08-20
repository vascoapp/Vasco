import type { CustomerDecisionTracker } from '../types/decisions';

/**
 * Record one customer decision onto a tracker.
 *
 * Extracted from `app/(contractor)/decisions.tsx` because of the defect it
 * fixes: `CustomerDecisionItem` carries TWO identifiers — `id` (the row inside
 * this tracker, e.g. `dec_4`) and `itemId` (the template's item key, e.g.
 * `item_tap_style`). `DecisionTracker.tsx` reports a tap with `item.id`; the
 * screen's handler matched on `item.itemId`. For a tracker the contractor
 * builds from a template the two are assigned the same value, so it worked.
 * For every tracker where they differ — the seeded demo tracker, and anything
 * a backend row ever supplies — NOTHING matched: tapping "Chrome" or "Matte
 * Black" under Tap/Faucet Finish left the item pending, forever, with no error.
 *
 * So the match accepts EITHER identifier. Doing it here rather than at the one
 * call site means the reverse drift (a caller that reports `itemId`) is also
 * covered, and a test can import the real function instead of a replica
 * (learnings #198).
 */
export function recordDecisionOnTracker(
  tracker: CustomerDecisionTracker,
  itemId: string,
  value: string | number | boolean,
  now: Date = new Date(),
): { tracker: CustomerDecisionTracker; matched: boolean } {
  let matched = false;
  const matches = (item: { id: string; itemId: string }) =>
    item.itemId === itemId || item.id === itemId;

  const categories = tracker.categories.map(cat => {
    const items = cat.items.map(item => {
      if (!matches(item)) return item;
      matched = true;
      return { ...item, status: 'decided' as const, value, decidedAt: now.toISOString() };
    });
    return {
      ...cat,
      items,
      completedCount: items.filter(item => item.status === 'decided').length,
    };
  });

  const decidedCount = categories.reduce((sum, cat) => sum + cat.completedCount, 0);

  return {
    matched,
    tracker: {
      ...tracker,
      categories,
      decidedCount,
      // `totalDecisions` is the template's advertised count; a tracker can hold
      // fewer items than the template claims, so clamp rather than let the
      // pending count go negative.
      pendingCount: Math.max(0, tracker.totalDecisions - decidedCount),
      updatedAt: now.toISOString(),
    },
  };
}
