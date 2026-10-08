/**
 * The built-in quote templates are Dutch content (NL prices, NL VAT 9 %/21 %).
 * UK walk, 2026-10-08: they were offered to every market, so a UK quote built
 * from "Annual boiler maintenance" carried 9 % + 21 % VAT. Offered to NL only;
 * an unknown market is not presumed Dutch; a contractor's own templates stay.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { quoteTemplateService, BUILTIN_TEMPLATES_MARKET } from '../quoteTemplateService';

it('a Dutch contractor gets the built-ins', () => {
  expect(BUILTIN_TEMPLATES_MARKET).toBe('NL');
  expect(quoteTemplateService.getTemplates(undefined, 'NL').length).toBeGreaterThan(10);
});

it('a UK contractor, or an unknown market, gets none of them', () => {
  expect(quoteTemplateService.getTemplates(undefined, 'UK')).toEqual([]);
  expect(quoteTemplateService.getTemplates(undefined, 'DE')).toEqual([]);
  expect(quoteTemplateService.getTemplates(undefined, undefined)).toEqual([]);
});

it("a contractor's own template is theirs in any market", () => {
  const own = quoteTemplateService.saveTemplate('Boiler service', 'cv-onderhoud' as any,
    [{ description: 'Service', quantity: 1, unit: 'pcs', unitPrice: 95.5, vatRate: 20, type: 'labour' }]);
  const ids = quoteTemplateService.getTemplates(undefined, 'UK').map((t) => t.id);
  expect(ids).toContain((own as any).id ?? quoteTemplateService.getTemplates(undefined, 'UK')[0]?.id);
  expect(ids.length).toBe(1);
});
