import { isValidIBAN, isValidVATNumber, isValidKvKNumber } from '../validation';

describe('isValidIBAN', () => {
  test.each([
    ['NL91ABNA0417164300', true],   // NL example IBAN with valid checksum
    ['DE89370400440532013000', true], // DE 22-char
    ['FR1420041010050500013M02606', true], // FR 27-char
    ['NL91 ABNA 0417 1643 00', true], // spaces stripped
    ['NL91abna0417164300', true],   // lowercase normalized
  ])('accepts valid IBAN %s', (iban, expected) => {
    expect(isValidIBAN(iban)).toBe(expected);
  });

  test('rejects shape-valid but checksum-invalid IBAN', () => {
    expect(isValidIBAN('NL12ABCD12345678901234')).toBe(false);
  });

  test('rejects wrong-length for known country', () => {
    expect(isValidIBAN('NL91ABNA04171643')).toBe(false); // too short for NL
  });

  test('rejects garbage', () => {
    expect(isValidIBAN('asdfghjkl')).toBe(false);
    expect(isValidIBAN('')).toBe(false);
  });
});

describe('isValidVATNumber', () => {
  test('accepts well-formed NL VAT', () => {
    expect(isValidVATNumber('NL123456789B01')).toBe(true);
    expect(isValidVATNumber('nl 123456789 b01')).toBe(true);
  });

  test('rejects too-short NL VAT (was passing in old regex)', () => {
    expect(isValidVATNumber('NL12')).toBe(false);
  });

  test('accepts well-formed DE/FR/IT/ES/GB VAT', () => {
    expect(isValidVATNumber('DE123456789')).toBe(true);
    expect(isValidVATNumber('FRXX123456789')).toBe(true);
    expect(isValidVATNumber('IT12345678901')).toBe(true);
    expect(isValidVATNumber('ESX1234567X')).toBe(true);
    expect(isValidVATNumber('GB123456789')).toBe(true);
  });

  test('falls through to permissive shape for unenumerated country', () => {
    expect(isValidVATNumber('CY12345678')).toBe(true);
    expect(isValidVATNumber('CY1')).toBe(false);
  });
});

describe('isValidKvKNumber', () => {
  test('accepts 8-digit KvK', () => {
    expect(isValidKvKNumber('12345678')).toBe(true);
  });

  test('rejects wrong length', () => {
    expect(isValidKvKNumber('1234567')).toBe(false);
    expect(isValidKvKNumber('123456789')).toBe(false);
    expect(isValidKvKNumber('1234567a')).toBe(false);
  });
});
