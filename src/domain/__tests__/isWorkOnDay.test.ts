// One rule for "is this work happening on that day?" — shared by the end-of-day
// pack and the queue's "no jobs tomorrow" card, which used to disagree.
import { isWorkOnDay } from '../jobs';

describe('isWorkOnDay', () => {
  const day = '2026-05-11';

  it('counts open work dated that day', () => {
    for (const status of ['scheduled', 'accepted', 'in-progress']) {
      expect(isWorkOnDay({ status, scheduledDate: day }, day)).toBe(true);
    }
    expect(isWorkOnDay({ status: 'scheduled', scheduledDate: `${day}T09:00:00` }, day)).toBe(true);
    expect(isWorkOnDay({ status: 'scheduled', startDate: day }, day)).toBe(true);
  });

  it('does not count work that was called off or is already done', () => {
    for (const status of ['cancelled', 'completed', 'gereed', 'invoiced', 'paid']) {
      expect(isWorkOnDay({ status, scheduledDate: day }, day)).toBe(false);
    }
  });

  it('does not count a job on another day, or with no date', () => {
    expect(isWorkOnDay({ status: 'scheduled', scheduledDate: '2026-05-12' }, day)).toBe(false);
    expect(isWorkOnDay({ status: 'scheduled' }, day)).toBe(false);
  });
});
