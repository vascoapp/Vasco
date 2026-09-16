/**
 * @jest-environment node
 *
 * The small-business thresholds a contractor is shown, and what the app DOES
 * with them.
 *
 * Germany's §19 UStG limits changed on 1 Jan 2025 (Jahressteuergesetz 2024):
 * €22.000 prior / €50.000 current became €25.000 prior / €100.000 current, and
 * crossing €100.000 mid-year ends the exemption for that very sale. The app
 * still showed the repealed pair in the advisor, on the USt & audit screen and
 * in six locales — and onboarding SILENTLY put every German solo sole trader
 * on Kleinunternehmer, i.e. every invoice issued without VAT (#339).
 *
 * NL KOR is €20.000 (that figure was right) but additionally requires
 * registering with the Belastingdienst, which the copy never said.
 */
import fs from 'fs';
import path from 'path';
import { suggestVatScheme } from '../vatSchemeAdvisor';
import { stripComments } from '../../utils/stripComments';

const ROOT = path.resolve(__dirname, '../../..');
const LOCALES = ['de', 'en', 'en-US', 'nl', 'fr', 'es', 'it'];
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('the German limits are the 2025 ones', () => {
  const SOURCES = ['src/services/vatSchemeAdvisor.ts', 'app/contractor/vat-and-audit.tsx', 'src/domain/business.ts'];

  it.each(SOURCES)('%s does not quote the repealed €22k/€50k pair', (rel) => {
    // Comments stripped: these files explain the repeal, and the explanation
    // names the old numbers on purpose.
    const src = stripComments(read(rel));
    expect(src).not.toMatch(/22[.,]000|€22k/);
    expect(src).not.toMatch(/50[.,]000|€50k/);
  });

  it.each(LOCALES)('%s states 25.000 / 100.000 for Kleinunternehmer', (loc) => {
    const j = JSON.parse(read(`src/i18n/locales/${loc}.json`));
    const advisor = j.vatScheme.advisor.kleinDe as string;
    expect(advisor).toMatch(/25[.,\s]000/);
    expect(advisor).toMatch(/100[.,\s]000/);
    expect(advisor).not.toMatch(/22[.,\s]000|50[.,\s]000/);
    expect(j.onboarding.vatPresetKlein).toMatch(/25[.,\s]000/);
  });

  it.each(LOCALES)('%s says KOR needs the Belastingdienst registration', (loc) => {
    const j = JSON.parse(read(`src/i18n/locales/${loc}.json`));
    expect(j.vatScheme.advisor.korNl).toMatch(/Belastingdienst/);
  });
});

describe('the advisor suggests; it never decides', () => {
  it('still recommends Kleinunternehmer for a German solo sole trader', () => {
    const a = suggestVatScheme({ country: 'DE', businessType: 'einzelunternehmen', teamSize: 'solo' });
    expect(a.suggested).toBe('small_business_DE_kleinunternehmer');
    expect(a.reason).toMatch(/25\.000/);
    expect(a.reason).toMatch(/100\.000/);
  });

  it('is standard for anyone else', () => {
    expect(suggestVatScheme({ country: 'DE', businessType: 'gmbh', teamSize: 'solo' }).suggested).toBe('standard');
    expect(suggestVatScheme({ country: 'DE', businessType: 'einzelunternehmen', teamSize: 'small' }).suggested).toBe('standard');
  });

  it('onboarding does not apply the suggestion', () => {
    // A tax scheme is a declaration to a tax office, not a default.
    expect(read('app/onboarding.tsx')).toMatch(/const vatSchemeToApply = 'standard';/);
  });
});
