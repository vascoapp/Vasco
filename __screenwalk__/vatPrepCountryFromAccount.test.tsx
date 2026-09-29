/**
 * BTW-voorbereiding takes the country from the profile, then the account.
 *
 * It read the profile only, so the NL demo contractor (country on the
 * ACCOUNT) was told "Btw-aangifte hier niet beschikbaar" directly above
 * "Vasco bereidt de Nederlandse btw-aangifte voor" (emulator walk 2026-09-28).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const VatPrep = () => require('../app/contractor/vat-prep').default;

describe('vat prep, NL contractor without a profile country', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('prepares the Dutch return instead of refusing', async () => {
    const r = await walkScreen(VatPrep(), { settlePasses: 12, as: 'contractor' });
    expect(r.error).toBeNull();
    const texts: string[] = (r.tree as any).root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
      .map((n: any) => [].concat(n.props.children).join(''));
    const v = (nl as any).vatPrep;
    expect(texts).not.toContain(v.unsupportedTitle);
    expect(texts).not.toContain(v.needCountry);
    teardown(r);

    // The NL demo seed now carries its country (2026-09-29), so the render
    // above no longer exercises the ACCOUNT fallback by itself. Pin it: a
    // profile without a country must still fall back to the account.
    const fs = require('fs');
    const path = require('path');
    const { stripComments } = require('../src/utils/stripComments');
    const src = stripComments(fs.readFileSync(path.join(__dirname, '../app/contractor/vat-prep.tsx'), 'utf8'));
    expect(src).toMatch(/businessProfile\?\.country\s*\?\?\s*user\?\.country/);
  });
});
