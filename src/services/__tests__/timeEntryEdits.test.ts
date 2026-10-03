// Correcting clocked hours (aannemer walk 2026-10-03): the timesheet entry and
// the job's timeEntries (payroll, labour cost, hours-based invoices) stay in step.
import { parseClockTime, formatClockTime, hoursBetween, jobEntryPatches } from '../timeEntryEdits';

describe('clock times', () => {
  it('reads the ways people type a time, refuses the rest', () => {
    expect(parseClockTime('7:30')).toBe(450);
    expect(parseClockTime('07:30')).toBe(450);
    expect(parseClockTime('7.30')).toBe(450);
    expect(parseClockTime('0730')).toBe(450);
    expect(parseClockTime('24:00')).toBeNull();
    expect(parseClockTime('7:75')).toBeNull();
    expect(parseClockTime('abc')).toBeNull();
    expect(formatClockTime(450)).toBe('07:30');
  });
  it('hours between, minus the break; an inverted pair is refused, not 20 hours', () => {
    expect(hoursBetween('07:30', '16:00')).toBe(8.5);
    expect(hoursBetween('07:30', '16:00', 30)).toBe(8);
    expect(hoursBetween('08:00', '08:20')).toBe(0.33);
    expect(hoursBetween('16:00', '07:30')).toBeNull();
    expect(hoursBetween('08:00', '08:20', 30)).toBeNull();
  });
});

describe('job entries follow the edit', () => {
  const jobs = [
    { id: 'j1', timeEntries: [{ id: 'te-1', date: '2026-10-03', hours: 9, clockIn: '07:00', clockOut: '16:00' }, { id: 'te-x', date: '2026-10-02', hours: 2 }] },
    { id: 'j2', timeEntries: [{ id: 'te-w', date: '2026-10-03', hours: 3, workerId: 'w-piet' }] },
  ];
  it('an edit replaces the entry on its job and recomputes the hours', () => {
    expect(jobEntryPatches(jobs, { id: 'te-1', jobId: 'j1' }, { id: 'te-1', date: '2026-10-03', hours: 4.5, clockIn: '07:00', clockOut: '11:30', jobId: 'j1' }))
      .toEqual([{ jobId: 'j1', actualHours: 6.5, timeEntries: [
        { id: 'te-x', date: '2026-10-02', hours: 2 },
        { id: 'te-1', date: '2026-10-03', hours: 4.5, clockIn: '07:00', clockOut: '11:30' },
      ] }]);
  });
  it('moving an entry to another job takes it off the old one', () => {
    const p = jobEntryPatches(jobs, { id: 'te-1', jobId: 'j1' }, { id: 'te-1', date: '2026-10-03', hours: 9, jobId: 'j2' });
    expect(p.find((x) => x.jobId === 'j1')).toMatchObject({ actualHours: 2 });
    expect(p.find((x) => x.jobId === 'j2')).toMatchObject({ actualHours: 12 });
  });
  it('a delete removes it; a new entry adds it; an entry without a job patches nothing', () => {
    expect(jobEntryPatches(jobs, { id: 'te-1', jobId: 'j1' }, null)).toEqual([{ jobId: 'j1', actualHours: 2, timeEntries: [{ id: 'te-x', date: '2026-10-02', hours: 2 }] }]);
    expect(jobEntryPatches(jobs, null, { id: 'te-new', date: '2026-10-03', hours: 1, jobId: 'j2' })[0]).toMatchObject({ jobId: 'j2', actualHours: 4 });
    expect(jobEntryPatches(jobs, null, { id: 'te-free', date: '2026-10-03', hours: 1, jobId: null })).toEqual([]);
  });
  it("a team member's entry keeps whose it is", () => {
    const p = jobEntryPatches(jobs, { id: 'te-w', jobId: 'j2' }, { id: 'te-w', date: '2026-10-03', hours: 2, jobId: 'j2' });
    expect(p[0].timeEntries[0]).toMatchObject({ id: 'te-w', hours: 2, workerId: 'w-piet' });
  });
});
