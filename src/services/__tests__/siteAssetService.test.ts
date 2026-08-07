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
  historyForCustomer,
  siteKeyFromText,
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

describe('customer history — what a maintenance contract can actually ask for', () => {
  // A recurring template stores a customerId and NO address, and job.address is
  // unpopulated on everything addJob() creates. Keying this query on the site
  // would return an empty list on the one screen built to show it.
  it('returns finished work for the customer regardless of address', () => {
    const jobs = [
      job({ title: 'oud', completedAt: '2024-03-02T00:00:00.000Z' }),
      job({ title: 'geen adres', address: undefined, completedAt: '2026-02-01T00:00:00.000Z' }),
      job({ title: 'nieuw', completedAt: '2026-05-01T00:00:00.000Z' }),
    ];
    expect(historyForCustomer(jobs, 'c1').map((j) => j.title))
      .toEqual(['nieuw', 'geen adres', 'oud']);
  });

  it('never leaks another customer’s work', () => {
    const jobs = [job(), job({ customerId: 'c2', title: 'hotel' })];
    expect(historyForCustomer(jobs, 'c1').map((j) => j.title)).toEqual(['CV-ketel onderhoud']);
  });

  it('excludes work that is not finished', () => {
    // "Previous work" must mean done. Showing a scheduled or cancelled job as
    // history tells the contractor they did something they did not.
    const jobs = [
      job({ title: 'gepland', status: 'scheduled' }),
      job({ title: 'bezig', status: 'in-progress' }),
      job({ title: 'geannuleerd', status: 'cancelled' }),
      job({ title: 'gefactureerd', status: 'invoiced' }),
      job({ title: 'betaald', status: 'paid' }),
    ];
    expect(historyForCustomer(jobs, 'c1').map((j) => j.title).sort())
      .toEqual(['betaald', 'gefactureerd']);
  });

  it('returns nothing rather than everything when no customer is selected', () => {
    // The screen renders this list whenever a customer is set. An empty id
    // falling through to "all jobs" would show one customer another's history.
    expect(historyForCustomer([job()], '')).toEqual([]);
  });

  it('falls back to updatedAt when a job was never stamped complete', () => {
    const jobs = [
      job({ title: 'a', completedAt: undefined, updatedAt: '2026-01-01T00:00:00.000Z' }),
      job({ title: 'b', completedAt: undefined, updatedAt: '2026-06-01T00:00:00.000Z' }),
    ];
    expect(historyForCustomer(jobs, 'c1').map((j) => j.title)).toEqual(['b', 'a']);
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

describe('falling back to the customer address', () => {
  // job.address is almost never populated: addJob(title) is the only in-app
  // creation path and passes none. Without this fallback the whole feature
  // matched nothing in production while demoing fine — the job-forms bug again.
  const noAddr = (over: Partial<ProposalJob> = {}): ProposalJob =>
    ({ ...job(), address: undefined, ...over });

  it('proposes from the customer address when the job carries none', () => {
    const jobs = [
      noAddr({ fallbackAddress: 'Prinsengracht 123, Amsterdam' }),
      noAddr({ fallbackAddress: 'Prinsengracht 123, Amsterdam' }),
    ];
    const out = proposeAssets(jobs, [], named);
    expect(out).toHaveLength(1);
    expect(out[0].siteLabel).toBe('Prinsengracht 123, Amsterdam');
  });

  it('still proposes nothing when neither the job nor the customer has one', () => {
    expect(proposeAssets([noAddr(), noAddr()], [], named)).toEqual([]);
  });

  it('normalises the free-text form the same way', () => {
    expect(siteKeyFromText('Prinsengracht 123, Amsterdam'))
      .toBe(siteKeyFromText('prinsengracht123 amsterdam'));
    expect(siteKeyFromText('  ')).toBeNull();
  });

  it('prefers the job address over the customer one when both exist', () => {
    // The job address is the more specific fact: a property manager's jobs
    // happen at their tenants' addresses, not at their office.
    const out = proposeAssets(
      [job({ fallbackAddress: 'Kantoor Herengracht 1' }), job({ fallbackAddress: 'Kantoor Herengracht 1' })],
      [], named,
    );
    expect(out[0].siteLabel).toBe('Prinsengracht 123, Amsterdam');
  });
});
