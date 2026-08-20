import type { CustomerDecisionTracker, CustomerDecisionItem, DecisionOption } from '../types/decisions';

/**
 * Billing the upgrades a customer chose in the decision portal.
 *
 * `DecisionOption.priceImpact` is money: "Matte Black · +€200". The portal
 * sums every chosen option and SHOWS the customer a running total. Nothing
 * downstream read it — no quote, no invoice, no change order — so the customer
 * had agreed to a figure the product could not bill. (learnings #203.)
 *
 * The rules here are meerwerk's rules, because that is what an upgrade is:
 *
 *  - **Its own invoice.** [[progress-billing]]'s design decision: a change
 *    order is billed separately and does not re-base the agreed price.
 *    Folding upgrades into the job's fixed price would silently re-price the
 *    contract.
 *  - **art. 7:755 BW**: a contractor may only charge for extra work if the
 *    customer was warned IN TIME that it carried a price increase. A choice
 *    the CUSTOMER made in the portal is its own evidence — the price was
 *    printed beside the option they tapped. A choice the CONTRACTOR recorded
 *    on the customer's behalf is not, so a positive amount needs a recorded
 *    warning first, exactly like `canInvoiceChangeOrder`.
 *  - **A negative impact is minderwerk** — a credit, in the customer's favour,
 *    and exempt from the warning requirement.
 */
export interface UpgradeEntry {
  /** The tracker row id (what DecisionTracker reports). */
  itemId: string;
  /** e.g. "Tap/Faucet Finish" */
  itemName: string;
  /** e.g. "Matte Black" */
  optionLabel: string;
  /** Signed, ex VAT. Positive = the customer owes more. */
  amount: number;
  decidedAt?: string;
  decidedBy?: 'customer' | 'contractor';
  billedInvoiceId?: string;
}

export interface BlockedUpgrade {
  entry: UpgradeEntry;
  reason: 'needs_warning';
}

export function chosenOption(item: CustomerDecisionItem): DecisionOption | undefined {
  if (item.status !== 'decided' || !item.options) return undefined;
  return item.options.find(o => o.value === item.value);
}

/** Every decided item whose chosen option moves the price, billed or not. */
export function decidedUpgrades(tracker: CustomerDecisionTracker): UpgradeEntry[] {
  const out: UpgradeEntry[] = [];
  for (const cat of tracker.categories ?? []) {
    for (const item of cat.items ?? []) {
      const option = chosenOption(item);
      const amount = Number(option?.priceImpact ?? 0);
      if (!option || !amount) continue;
      out.push({
        itemId: item.id,
        itemName: item.name,
        optionLabel: option.label,
        amount,
        decidedAt: item.decidedAt,
        decidedBy: item.decidedBy,
        billedInvoiceId: item.billedInvoiceId,
      });
    }
  }
  return out;
}

/**
 * What the customer has added to the job so far — the same number the portal
 * prints to them. Includes already-billed upgrades: it is the running total of
 * the choices, not an amount outstanding.
 */
export function upgradeTotal(tracker: CustomerDecisionTracker): number {
  return round2(decidedUpgrades(tracker).reduce((sum, e) => sum + e.amount, 0));
}

/** Still to bill: everything not yet attached to an invoice. */
export function unbilledUpgrades(tracker: CustomerDecisionTracker): UpgradeEntry[] {
  return decidedUpgrades(tracker).filter(e => !e.billedInvoiceId);
}

/**
 * Split the unbilled upgrades into what can go on an invoice now and what is
 * held back for want of the 7:755 warning.
 */
export function billableUpgrades(
  tracker: CustomerDecisionTracker,
): { billable: UpgradeEntry[]; blocked: BlockedUpgrade[]; total: number } {
  const billable: UpgradeEntry[] = [];
  const blocked: BlockedUpgrade[] = [];

  for (const entry of unbilledUpgrades(tracker)) {
    if (entry.amount > 0 && !hasPriceConsent(tracker, entry.itemId)) {
      blocked.push({ entry, reason: 'needs_warning' });
      continue;
    }
    billable.push(entry);
  }

  return { billable, blocked, total: round2(billable.reduce((s, e) => s + e.amount, 0)) };
}

/**
 * Did the customer know this one cost extra?
 *
 * True when they chose it themselves (the portal prints the price impact on
 * the option), or when the contractor has recorded that they told them.
 */
export function hasPriceConsent(tracker: CustomerDecisionTracker, itemId: string): boolean {
  for (const cat of tracker.categories ?? []) {
    for (const item of cat.items ?? []) {
      if (item.id !== itemId && item.itemId !== itemId) continue;
      return item.decidedBy === 'customer' || !!item.priceWarningAt;
    }
  }
  return false;
}

/** Record that the contractor warned the customer about a price increase. */
export function recordPriceWarning(
  tracker: CustomerDecisionTracker,
  itemId: string,
  now: Date = new Date(),
): CustomerDecisionTracker {
  return mapItems(tracker, item =>
    item.id === itemId || item.itemId === itemId
      ? { ...item, priceWarningAt: now.toISOString() }
      : item,
  );
}

/** Invoice lines, one per upgrade, in the contractor's own words. */
export function upgradeInvoiceLines(
  entries: UpgradeEntry[],
): { description: string; quantity: number; unitPrice: number }[] {
  return entries.map(e => ({
    description: `${e.itemName} — ${e.optionLabel}`,
    quantity: 1,
    unitPrice: e.amount,
  }));
}

/** Stamp the billed upgrades so the same choice cannot be charged twice. */
export function markUpgradesBilled(
  tracker: CustomerDecisionTracker,
  itemIds: string[],
  invoiceId: string,
  now: Date = new Date(),
): CustomerDecisionTracker {
  const ids = new Set(itemIds);
  return mapItems(tracker, item =>
    ids.has(item.id) || ids.has(item.itemId)
      ? { ...item, billedInvoiceId: invoiceId, billedAt: now.toISOString() }
      : item,
  );
}

function mapItems(
  tracker: CustomerDecisionTracker,
  fn: (item: CustomerDecisionItem) => CustomerDecisionItem,
): CustomerDecisionTracker {
  return {
    ...tracker,
    categories: (tracker.categories ?? []).map(cat => ({ ...cat, items: (cat.items ?? []).map(fn) })),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
