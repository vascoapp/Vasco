/**
 * The plan limits sold on the website (admin/src/lib/pricing.ts) block at
 * exactly their number in the app — checked at the boundary, not "somewhere
 * near" (double-test of the 2026-10-13 pricing change).
 */
import { canCreateQuote, canCreateInvoice, canCreateJob, canAddTeamMember, TIERS } from '../subscriptionService';
import { canUseEInvoiceFormat } from '../complianceGatingService';

const state = (tier: 'free' | 'pro' | 'contractor', seatsPurchased = 0) =>
  ({ tier, billingCycle: 'monthly', trialEndsAt: null, seatsPurchased, seatsUsed: 1 } as any);

it('Free: the 5th quote and the 3rd invoice of a month are refused, the one before is allowed', () => {
  expect(canCreateQuote(state('free'), 4).allowed).toBe(true);
  expect(canCreateQuote(state('free'), 5).allowed).toBe(false);
  expect(canCreateInvoice(state('free'), 2).allowed).toBe(true);
  expect(canCreateInvoice(state('free'), 3).allowed).toBe(false);
  expect(canCreateJob(state('free'), 4).allowed).toBe(true);
  expect(canCreateJob(state('free'), 5).allowed).toBe(false);
});

it('Pro and Contractor: no quote/invoice cap', () => {
  for (const t of ['pro', 'contractor'] as const) {
    expect(canCreateQuote(state(t), 10_000).allowed).toBe(true);
    expect(canCreateInvoice(state(t), 10_000).allowed).toBe(true);
  }
});

it('E-invoicing: refused on Free, allowed on Pro and Contractor', () => {
  expect(canUseEInvoiceFormat(state('free'), 'xrechnung' as any).allowed).toBe(false);
  expect(canUseEInvoiceFormat(state('pro'), 'xrechnung' as any).allowed).toBe(true);
  expect(canUseEInvoiceFormat(state('contractor'), 'xrechnung' as any).allowed).toBe(true);
});

it('Seats: Pro has 3, each purchased seat adds one; Contractor has 15', () => {
  expect(canAddTeamMember(state('pro'), 2).allowed).toBe(true);
  expect(canAddTeamMember(state('pro'), 3).allowed).toBe(false);
  expect(canAddTeamMember(state('pro', 2), 4).allowed).toBe(true);
  expect(canAddTeamMember(state('pro', 2), 5).allowed).toBe(false);
  expect(canAddTeamMember(state('contractor'), 14).allowed).toBe(true);
  expect(canAddTeamMember(state('contractor'), 15).allowed).toBe(false);
  expect(TIERS.pro.limits.maxTeamSeats).toBe(3);
});
