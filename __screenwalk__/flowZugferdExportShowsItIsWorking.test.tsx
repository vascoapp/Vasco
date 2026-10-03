/**
 * The ZUGFeRD / Factur-X hybrid is built on the device and took ~20 s on the
 * emulator with nothing on screen (device pass, 2026-10-02): a contractor taps
 * again and gets a second file. While it builds, the row shows a spinner and
 * a second tap builds nothing.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';
import { DE_BUSINESS_PROFILE } from '../src/data/mockBusiness';

let mockRelease: (() => void) | null = null;
const mockBuild = jest.fn(() => new Promise<{ bytes: Uint8Array; xml: string }>((res) => {
  mockRelease = () => res({ bytes: new Uint8Array([37, 80, 68, 70]), xml: '<x/>' });
}));
const mockShare = jest.fn(async (..._a: any[]) => undefined);

jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...a: any[]) => mockShare(...a) }));
// Spread the actual module: the screen loads these with `await import()`, and
// under the screen config a bare factory object fails as "Unexpected import
// statement in CJS module" (the requireActual shape works).
jest.mock('../src/integrations/pdfA3Invoice', () => ({ ...jest.requireActual('../src/integrations/pdfA3Invoice'), buildPdfA3Invoice: () => mockBuild() }));
jest.mock('../src/services/pdfA3Fonts', () => ({ ...jest.requireActual('../src/services/pdfA3Fonts'), loadPdfA3Fonts: async () => ({ regular: new Uint8Array(), bold: new Uint8Array() }) }));
jest.mock('../src/services/complianceGatingService', () => ({
  ...jest.requireActual('../src/services/complianceGatingService'),
  canUseEInvoiceFormat: () => ({ allowed: true }),
}));
jest.mock('../src/utils/businessProfileValidation', () => ({
  ...jest.requireActual('../src/utils/businessProfileValidation'),
  checkInvoiceReadiness: () => ({ ready: true, missingLabels: [], invalidLabels: [] }),
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const LABEL = (nl as any).invoices.exportZugferd as string;

run('ZUGFeRD export while the PDF builds', () => {
  it('shows a spinner and ignores a second tap', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...DE_BUSINESS_PROFILE, country: 'DE', language: 'nl' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-de', name: 'Stefan Weber', email: 'weber@example.de', address: 'Ring 1', postcode: '50667', city: 'Köln', country: 'DE' }]));
    // deliveryDate: the date of the work is stated, so a German invoice does not
    // stop to ask for it (flowGermanInvoiceAsksForTheServiceDate covers the ask).
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-Z-1', customerId: 'c-de', customer: 'Stefan Weber', job: 'Wartung', amount: 119, status: 'sent', dueInDays: 14, deliveryDate: '2026-09-30' },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rnShare = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'dismissedAction' } as any));

    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-Z-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const row = () => {
      const all = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === LABEL, { deep: true }).length > 0, { deep: true });
      return all[all.length - 1];
    };
    const busy = () => root.findAll((n: any) => n.props?.testID === 'action-row-busy', { deep: true }).length > 0;
    expect(busy()).toBe(false);

    let first: Promise<void> | undefined;
    await act(async () => { first = row().props.onPress(); });
    await settle();
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(busy()).toBe(true);

    // A second tap while it builds: nothing new.
    await act(async () => { row().props.onPress(); });
    await settle();
    expect(mockBuild).toHaveBeenCalledTimes(1);

    await act(async () => { mockRelease!(); });
    await settle();
    await act(async () => { await first; });
    // Built ONCE for two taps. (The share itself writes a file, which jest's
    // expo-file-system cannot; it is verified on the device, 2026-10-02.)
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(busy()).toBe(false);
    alert.mockRestore();
    rnShare.mockRestore();
    teardown(r);
  });
});
