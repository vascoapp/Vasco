/**
 * A certificate about to expire, as the contractor sees it (device pass
 * 2026-10-14, NL real account, VCA Basis expiring in 6 days):
 *  - "Komende vervaldatums" listed it as "VCA Basis ()" — the name was glued to
 *    an empty holder;
 *  - the date read "20 okt 2026 (6d)" — an English unit letter in every
 *    language (German is "6 T.");
 *  - the "Acties vereist" card had a chevron and did nothing on tap — it now
 *    opens the certificate it is about;
 *  - its accessibility label was English ("high alert: …").
 *
 * Walked in GERMAN on purpose: Dutch `daysCompact` is also "{{count}}d", so a
 * Dutch walk cannot tell the fixed screen from the broken one.
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import de from '../src/i18n/locales/de.json';

const Certificaten = () => require('../app/(contractor)/certificaten').default;

const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

describe('Certificaten — a certificate expiring soon', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('reads right, in the market language, and its action card opens it', async () => {
    const r = await walkScreen(Certificaten(), { settlePasses: 10, as: 'handwerker' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const { act } = require('react-test-renderer');
    const c = (de as any).compliance;
    const sheet = (de as any).complianceSheet;
    const texts = (): string[] => root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children);
    const pressable = (label: string) => root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((m: any) => m.props?.children === label, { deep: true }).length > 0, { deep: true })[0];

    // Add a certificate expiring in 6 days, through the real sheet.
    const in6 = new Date(); in6.setDate(in6.getDate() + 6);
    await act(async () => { pressable(c.addCertificate).props.onPress(); });
    const input = (ph: string) => root.findAll((n: any) => typeof n.props?.onChangeText === 'function' && n.props?.placeholder === ph, { deep: true })[0];
    await act(async () => { input(sheet.namePlaceholder).props.onChangeText('Schweißerprüfung'); });
    await act(async () => { input(sheet.datePlaceholder).props.onChangeText(ddmmyyyy(in6)); });
    const save = root.findAll((n: any) => n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function'
      && n.findAll((m: any) => m.props?.children === (de as any).common.save, { deep: true }).length > 0, { deep: true })[0];
    await act(async () => { save.props.onPress(); });

    // The agent raises the expiry alert (it runs on a schedule in the app).
    await act(async () => { await require('../src/services/complianceAgentService').scan(); });

    // Upcoming expiries: the name alone, and the German unit.
    const after = texts();
    expect(after).toContain('Schweißerprüfung');
    expect(after.filter((t) => t.includes('()'))).toEqual([]);
    const dateLines = root.findAll((n: any) => typeof n.type === 'string', { deep: true })
      .map((n: any) => [].concat(n.props?.children ?? []).filter((x: any) => typeof x === 'string' || typeof x === 'number').join(''))
      .filter((s: string) => /\(\d+[^)]*\)$/.test(s));
    expect(dateLines.length).toBeGreaterThan(0);
    for (const l of dateLines) expect(l).not.toMatch(/\d+d\)$/);
    expect(dateLines.some((l: string) => l.endsWith('(6 T.)'))).toBe(true);

    // The action card: labelled in German, and it OPENS the certificate.
    const card = root.findAll((n: any) => n.props?.accessibilityRole === 'button' && typeof n.props?.accessibilityLabel === 'string'
      && n.props.accessibilityLabel.includes('Schweißerprüfung') && typeof n.props?.onPress === 'function', { deep: true })[0];
    expect(card).toBeDefined();
    expect(card.props.accessibilityLabel).not.toMatch(/alert:/i);
    // …and says how long is left, like the card does (`Noch 6 Tage`).
    expect(card.props.accessibilityLabel).toContain(c.daysLeftCount_other.replace('{{count}}', '6'));
    const openModals = () => root.findAll((n: any) => n.props?.visible === true && n.props?.animationType !== undefined, { deep: true }).length;
    const before = openModals();
    await act(async () => { card.props.onPress(); });
    expect(openModals()).toBeGreaterThan(before);
    teardown(r);
  });
});
