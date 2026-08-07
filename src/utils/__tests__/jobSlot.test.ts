// The bug these guard against: using `estimatedDuration` (whole-job) where a
// day length is meant. It produced "24u" beside a 13:30–17:00 slot, a planner
// block running to "37:00", and a week day totalling "27h".

import { slotHours, slotHoursOr, bookedHours } from '../jobSlot';

const badkamer = { scheduledStartTime: '13:30', scheduledEndTime: '17:00', estimatedDuration: 24 };
const cvKetel = { scheduledStartTime: '09:00', scheduledEndTime: '12:00', estimatedDuration: 3 };

describe('slotHours', () => {
  it('measures the slot, not the whole-job estimate', () => {
    // The whole job is 24h; today it occupies 3.5.
    expect(slotHours(badkamer)).toBe(3.5);
  });

  it('handles a whole-hour slot', () => {
    expect(slotHours(cvKetel)).toBe(3);
  });

  it('is null when either end of the slot is missing', () => {
    expect(slotHours({ scheduledStartTime: '09:00', estimatedDuration: 8 })).toBeNull();
    expect(slotHours({ scheduledEndTime: '17:00', estimatedDuration: 8 })).toBeNull();
    expect(slotHours({ estimatedDuration: 8 })).toBeNull();
  });

  it('is null for an end at or before the start rather than a negative span', () => {
    expect(slotHours({ scheduledStartTime: '17:00', scheduledEndTime: '09:00' })).toBeNull();
    expect(slotHours({ scheduledStartTime: '09:00', scheduledEndTime: '09:00' })).toBeNull();
  });

  it('is null for unparseable times', () => {
    expect(slotHours({ scheduledStartTime: 'later', scheduledEndTime: '17:00' })).toBeNull();
  });

  it('tolerates null fields', () => {
    expect(slotHours(null)).toBeNull();
    expect(slotHours({ scheduledStartTime: null, scheduledEndTime: null })).toBeNull();
  });
});

describe('slotHoursOr', () => {
  it('prefers the slot over the estimate', () => {
    expect(slotHoursOr(badkamer, 2)).toBe(3.5);
  });

  it('falls back to the estimate, then the default', () => {
    expect(slotHoursOr({ estimatedDuration: 8 }, 2)).toBe(8);
    expect(slotHoursOr({}, 2)).toBe(2);
  });
});

describe('bookedHours', () => {
  it('sums a day to something that fits in a day', () => {
    // This exact pair rendered as "27h" when summed by estimatedDuration.
    expect(bookedHours([cvKetel, badkamer])).toBe(6.5);
  });

  it('counts only jobs whose slot is known, rather than inventing one', () => {
    expect(bookedHours([cvKetel, { estimatedDuration: 24 }])).toBe(3);
  });

  it('is 0 for an empty day', () => {
    expect(bookedHours([])).toBe(0);
  });
});
