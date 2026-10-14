/**
 * Certificate day counts, said as one sentence (review 2026-10-14). The detail
 * glued "Nog" + n + "dagen" / n + "dagen geleden verlopen": the expiry day — the
 * certificate's last VALID day — read "0 dagen geleden verlopen", one day left
 * read "Nog 1 dagen", and French/Italian fragments made no sentence at all.
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Certificaten = () => require('../app/(contractor)/certificaten').default;
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

describe('Certificaten — day counts', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('one day left reads in the singular', async () => {
    const r = await walkScreen(Certificaten(), { settlePasses: 10 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const { act } = require('react-test-renderer');
    const c = (nl as any).compliance;
    const sheet = (nl as any).complianceSheet;
    const texts = (): string[] => root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children);
    const pressable = (label: string) => root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((m: any) => m.props?.children === label, { deep: true }).length > 0, { deep: true })[0];

    const day = new Date(); day.setDate(day.getDate() + 1);
    await act(async () => { pressable(c.addCertificate).props.onPress(); });
    const input = (ph: string) => root.findAll((n: any) => typeof n.props?.onChangeText === 'function' && n.props?.placeholder === ph, { deep: true })[0];
    await act(async () => { input(sheet.namePlaceholder).props.onChangeText('VCA Basis'); });
    await act(async () => { input(sheet.datePlaceholder).props.onChangeText(ddmmyyyy(day)); });
    const save = root.findAll((n: any) => n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function'
      && n.findAll((m: any) => m.props?.children === (nl as any).common.save, { deep: true }).length > 0, { deep: true })[0];
    await act(async () => { save.props.onPress(); });

    // Open its detail from the list.
    const row = root.findAll((n: any) => typeof n.props?.onPress === 'function' && n.props?.accessibilityRole === 'button'
      && typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('VCA Basis'), { deep: true });
    expect(row.length).toBeGreaterThan(0);
    await act(async () => { row[row.length - 1].props.onPress(); });

    const all = texts();
    expect(all.filter((t) => /\b0 dag/.test(t))).toEqual([]);
    expect(all.filter((t) => /\b1 dagen\b/.test(t))).toEqual([]);
    expect(all).toContain(c.daysLeftCount_one.replace('{{count}}', '1'));
    teardown(r);
  });
});
