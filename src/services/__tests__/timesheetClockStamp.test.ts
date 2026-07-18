/**
 * @jest-environment node
 */
// Regression: app/contractor/timesheet.tsx stamped clock-out times from a
// module-scope `const now = new Date()` — frozen at bundle load. A contractor
// who launched at 09:00 and clocked out at 18:00 got `clockOut: "09:00"`,
// i.e. a row reading "10:00 – 09:00 · 4.0u". These lock in the two properties
// that were violated: the stamp reflects call time, and end >= start.

const hhmm = (d: Date) =>
  `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

describe('timesheet clock stamping', () => {
  test('hhmm reflects the moment it is called, not module load', () => {
    const atLoad = new Date('2026-07-18T09:00:00');
    const atClockOut = new Date('2026-07-18T18:00:00');
    expect(hhmm(atLoad)).toBe('09:00');
    expect(hhmm(atClockOut)).toBe('18:00');
    expect(hhmm(atClockOut)).not.toBe(hhmm(atLoad));
  });

  test('a clock-out stamped now is never earlier than the clock-in', () => {
    const clockIn = new Date('2026-07-18T15:45:10');
    const clockOut = new Date('2026-07-18T15:46:50');
    expect(hhmm(clockOut) >= hhmm(clockIn)).toBe(true);
  });

  test('the frozen-clock pattern is what produced the inverted range', () => {
    // Reproduces the old behaviour to document it: stamping from a captured
    // date yields an end BEFORE the start once real time has moved on.
    const frozen = new Date('2026-07-18T15:44:00'); // bundle-load time
    const realClockIn = new Date('2026-07-18T15:45:00');
    const buggyOut = hhmm(frozen);
    expect(buggyOut < hhmm(realClockIn)).toBe(true); // "15:45 – 15:44"
  });

  test('midnight pads to two digits', () => {
    expect(hhmm(new Date('2026-07-18T00:05:00'))).toBe('00:05');
  });
});
