// Profil read "Abschlussrate 20% · Auftragnehmer-Score 12/100" for a German
// contractor with no unfinished past work: only `completed` counted as done, so
// invoiced/paid jobs did not, and leads + future bookings filled the denominator.
import { computeContractorScore } from '../contractorScore';
import { isJobFinished, isWorkOnDay } from '../jobs';

const TODAY = new Date(2026, 8, 14, 12, 0, 0);

describe('isJobFinished', () => {
  it.each(['completed', 'invoiced', 'paid', 'gereed', 'gefactureerd', 'betaald'])('%s is finished', (s) => {
    expect(isJobFinished(s)).toBe(true);
  });
  it.each(['lead', 'quoted', 'scheduled', 'in-progress', 'cancelled', undefined])('%s is not', (s) => {
    expect(isJobFinished(s as any)).toBe(false);
  });
  it('isWorkOnDay still excludes finished and cancelled jobs', () => {
    expect(isWorkOnDay({ status: 'invoiced', scheduledDate: '2026-09-14' }, '2026-09-14')).toBe(false);
    expect(isWorkOnDay({ status: 'cancelled', scheduledDate: '2026-09-14' }, '2026-09-14')).toBe(false);
    expect(isWorkOnDay({ status: 'scheduled', scheduledDate: '2026-09-14' }, '2026-09-14')).toBe(true);
  });
});

describe('computeContractorScore', () => {
  it('counts invoiced and paid work as completed', () => {
    const r = computeContractorScore([
      { status: 'invoiced', customerId: 'a' },
      { status: 'paid', customerId: 'b' },
      { status: 'completed', customerId: 'c' },
    ], TODAY);
    expect(r.completionRate).toBe(100);
  });

  it('does not count leads, quotes or future bookings against completion', () => {
    const r = computeContractorScore([
      { status: 'paid', customerId: 'a' },
      { status: 'lead', customerId: 'b' },
      { status: 'quoted', customerId: 'c' },
      { status: 'scheduled', customerId: 'd', scheduledDate: '2026-09-20' },
      { status: 'in-progress', customerId: 'e', scheduledDate: '2026-09-14' },
    ], TODAY);
    expect(r.completionRate).toBe(100);
  });

  it('does count active work whose date has passed', () => {
    const r = computeContractorScore([
      { status: 'paid', customerId: 'a' },
      { status: 'scheduled', customerId: 'b', scheduledDate: '2026-09-01' },
    ], TODAY);
    expect(r.completionRate).toBe(50);
  });

  it('has no score without finished work', () => {
    const r = computeContractorScore([{ status: 'lead', customerId: 'a' }], TODAY);
    expect(r.score).toBeNull();
    expect(r.completionRate).toBeNull();
  });
});
