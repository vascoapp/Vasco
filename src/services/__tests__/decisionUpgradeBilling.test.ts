import {
  decidedUpgrades,
  upgradeTotal,
  unbilledUpgrades,
  billableUpgrades,
  hasPriceConsent,
  recordPriceWarning,
  upgradeInvoiceLines,
  markUpgradesBilled,
} from '../decisionUpgradeBilling';
import { applySubmissionsToTracker } from '../decisionRecording';
import type { CustomerDecisionTracker, CustomerDecisionItem } from '../../types/decisions';

/**
 * The upgrades a customer picks are money the app could not bill. These pin
 * the two rules that keep the fix honest: nothing gets billed twice, and a
 * price the customer was never told about is held back (art. 7:755 BW).
 */
function item(over: Partial<CustomerDecisionItem> = {}): CustomerDecisionItem {
  return {
    id: 'dec_4',
    itemId: 'item_tap_style',
    name: 'Tap/Faucet Finish',
    description: '',
    inputType: 'select',
    options: [
      { value: 'chrome', label: 'Chrome', priceImpact: 0 },
      { value: 'black', label: 'Matte Black', priceImpact: 200 },
      { value: 'basic', label: 'Basic', priceImpact: -50 },
    ],
    priority: 'important',
    status: 'pending',
    dueDate: '2026-09-01T00:00:00.000Z',
    isOverdue: false,
    remindersSent: 0,
    ...over,
  } as CustomerDecisionItem;
}

