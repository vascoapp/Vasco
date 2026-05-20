import { getExpiringLicenses, hasExpiringLicenses } from '../licenseExpiryService';
import type { ContractorLicense } from '../../domain/business';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOffset(days: number): string {
  const d = new Date(Date.now() + days * MS_PER_DAY);
  return d.toISOString().slice(0, 10);
}

describe('licenseExpiryService', () => {
  it('returns empty list when no licenses', () => {
    expect(getExpiringLicenses({})).toEqual([]);
    expect(getExpiringLicenses({ licenses: [] })).toEqual([]);
  });

  it('filters out licenses outside the 30-day window', () => {
    const licenses: ContractorLicense[] = [
      { type: 'hvac', state: 'TX', number: 'A', expiryDate: dateOffset(90) },
      { type: 'epa_608', state: 'TX', number: 'B', expiryDate: dateOffset(15) },
    ];
    const result = getExpiringLicenses({ licenses });
    expect(result.length).toBe(1);
    expect(result[0].number).toBe('B');
  });

  it('classifies severity correctly', () => {
    const licenses: ContractorLicense[] = [
      { type: 'master_plumber', state: 'TX', number: 'EXPIRED', expiryDate: dateOffset(-3) },
      { type: 'hvac', state: 'TX', number: 'URGENT', expiryDate: dateOffset(5) },
      { type: 'roofing', state: 'TX', number: 'SOON', expiryDate: dateOffset(20) },
    ];
    const result = getExpiringLicenses({ licenses });
    expect(result.find(l => l.number === 'EXPIRED')?.severity).toBe('expired');
    expect(result.find(l => l.number === 'URGENT')?.severity).toBe('urgent');
    expect(result.find(l => l.number === 'SOON')?.severity).toBe('soon');
  });

  it('sorts soonest-first', () => {
    const licenses: ContractorLicense[] = [
      { type: 'hvac', state: 'TX', number: 'far', expiryDate: dateOffset(20) },
      { type: 'epa_608', state: 'TX', number: 'mid', expiryDate: dateOffset(10) },
      { type: 'master_plumber', state: 'TX', number: 'near', expiryDate: dateOffset(2) },
    ];
    const result = getExpiringLicenses({ licenses });
    expect(result.map(l => l.number)).toEqual(['near', 'mid', 'far']);
  });

  it('hasExpiringLicenses returns boolean correctly', () => {
    expect(hasExpiringLicenses({})).toBe(false);
    expect(hasExpiringLicenses({ licenses: [{ type: 'hvac', state: 'TX', number: 'A', expiryDate: dateOffset(15) }] })).toBe(true);
    expect(hasExpiringLicenses({ licenses: [{ type: 'hvac', state: 'TX', number: 'A', expiryDate: dateOffset(90) }] })).toBe(false);
  });

  it('respects custom daysAhead window', () => {
    const licenses: ContractorLicense[] = [
      { type: 'hvac', state: 'TX', number: 'A', expiryDate: dateOffset(60) },
    ];
    expect(getExpiringLicenses({ licenses }, 30).length).toBe(0);
    expect(getExpiringLicenses({ licenses }, 90).length).toBe(1);
  });
});
