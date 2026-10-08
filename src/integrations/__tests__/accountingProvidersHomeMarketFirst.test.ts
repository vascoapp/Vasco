// A market's own accounting tools come first (UK walk, 2026-10-08: Twinfield,
// NL-first, sat above Xero and FreeAgent for a UK contractor).
import { getProvidersForCountry } from '../accounting';

it('UK lists Xero and FreeAgent before Twinfield', () => {
  const ids = getProvidersForCountry('UK').map((p) => p.id).filter((id) => id !== 'none');
  expect(ids.indexOf('xero')).toBeLessThan(ids.indexOf('twinfield'));
  expect(ids.indexOf('freeagent')).toBeLessThan(ids.indexOf('twinfield'));
});

it('NL keeps its own order', () => {
  expect(getProvidersForCountry('NL').map((p) => p.id).filter((id) => id !== 'none')[0]).toBe('moneybird');
});
