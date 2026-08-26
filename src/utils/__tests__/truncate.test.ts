import { truncateAtWord } from '../truncate';

// The AI queue card previews the message it has drafted. `resolved.slice(0,100)`
// cut wherever character 100 landed, so a German card read "…Könnten Sie sie
// diese Woc" — and the contractor cannot tell from that whether the DRAFT is
// broken or only the preview is.
describe('truncateAtWord', () => {
  it('leaves anything within budget alone', () => {
    expect(truncateAtWord('Short message', 100)).toBe('Short message');
  });

  it('breaks at a word and marks the cut', () => {
    const s = 'Hallo Kunde, Rechnung I0042 ist seit 7 Tagen offen. Könnten Sie sie diese Woche begleichen?';
    const out = truncateAtWord(s, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('…')).toBe(true);
    // The defect itself: no half-word before the ellipsis.
    expect(out).not.toMatch(/\w…$/);
    expect(s.startsWith(out.slice(0, -1))).toBe(true);
  });

  it('counts the ellipsis inside the budget', () => {
    expect(truncateAtWord('a'.repeat(200), 20).length).toBeLessThanOrEqual(20);
  });

  it('hard-cuts a single unbroken token rather than blowing the limit', () => {
    // A URL, or a German compound with no space in it: there is no word
    // boundary to find, and returning the whole thing would defeat the point.
    const out = truncateAtWord('Donaudampfschifffahrtsgesellschaftskapitaen', 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith('…')).toBe(true);
  });

  it('does not break so early that the preview says nothing', () => {
    // "A B_______________..." — breaking at the last space would leave "A…".
    const out = truncateAtWord(`A ${'b'.repeat(80)} c`, 40);
    expect(out.length).toBeGreaterThan(30);
  });

  it('handles empty and nullish input', () => {
    expect(truncateAtWord('', 10)).toBe('');
    expect(truncateAtWord(null, 10)).toBe('');
    expect(truncateAtWord(undefined, 10)).toBe('');
  });
});
