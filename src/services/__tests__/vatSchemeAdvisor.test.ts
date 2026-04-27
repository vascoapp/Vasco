/**
 * @jest-environment node
 *
 * R263 — VAT scheme advisor logic.
 */

import { suggestVatScheme } from '../vatSchemeAdvisor';

describe('suggestVatScheme', () => {
  test('NL eenmanszaak + solo → confident KOR', () => {
    const r = suggestVatScheme({ country: 'NL', businessType: 'eenmanszaak', teamSize: 'solo' });
    expect(r.suggested).toBe('small_business_NL_KOR');
    expect(r.confident).toBe(true);
  });

  test('DE Einzelunternehmen + solo → confident Kleinunternehmer', () => {
    const r = suggestVatScheme({ country: 'DE', businessType: 'einzelunternehmen', teamSize: 'solo' });
    expect(r.suggested).toBe('small_business_DE_kleinunternehmer');
    expect(r.confident).toBe(true);
  });

  test('NL eenmanszaak + small team → standard, not confident', () => {
    const r = suggestVatScheme({ country: 'NL', businessType: 'eenmanszaak', teamSize: 'small' });
    expect(r.suggested).toBe('standard');
    expect(r.confident).toBe(false);
  });

  test('NL VOF + solo → standard (entity type doesn\'t qualify)', () => {
    const r = suggestVatScheme({ country: 'NL', businessType: 'vof', teamSize: 'solo' });
    expect(r.suggested).toBe('standard');
    expect(r.confident).toBe(false);
  });

  test('FR/ES/IT/UK + solo → standard (no equivalent scheme in our type)', () => {
    for (const country of ['FR', 'ES', 'IT', 'UK']) {
      const r = suggestVatScheme({ country, businessType: 'autoEntrepreneur', teamSize: 'solo' });
      expect(r.suggested).toBe('standard');
    }
  });

  test('missing fields → standard fallback', () => {
    expect(suggestVatScheme({}).suggested).toBe('standard');
    expect(suggestVatScheme({ country: 'NL' }).suggested).toBe('standard');
    expect(suggestVatScheme({ country: 'NL', businessType: 'eenmanszaak' }).suggested).toBe('standard');
  });

  test('large/medium teams never get small-business suggestion', () => {
    const big = suggestVatScheme({ country: 'NL', businessType: 'eenmanszaak', teamSize: 'large' });
    const med = suggestVatScheme({ country: 'DE', businessType: 'einzelunternehmen', teamSize: 'medium' });
    expect(big.suggested).toBe('standard');
    expect(med.suggested).toBe('standard');
  });
});
