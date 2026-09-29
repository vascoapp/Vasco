// Every demo business profile names its country. The profile outranks the
// account, so a seed without one made `getEffectiveVatRate` return 0 and the
// Dutch demo's Geld tab showed net revenue equal to gross (aannemer walk,
// 2026-09-29). The DE/FR/ES/IT/US seeds already had theirs; NL did not.
import {
  businessProfile, US_BUSINESS_PROFILE, DE_BUSINESS_PROFILE,
  FR_BUSINESS_PROFILE, ES_BUSINESS_PROFILE, IT_BUSINESS_PROFILE,
} from '../data/mockBusiness';
import { getEffectiveVatRate } from '../domain/business';

it.each([
  ['NL', businessProfile, 21], ['DE', DE_BUSINESS_PROFILE, 19], ['FR', FR_BUSINESS_PROFILE, 20],
  ['ES', ES_BUSINESS_PROFILE, 21], ['IT', IT_BUSINESS_PROFILE, 22], ['US', US_BUSINESS_PROFILE, 0],
])('%s demo profile carries its country and its VAT rate', (country, profile, rate) => {
  expect(profile.country).toBe(country);
  expect(getEffectiveVatRate(profile)).toBe(rate);
});
