/**
 * @jest-environment node
 */
// A refusal that names a plan is a PRICE QUOTE. `canUseEInvoiceFormat` said
// "requires the Contractor plan" — €69/mo — for e-invoicing, which Pro (€39/mo)
// has granted all along. The contractor it aimed that at is the German one
// hitting the e-invoice obligation: the exact wedge the go-to-market plan is
// built on, upsold by €360 a year to a plan they do not need (sweep
// 2026-09-18). `canUseFeature` carried its own copy of the pricing in
// `featureInfo` for the same reason.
//
// The rule this guard fixes in place: the tier a gate names is the CHEAPEST
// tier whose limits actually grant the thing, read from the tier table.
import {
  TIERS, TIER_ORDER, minimumTierFor, canUseFeature,
  type SubscriptionState, type SubscriptionTier, type TierLimits,
} from '../subscriptionService';
import { canUseEInvoiceFormat, E_INVOICE_FORMATS } from '../complianceGatingService';

const state = (tier: SubscriptionState['tier']): SubscriptionState => ({
  tier,
  billingCycle: 'monthly',
  startedAt: '2026-09-01T00:00:00.000Z',
  expiresAt: null,
  seatsUsed: 1,
  seatsPurchased: 0,
  aiInsightsUsedThisMonth: 0,
  quotesUsedThisMonth: 0,
  invoicesUsedThisMonth: 0,
  activeJobCount: 0,
  clientCount: 0,
  trialEndsAt: null,
});

describe('e-invoicing is quoted at the plan that grants it', () => {
  it('Pro is what unlocks it', () => {
    expect(minimumTierFor('hasEInvoicing')).toBe('pro');
    expect(TIERS.pro.limits.hasEInvoicing).toBe(true);
  });

  it('a Free contractor is sent to Pro, not to Contractor', () => {
    const gate = canUseEInvoiceFormat(state('free'), 'xrechnung');
    expect(gate.allowed).toBe(false);
    expect(gate.requiredTier).toBe('pro');
    expect(gate.reason).toContain('XRechnung');
    expect(gate.reason).toContain('Pro');
    expect(gate.reason).not.toContain('Contractor');
  });

  it('every format refuses the same way', () => {
    for (const f of E_INVOICE_FORMATS) {
      const gate = canUseEInvoiceFormat(state('free'), f.id);
      expect({ id: f.id, tier: gate.requiredTier }).toEqual({ id: f.id, tier: 'pro' });
      // …and the row's own `requiredTier` agrees with the gate.
      expect({ id: f.id, row: f.requiredTier }).toEqual({ id: f.id, row: 'pro' });
    }
  });

  it('a Pro contractor is not stopped at all', () => {
    for (const f of E_INVOICE_FORMATS) {
      expect({ id: f.id, allowed: canUseEInvoiceFormat(state('pro'), f.id).allowed })
        .toEqual({ id: f.id, allowed: true });
    }
  });
});

describe('no gate quotes a plan the table disagrees with', () => {
  const booleanFeatures = (Object.keys(TIERS.contractor.limits) as (keyof TierLimits)[])
    .filter((k) => typeof TIERS.contractor.limits[k] === 'boolean');

  it('there are plenty of them, so this is not vacuous', () => {
    expect(booleanFeatures.length).toBeGreaterThanOrEqual(20);
  });

  it.each(booleanFeatures)('%s names its cheapest granting tier', (feature) => {
    const min = minimumTierFor(feature);
    if (TIERS.free.limits[feature] === true) {
      // Free already has it — nothing to sell.
      expect(canUseFeature(state('free'), feature).allowed).toBe(true);
      return;
    }
    const gate = canUseFeature(state('free'), feature);
    expect({ feature, allowed: gate.allowed }).toEqual({ feature, allowed: false });
    if (gate.allowed) return; // narrows the union; the assertion above already failed
    expect({ feature, tier: gate.requiredTier }).toEqual({ feature, tier: min });
    // The tier it names must be one that really grants it.
    const named = gate.requiredTier as SubscriptionTier;
    expect({ feature, grants: TIERS[named].limits[feature] }).toEqual({ feature, grants: true });
  });

  it('a tier only ever adds, so "cheapest" is a real answer', () => {
    // If a dearer tier ever WITHDREW a feature, `minimumTierFor` would be
    // quoting a plan that does not have it.
    for (const feature of booleanFeatures) {
      let seenTrue = false;
      for (const tier of TIER_ORDER) {
        const has = TIERS[tier].limits[feature] === true;
        if (seenTrue) expect({ feature, tier, has }).toEqual({ feature, tier, has: true });
        if (has) seenTrue = true;
      }
    }
  });
});
