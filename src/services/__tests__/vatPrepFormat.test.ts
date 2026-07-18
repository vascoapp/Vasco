/**
 * @jest-environment node
 */
import { formatVatClassification } from '../vatPrepService';

describe('formatVatClassification', () => {
  test('NL Belastingdienst rubrieken render as "Rubriek 1a"', () => {
    expect(formatVatClassification('rubriek_1a')).toBe('Rubriek 1a');
    expect(formatVatClassification('rubriek_1b')).toBe('Rubriek 1b');
  });
  test('DE UStVA Kennziffern render as "Kz. 81"', () => {
    expect(formatVatClassification('kz_81')).toBe('Kz. 81');
    expect(formatVatClassification('kz_35')).toBe('Kz. 35');
  });
  test('never leaks a raw underscore key to the screen', () => {
    for (const code of ['rubriek_1a', 'kz_81', 'something_else']) {
      expect(formatVatClassification(code)).not.toContain('_');
    }
  });
  test('empty input is safe', () => {
    expect(formatVatClassification('')).toBe('');
  });
});
