/**
 * @jest-environment node
 */
// A success message must have something to be about.
//
// The dunning card's "Verstuur nu" button was a toast and nothing else — its
// whole handler was `setToast('Herinnering verstuurd naar {name}')`. The
// contractor was told an escalation had gone out on an overdue invoice; the
// customer got nothing and the clock kept running (#197's shape, still
// unguarded when the 2026-09-18 sweep found it).
//
// And the timeline above that button painted its steps from the CALENDAR:
// `isPast ? {sentDate, status:'sent'} : 'pending'`, so a 40-day-overdue invoice
// showed four green "sent" dots for reminders nobody had sent. In Germany and
// the Netherlands a Mahnung is the precondition for statutory interest and
// collection costs, which makes that a false legal record.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** Screens a contractor actually reaches. */
const DIRS = ['app/contractor', 'app/(contractor)', 'app/quotes', 'app/invoices', 'app/(modals)'];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(rel);
    return e.name.endsWith('.tsx') ? [rel] : [];
  });
}

/** `onPress={() => setToast(...)}` / `onPress={() => Alert.alert(...)}` — one expression, no call but the claim. */
const ONLY_A_CLAIM = /onPress=\{\(\)\s*=>\s*(setToast|Alert\.alert)\s*\(/g;

/** Words that assert the thing already happened, in the six shipped languages. */
const CLAIMS_DONE = /(verstuurd|verzonden|gestuurd|sent|gesendet|versendet|envoyé|enviado|inviato|opgeslagen|saved|gespeichert|besteld|ordered|bestellt|exported|geëxporteerd)/i;

describe('a success message has something to be about', () => {
  const files = DIRS.flatMap(walk);

  it('reads the contractor screens', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('no press handler is ONLY a claim that something was done', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const src = read(rel);
      for (const m of src.matchAll(ONLY_A_CLAIM)) {
        // The whole arrow body: from the `(` of the call to its matching `)`.
        const from = m.index ?? 0;
        const body = src.slice(from, from + 600);
        const end = body.indexOf('}}');
        const handler = end === -1 ? body : body.slice(0, end);
        if (!CLAIMS_DONE.test(handler)) continue;
        offenders.push(`${rel}: ${handler.replace(/\s+/g, ' ').slice(0, 110)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the dunning ladder does not invent a send', () => {
  const svc = read('src/services/collectionsAgentService.ts');

  // Scoped to the DERIVATION. The demo fixtures above it may show a sent step —
  // they are a mock of a sequence that happened, and DEMO_MODE gates them.
  const derive = (() => {
    const at = svc.indexOf('function deriveDunningSequences');
    expect(at).toBeGreaterThan(-1);
    const end = svc.indexOf('\nexport ', at + 10);
    return svc.slice(at, end === -1 ? undefined : end);
  })();

  it('the derivation reads long enough to contain the step builder', () => {
    expect(derive.length).toBeGreaterThan(400);
    expect(derive).toMatch(/dayOffsets/);
  });

  it('never derives "sent" from the calendar', () => {
    expect(derive).not.toMatch(/status:\s*'sent'/);
    // …and the step that is overdue is DUE, which is a prompt, not a record.
    expect(derive).toMatch(/isPast \? \('due' as const\)/);
  });

  it('never stamps a sentDate it did not observe', () => {
    expect(derive).not.toMatch(/sentDate:/);
  });

  it('the send button shares a real reminder before claiming one', () => {
    const screen = read('app/(contractor)/facturen.tsx');
    const at = screen.indexOf('styles.dunningAction');
    expect(at).toBeGreaterThan(-1);
    const handler = screen.slice(at, screen.indexOf('</Pressable>', at));
    expect(handler).toMatch(/overdueReminderMessage\(/);
    expect(handler).toMatch(/Share\.share\(/);
    expect(handler).toMatch(/dismissedAction/);
  });
});

describe('the cash-flow dashboard acts on the real invoice', () => {
  // `cashFlowService.markInvoicePaid` / `.sendReminder` mutate a Map seeded
  // only by `__seedMockData()`, so both begin `if (invoice)` on a lookup that
  // misses every real invoice: "Mark as paid" changed nothing and "Send
  // reminder" reminded nobody, silently (sweep 2026-09-18).
  const svc = read('src/services/cashFlowService.ts');
  const hook = svc.slice(svc.indexOf('const markPaid = useCallback'), svc.indexOf('const addExpense = useCallback'));

  it('marking paid goes through the AppState mutator', () => {
    expect(hook).toMatch(/markInvoicePaidInState\(invoiceId\)/);
  });

  it('the reminder opens the invoice instead of claiming a send', () => {
    expect(hook).toMatch(/router\.push/);
    expect(hook).not.toMatch(/cashFlowService\.sendReminder/);
  });
});

describe('an order is sent by the contractor, and survives a restart', () => {
  // `purchaseOrderService` had no AsyncStorage and no Supabase at all: every PO
  // and every status set on it died with the process, while the screen said
  // "Bestelling verstuurd naar {supplier}" for an order no supplier ever
  // received (sweep 2026-09-18). Vasco has no supplier channel, so the
  // contractor sends it — share sheet — and the app records that it went.
  const svc = read('src/services/purchaseOrderService.ts');
  const screen = read('app/contractor/purchase-orders.tsx');

  it('the store is persisted and revived with real Dates', () => {
    expect(svc).toMatch(/PO_STORAGE_KEY/);
    expect(svc).toMatch(/AsyncStorage\.setItem\(PO_STORAGE_KEY/);
    expect(svc).toMatch(/createdAt: new Date\(o\.createdAt\)/);
  });

  it('the stored copy is dropped when the account changes', () => {
    const reset = svc.slice(svc.indexOf('registerSingletonReset'), svc.indexOf('return PurchaseOrderService.instance'));
    expect(reset).toMatch(/removeItem\(PO_STORAGE_KEY\)/);
  });

  it('the hook reads the store before it stops loading', () => {
    const hook = svc.slice(svc.indexOf('export function usePurchaseOrders'), svc.indexOf('return { orders, loading'));
    expect(hook).toMatch(/purchaseOrderService\.load\(\)/);
    expect(hook).toMatch(/setLoading\(false\)/);
  });

  it('sending shares the order and only then records it', () => {
    const at = screen.indexOf("case 'draft':");
    const block = screen.slice(at, screen.indexOf("case 'confirmed'", at));
    expect(block).toMatch(/Share\.share\(/);
    expect(block).toMatch(/dismissedAction/);
    // The status must not flip on the bare press any more.
    expect(block).not.toMatch(/onPress: \(\) => submit\(order\.id\)/);
  });
});

describe('a deletion request is not announced as a deletion', () => {
  // Three entry points; this was the one that discarded the result and said
  // "Your account has been deleted" — for a GDPR Art. 17 request that may never
  // have left the device, and which is a 30-day request even when it does.
  const ai = read('app/(contractor)/ai.tsx');
  // NOT the first occurrence — that is the import line (#342's trap, again).
  // Anchor on the CALL.
  const at = ai.indexOf('await requestAccountDeletion(');

  it('checks that the request reached the server', () => {
    const block = ai.slice(at - 200, at + 900);
    // The CONDITION, not just the words: asserting that `serverRequested`
    // appears somewhere passed when the branch was changed to `if (false)`
    // — shape instead of effect, which is the failure this file exists for.
    expect(block).toMatch(/if \(!result\.success \|\| !result\.serverRequested\)/);
    expect(block).toMatch(/legal\.deletionFailed/);
    // …and it must RETURN before anything claims success.
    const failure = block.slice(block.indexOf('if (!result.success'));
    expect(failure.slice(0, failure.indexOf('}'))).toMatch(/Alert\.alert/);
    expect(failure).toMatch(/return;/);
  });

  it('claims a request, not a completed deletion', () => {
    const block = ai.slice(at, at + 900);
    expect(block).toMatch(/legal\.deleteConfirmTitle/);
    expect(block).not.toMatch(/profile\.accountDeleted/);
  });
});

describe('nothing claims a clipboard the app does not have', () => {
  // No clipboard module is installed (adding one is a native dependency, which
  // takes fixes off the OTA channel), yet the payments screen said "copied to
  // clipboard" twice. It shares the link now.
  const pay = read('src/components/contractor/IntegratedPayments.tsx');

  it('the copy handler opens the share sheet', () => {
    const at = pay.indexOf('const handleCopyLink');
    expect(at).toBeGreaterThan(-1);
    expect(pay.slice(at, at + 600)).toMatch(/Share\.share\(/);
  });

  it('no payment string promises a clipboard in any language', () => {
    for (const loc of ['de', 'en', 'nl', 'fr', 'es', 'it']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));
      const strings = JSON.stringify(dict.paymentAlerts ?? {});
      expect(`${loc}: ${strings}`).not.toMatch(/clipboard|Zwischenablage|klembord|presse-papiers|portapapeles|appunti/i);
    }
  });
});

