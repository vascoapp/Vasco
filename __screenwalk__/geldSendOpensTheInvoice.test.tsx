/**
 * Geld: the paper-plane on a draft invoice opens the invoice — it does not
 * mark it sent.
 *
 * It called markInvoiceSent and then alerted "share the PDF via the invoice
 * screen": the status claimed a send that never happened (the customer had
 * nothing) and started the overdue/reminder clock. The real send — readiness
 * checks, the customer's email, their language — lives on the invoice screen
 * (emulator walk 2026-09-28).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Geld = () => require('../app/(contractor)/geld').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('Geld draft send', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('opens the invoice screen and leaves the invoice a draft', async () => {
    const r = await walkScreen(Geld(), { settlePasses: 14 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const sends = root.findAll((n: any) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('geld-send-') && typeof n.props?.onPress === 'function', { deep: true });
    expect(sends.length).toBeGreaterThan(0); // the demo has a draft invoice
    const btn = sends[sends.length - 1];
    const id = btn.props.testID.slice('geld-send-'.length);

    const draftLabel = (nl as any).invoices?.statusDraft ?? 'Concept';
    const countDraft = () => root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string' && n.props.children.includes(draftLabel), { deep: true }).length;
    const draftsBefore = countDraft();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();
    await act(async () => { btn.props.onPress({ stopPropagation: () => {} }); });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });

    expect(nav.push).toHaveBeenCalledWith(`/invoices/${id}`);
    expect(alert).not.toHaveBeenCalled();
    expect(countDraft()).toBe(draftsBefore); // still a draft — nothing claimed "sent"
    alert.mockRestore();
    teardown(r);
  });
});
