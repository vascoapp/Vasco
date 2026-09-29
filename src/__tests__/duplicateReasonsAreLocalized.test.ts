// The duplicate-customer dialog said "Identical name" to a Dutch contractor
// (walk, 2026-09-29) — the reasons were English literals.
import appI18n from '../i18n/i18n';
import { findDuplicates } from '../services/customerDedupService';

const existing = [{ id: 'c1', name: 'Aannemersbedrijf Hoekstra BV', email: 'a@b.nl', phone: '0205551234' }] as any;

afterAll(async () => { await appI18n.changeLanguage('en'); });

it('reasons follow the language', async () => {
  await appI18n.changeLanguage('nl');
  const [hit] = findDuplicates({ name: 'Aannemersbedrijf Hoekstra BV', email: 'a@b.nl' }, existing);
  expect(hit.reasons).toEqual(['Zelfde e-mail', 'Zelfde naam']);
  await appI18n.changeLanguage('de');
  const [de] = findDuplicates({ name: 'Aannemersbedrijf Hoekstra BV' }, existing);
  expect(de.reasons).toEqual(['Gleicher Name']);
});