function tracker(items: CustomerDecisionItem[]): CustomerDecisionTracker {
  return {
    id: 'tracker_1',
    jobId: 'job-1',
    customerId: 'cust-1',
    customerName: 'Familie van den Berg',
    templateId: 'tpl',
    templateName: 'Bathroom',
    projectStartDate: '2026-08-01T00:00:00.000Z',
    phases: [],
    categories: [{
      id: 'cat', categoryId: 'cat', name: 'Fixtures', phase: 'planning',
      dueDate: '2026-09-01T00:00:00.000Z', items, isOverdue: false,
      completedCount: items.filter(i => i.status === 'decided').length, totalCount: items.length,
    }],
    totalDecisions: items.length,
    decidedCount: items.filter(i => i.status === 'decided').length,
    pendingCount: items.filter(i => i.status !== 'decided').length,
    overdueCount: 0,
    reminderFrequency: 'weekly',
    preferredChannel: 'whatsapp',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as CustomerDecisionTracker;
}

const customerChose = item({ status: 'decided', value: 'black', decidedBy: 'customer', decidedAt: '2026-08-10T09:00:00.000Z' });
const contractorChose = item({ id: 'dec_9', itemId: 'item_tiles', name: 'Wall Tile', status: 'decided', value: 'black', decidedBy: 'contractor' });

describe('decidedUpgrades', () => {
  it('finds the chosen option and its price', () => {
    const [entry] = decidedUpgrades(tracker([customerChose]));
    expect(entry).toMatchObject({ itemName: 'Tap/Faucet Finish', optionLabel: 'Matte Black', amount: 200 });
  });

  it('ignores a pending item, even when an expensive option exists', () => {
    expect(decidedUpgrades(tracker([item()]))).toEqual([]);
  });

  it('ignores a decided option that costs nothing extra', () => {
    expect(decidedUpgrades(tracker([item({ status: 'decided', value: 'chrome' })]))).toEqual([]);
  });

  it('counts a downgrade as a negative amount — minderwerk, not a second concept', () => {
    expect(decidedUpgrades(tracker([item({ status: 'decided', value: 'basic' })]))[0].amount).toBe(-50);
  });
});

describe('upgradeTotal — the number the CUSTOMER is shown', () => {
  it('sums the chosen impacts', () => {
    const t = tracker([customerChose, item({ id: 'dec_5', itemId: 'i2', status: 'decided', value: 'basic' })]);
    expect(upgradeTotal(t)).toBe(150);
  });

  it('keeps counting an upgrade after it has been billed — it is a running total, not a balance', () => {
    const billed = markUpgradesBilled(tracker([customerChose]), ['dec_4'], 'INV-1');
    expect(upgradeTotal(billed)).toBe(200);
    expect(unbilledUpgrades(billed)).toEqual([]);
  });
});

describe('billableUpgrades — the 7:755 gate', () => {
  it('bills what the CUSTOMER chose: the price was printed next to the option', () => {
    const { billable, blocked, total } = billableUpgrades(tracker([customerChose]));
    expect(billable).toHaveLength(1);
    expect(blocked).toHaveLength(0);
    expect(total).toBe(200);
  });

  it('holds back an upgrade the CONTRACTOR recorded, with no warning on file', () => {
    const { billable, blocked } = billableUpgrades(tracker([contractorChose]));
    expect(billable).toHaveLength(0);
    expect(blocked[0].reason).toBe('needs_warning');
  });

  it('releases it once the warning is recorded', () => {
    const warned = recordPriceWarning(tracker([contractorChose]), 'dec_9');
    expect(hasPriceConsent(warned, 'dec_9')).toBe(true);
    expect(billableUpgrades(warned).billable).toHaveLength(1);
  });

  it('never blocks a credit — minderwerk is in the customer\'s favour', () => {
    const credit = item({ id: 'dec_7', status: 'decided', value: 'basic', decidedBy: 'contractor' });
    const { billable, blocked } = billableUpgrades(tracker([credit]));
    expect(blocked).toHaveLength(0);
    expect(billable[0].amount).toBe(-50);
  });

  it('cannot bill the same choice twice', () => {
    const t = tracker([customerChose]);
    const billed = markUpgradesBilled(t, billableUpgrades(t).billable.map(e => e.itemId), 'INV-2026-1');
    expect(billableUpgrades(billed).billable).toHaveLength(0);
    expect(billableUpgrades(billed).total).toBe(0);
  });

  it('stamps which invoice took it', () => {
    const billed = markUpgradesBilled(tracker([customerChose]), ['dec_4'], 'INV-9');
    expect(decidedUpgrades(billed)[0].billedInvoiceId).toBe('INV-9');
  });
});

describe('upgradeInvoiceLines', () => {
  it('names the item and the option the customer picked', () => {
    expect(upgradeInvoiceLines(decidedUpgrades(tracker([customerChose])))).toEqual([
      { description: 'Tap/Faucet Finish — Matte Black', quantity: 1, unitPrice: 200 },
    ]);
  });
});

describe('applySubmissionsToTracker — the customer\'s answers reaching the contractor', () => {
  const submission = (over: Partial<{ itemId: string; value: string; submittedAt: string; submittedBy: 'customer' | 'contractor' }> = {}) => ({
    itemId: 'dec_4', value: 'black', submittedAt: '2026-08-10T09:00:00.000Z', submittedBy: 'customer' as const, ...over,
  });

  it('marks the item decided, with the customer as the source — which is what makes it billable', () => {
    const { tracker: merged, applied } = applySubmissionsToTracker(tracker([item()]), [submission()]);
    expect(applied).toBe(1);
    const it0 = merged.categories[0].items[0];
    expect(it0.status).toBe('decided');
    expect(it0.value).toBe('black');
    expect(it0.decidedBy).toBe('customer');
    expect(billableUpgrades(merged).total).toBe(200);
  });

  it('matches on the template item key too', () => {
    const { applied } = applySubmissionsToTracker(tracker([item()]), [submission({ itemId: 'item_tap_style' })]);
    expect(applied).toBe(1);
  });

  it('takes the latest submission when the customer changed their mind', () => {
    const { tracker: merged } = applySubmissionsToTracker(tracker([item()]), [
      submission({ value: 'black', submittedAt: '2026-08-10T09:00:00.000Z' }),
      submission({ value: 'basic', submittedAt: '2026-08-11T09:00:00.000Z' }),
    ]);
    expect(merged.categories[0].items[0].value).toBe('basic');
  });

  it('does not overwrite a newer answer already on the item', () => {
    const recent = item({ status: 'decided', value: 'chrome', decidedAt: '2026-08-12T09:00:00.000Z', decidedBy: 'contractor' });
    const { tracker: merged, applied } = applySubmissionsToTracker(tracker([recent]), [submission()]);
    expect(applied).toBe(0);
    expect(merged.categories[0].items[0].value).toBe('chrome');
  });

  it('ignores an empty submission rather than marking the item decided with no answer', () => {
    const { applied } = applySubmissionsToTracker(tracker([item()]), [submission({ value: '' })]);
    expect(applied).toBe(0);
  });

  it('keeps the counts consistent', () => {
    const { tracker: merged } = applySubmissionsToTracker(tracker([item(), item({ id: 'dec_5', itemId: 'i2' })]), [submission()]);
    expect(merged.decidedCount).toBe(1);
    expect(merged.pendingCount).toBe(1);
    expect(merged.categories[0].completedCount).toBe(1);
  });
});
