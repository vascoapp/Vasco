// =============================================================================
// SITE ASSETS
// =============================================================================
// Two things must hold. Addresses must decide site identity correctly, because
// merging two properties into one asset produces a service record that is wrong
// about someone's boiler. And nothing may be recorded without the contractor
// saying so — proposals are questions, not entries.
// =============================================================================

import {
  siteKeyFor,
  proposeAssets,
  historyForSite,
  nextServiceDue,
  MIN_VISITS_TO_PROPOSE,
  type ProposalJob,
  type SiteAsset,
} from '../siteAssetService';

const named = (id: string) => (id === 'c1' ? 'Emma de Vries' : id === 'c2' ? 'Hotel NH' : undefined);

const job = (over: Partial<ProposalJob> = {}): ProposalJob => ({
  customerId: 'c1',
  title: 'CV-ketel onderhoud',
  status: 'completed',
  completedAt: '2026-01-01T00:00:00.000Z',
  address: { street: 'Prinsengracht 123', postcode: '1015 DT', city: 'Amsterdam' },
  ...over,
});

describe('site identity', () => {
  it('ignores spacing, case and punctuation', () => {
    expect(siteKeyFor({ street: 'Prinsengracht 123', postcode: '1015 DT' }))
      .toBe(siteKeyFor({ street: 'prinsengracht-123', postcode: '1015dt' }));
  });

  it('keeps neighbours apart by house number', () => {
    // The number lives in the street line. Losing it would merge number 12 and
    // number 14 into one boiler.
    expect(siteKeyFor({ street: 'Prinsengracht 12', postcode: '1015 DT' }))
      .not.toBe(siteKeyFor({ street: 'Prinsengracht 14', postcode: '1015 DT' }));
  });

  it('refuses a postcode with no street', () => {
    // A Dutch postcode covers one side of a street, so it would merge
    // neighbours into a single asset.
    expect(siteKeyFor({ postcode: '1015 DT' })).toBeNull();
  });

  it('is null when there is no address at all', () => {
    expect(siteKeyFor(undefined)).toBeNull();
    expect(siteKeyFor({})).toBeNull();
  });
});

describe('proposals are questions, not records', () => {
  it('proposes a site visited more than once', () => {
    const out = proposeAssets([job(), job({ completedAt: '2026-06-01T00:00:00.000Z' })], [], named);
    expect(out).toHaveLength(1);
    expect(out[0].visits).toBe(2);
    expect(out[0].customerName).toBe('Emma de Vries');
    expect(MIN_VISITS_TO_PROPOSE).toBe(2);
  });

  it('stays quiet about a one-off visit', () => {
    // One job at an address is not evidence that something there needs
    // servicing; asking would be noise on every customer they ever had.
    expect(proposeAssets([job()], [], named)).toEqual([]);
  });

  it('stops proposing once an asset is registered there', () => {
    const existing: SiteAsset[] = [{
      id: 'a1', customerId: 'c1', siteKey: siteKeyFor(job().address)!,
      siteLabel: 'Prinsengracht 123', name: 'CV-ketel', category: 'heating',
      createdAt: '', updatedAt: '',
    }];
    expect(proposeAssets([job(), job()], existing, named)).toEqual([]);
  });

  it('ignores work that never happened', () => {
    const out = proposeAssets([job({ status: 'scheduled' }), job({ status: 'draft' })], [], named);
    expect(out).toEqual([]);
  });

  it('skips a customer it cannot name', () => {
    // A proposal reads "you have been to X three times" — with no name there is
    // nobody to put in the sentence, and a raw id is not an answer.
    expect(proposeAssets([job({ customerId: 'unknown' }), job({ customerId: 'unknown' })], [], named)).toEqual([]);
  });

  it('carries the contractor’s own job titles, unedited', () => {
    const out = proposeAssets([
      job({ title: 'CV-ketel onderhoud' }),
      job({ title: 'Radiator vervangen' }),
    ], [], named)[0];
    // The proposal must not invent what the asset IS — it shows what was done
    // and lets the contractor name it.
    expect(out.recentWork).toEqual(['CV-ketel onderhoud', 'Radiator vervangen']);
  });

  it('ranks the most-visited site first', () => {
    const other = { street: 'Herengracht 500', postcode: '1017 CB', city: 'Amsterdam' };
    const out = proposeAssets(
      [job(), job(), job(), job({ address: other }), job({ address: other })],
      [], named,
    );
    expect(out.map((p) => p.visits)).toEqual([3, 2]);
  });
});

describe('site history', () => {
  it('returns only that site, newest first', () => {
    const other = { street: 'Herengracht 500', postcode: '1017 CB' };
    const jobs = [
      job({ title: 'oud', completedAt: '2025-01-01T00:00:00.000Z' }),
      job({ title: 'nieuw', completedAt: '2026-01-01T00:00:00.000Z' }),
      job({ title: 'elders', address: other }),
    ];
    const out = historyForSite(jobs, 'c1', siteKeyFor(job().address)!);
    expect(out.map((j) => j.title)).toEqual(['nieuw', 'oud']);
  });
});

describe('next service due', () => {
  const asset: SiteAsset = {
    id: 'a1', customerId: 'c1', siteKey: 'k', siteLabel: 'x',
    name: 'CV-ketel', category: 'heating', createdAt: '', updatedAt: '',
  };

  it('is null when the contractor has not set an interval', () => {
    // A guessed service schedule on someone else's boiler is a claim we cannot
    // support — annual is a convention, not a fact about this unit.
    expect(nextServiceDue(asset, '2026-01-01T00:00:00.000Z')).toBeNull();
  });

  it('is null when the site has never been visited', () => {
    expect(nextServiceDue({ ...asset, serviceIntervalMonths: 12 }, undefined)).toBeNull();
  });

  it('adds the interval to the last visit', () => {
    const due = nextServiceDue({ ...asset, serviceIntervalMonths: 12 }, '2026-01-15T00:00:00.000Z');
    expect(due?.slice(0, 10)).toBe('2027-01-15');
  });
});
