import { keyboardOverlap } from '../useKeyboardInset';

// Measured on the device 2026-09-17: the event reported 845 while the IME
// window was 883 tall, so "Hinzufügen" sat 22 px behind the keys.
describe('keyboardOverlap', () => {
  it('uses the distance to the bottom of the screen when the reported height is short', () => {
    expect(keyboardOverlap(845, 1517, 2400)).toBe(883);
  });

  it('keeps the reported height when nothing is missing', () => {
    expect(keyboardOverlap(883, 1517, 2400)).toBe(883);
  });

  it('ignores an implausible screenY rather than flinging the sheet off the top', () => {
    expect(keyboardOverlap(845, 0, 2400)).toBe(845);
  });

  it('ignores a screenY BELOW the keyboard top (overlap smaller than the height)', () => {
    expect(keyboardOverlap(845, 2000, 2400)).toBe(845);
  });

  it('falls back to the height when there is no screenY', () => {
    expect(keyboardOverlap(845, undefined, 2400)).toBe(845);
  });
});
