// What Vasco costs — ONE place for the website (homepage plans, FAQ, the
// /billing/upgrade checkout page). Prices are EXCLUDING VAT (user, 2026-10-13):
// customers are businesses, and B2B software in NL/DE is priced net; Stripe
// prices carry tax_behavior=exclusive and Stripe Tax adds VAT at checkout.
// marketingContent.test checks these against the app's TIERS
// (src/services/subscriptionService.ts) and the copy against these.

export const PRICING = {
  trialDays: 30,
  pro: { monthly: 39, yearlyPerMonth: 32, seatsIncluded: 3 },
  contractor: { monthly: 69, yearlyPerMonth: 56, seatsIncluded: 15 },
  /** Extra team members on Pro only; past that, Contractor is cheaper. */
  extraSeat: { monthly: 10, yearlyPerMonth: 8, maxExtra: 3 },
  free: { activeJobs: 5, quotesPerMonth: 5, invoicesPerMonth: 3, customers: 25 },
} as const;

export const yearlyTotal = (perMonth: number): number => perMonth * 12;
