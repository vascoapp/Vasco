/**
 * @jest-environment node
 *
 * A NUMBER A CONTRACTOR TYPED
 *
 * `parseFloat("12,50")` is 12. A German expense of € 12,50 was recorded as
 * € 12, "2,5" m of pipe as 2, and on the invoice line editor and the quote
 * builder no price with cents could be typed at all (the separator was eaten
 * per keystroke). Found walking the German Android build, 2026-09-15.
 */

import { parseDecimalInput, formatDecimalInput } from '../decimalInput';
import { parseAmount } from '../validation';

describe('parseDecimalInput — the decimal comma', () => {
  it.each([
    ['12,50', 'DE', 12.5],
    ['12,5', 'NL', 12.5],
    ['0,125', 'DE', 0.125],
    ['12.50', 'DE', 12.5], // a pad that emits a point is still a decimal
    ['12.5', 'UK', 12.5],
    ['85', 'DE', 85],
    [' 1 234,56 ', 'FR', 1234.56],
    ['1 234,56', 'FR', 1234.56],
  ])('%s in %s → %s', (text, country, expected) => {
    expect(parseDecimalInput(text, country)).toBe(expected);
  });
});

describe('parseDecimalInput — thousands', () => {
  it('reads both separators by position', () => {
    expect(parseDecimalInput('1.234,56', 'DE')).toBe(1234.56);
    expect(parseDecimalInput('1,234.56', 'UK')).toBe(1234.56);
    expect(parseDecimalInput('1.234.567', 'DE')).toBe(1234567);
  });

  it("reads the market's own grouping mark + 3 digits as thousands", () => {
    // Was 1.5 through parseFloat and through every `.replace(',', '.')` site.
    expect(parseDecimalInput('1.500', 'DE')).toBe(1500);
    expect(parseDecimalInput('1,500', 'UK')).toBe(1500);
  });

  it('keeps a decimal where the mark is the decimal, or the digits say so', () => {
    expect(parseDecimalInput('1,500', 'DE')).toBe(1.5);
    expect(parseDecimalInput('0.125', 'DE')).toBe(0.125); // leading 0 is never grouped
    expect(parseDecimalInput('1.50', 'DE')).toBe(1.5);
  });
});

describe('parseDecimalInput — mid-typing and junk', () => {
  it('treats a trailing separator as the number so far', () => {
    expect(parseDecimalInput('85,', 'DE')).toBe(85);
    expect(parseDecimalInput('85.', 'UK')).toBe(85);
  });

  it('returns undefined for nothing or not-a-number', () => {
    for (const s of ['', '   ', ',', '-', 'abc', '12a', '€ 12', null, undefined]) {
      expect(parseDecimalInput(s as string, 'DE')).toBeUndefined();
    }
  });

  it('keeps a sign (a change order can be minderwerk)', () => {
    expect(parseDecimalInput('-500,00', 'NL')).toBe(-500);
  });
});

describe('formatDecimalInput', () => {
  it("writes the market's separator, no grouping, at most 2 decimals", () => {
    expect(formatDecimalInput(4369.747899159664, 'DE')).toBe('4369,75');
    expect(formatDecimalInput(4369.747899159664, 'UK')).toBe('4369.75');
    expect(formatDecimalInput(85, 'DE')).toBe('85');
    expect(formatDecimalInput(undefined, 'DE')).toBe('');
  });

  it('shows cents on a fractional amount (the builder showed "185,5")', () => {
    expect(formatDecimalInput(185.5, 'DE', 2, true)).toBe('185,50');
    expect(formatDecimalInput(185.5, 'UK', 2, true)).toBe('185.50');
    expect(formatDecimalInput(85, 'DE', 2, true)).toBe('85');
    expect(formatDecimalInput(4369.747899159664, 'DE', 2, true)).toBe('4369,75');
  });

  it('does not round a 3-decimal quantity to 2 (0,125 m showed "0,13")', () => {
    expect(formatDecimalInput(0.125, 'DE', 3)).toBe('0,125');
    expect(parseDecimalInput(formatDecimalInput(0.125, 'DE', 3), 'DE')).toBe(0.125);
  });

  it('round-trips through the parser in every market', () => {
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT', 'UK', 'US'] as const) {
      for (const n of [0, 1.5, 85.5, 1234.56, 12500]) {
        expect(parseDecimalInput(formatDecimalInput(n, c), c)).toBe(n);
      }
    }
  });
});

it('parseAmount follows the same rule (it read "0,125" as 125)', () => {
  expect(parseAmount('0,125')).toBe(0.125);
  expect(Number.isNaN(parseAmount('abc'))).toBe(true);
});
