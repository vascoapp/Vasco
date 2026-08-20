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
  /**
   * Who chose it. Defaults to the contractor because this is the contractor's
   * own screen; the customer's own choices arrive through
   * `applySubmissionsToTracker` below. It decides whether an upgrade on this
   * item can be billed without a separately recorded warning — see
   * `decisionUpgradeBilling`.
   */
  decidedBy: 'customer' | 'contractor' = 'contractor',
): { tracker: CustomerDecisionTracker; matched: boolean } {
  let matched = false;
  const matches = (item: { id: string; itemId: string }) =>
    item.itemId === itemId || item.id === itemId;

  const categories = tracker.categories.map(cat => {
    const items = cat.items.map(item => {
      if (!matches(item)) return item;
      matched = true;
      return { ...item, status: 'decided' as const, value, decidedAt: now.toISOString(), decidedBy };
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

/**
 * Fold the customer's own submissions into the contractor's tracker.
 *
 * They were never folded in anywhere. `decision_submissions` rows reached the
 * contractor's screen as a photo panel and an activity timeline, and the
 * checklist itself kept showing every customer-answered item as PENDING — the
 * seeded tracker's "927 days overdue" rows are items somebody already
 * answered. Nothing could bill a chosen upgrade either, because the item the
 * price hangs off never reached `decided`.
 *
 * Submissions are keyed by `itemId`, which the portal fills from the tracker
 * row id, so match on either identifier for the same reason
 * `recordDecisionOnTracker` does.
 *
 * A newer contractor entry wins over an older customer submission and vice
 * versa: last answer stands, whoever gave it.
 */
export function applySubmissionsToTracker(
  tracker: CustomerDecisionTracker,
  submissions: { itemId: string; value?: string; submittedAt: string; submittedBy: 'customer' | 'contractor' }[],
): { tracker: CustomerDecisionTracker; applied: number } {
  if (!submissions.length) return { tracker, applied: 0 };
  let applied = 0;

  const categories = (tracker.categories ?? []).map(cat => {
    const items = (cat.items ?? []).map(item => {
      const forItem = submissions
        .filter(sub => sub.itemId === item.id || sub.itemId === item.itemId)
        .filter(sub => sub.value !== undefined && sub.value !== null && sub.value !== '')
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
      const latest = forItem[forItem.length - 1];
      if (!latest) return item;
      // Do not overwrite a more recent answer already on the item.
      if (item.decidedAt && item.decidedAt >= latest.submittedAt) return item;
      applied++;
      return {
        ...item,
        status: 'decided' as const,
        value: latest.value,
        decidedAt: latest.submittedAt,
        decidedBy: latest.submittedBy,
      };
    });
    return { ...cat, items, completedCount: items.filter(i => i.status === 'decided').length };
  });

  const decidedCount = categories.reduce((sum, cat) => sum + cat.completedCount, 0);
  return {
    applied,
    tracker: {
      ...tracker,
      categories,
      decidedCount,
      pendingCount: Math.max(0, tracker.totalDecisions - decidedCount),
    },
  };
}
