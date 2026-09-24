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
    expect(handler).toMatch(/wasShareDismissed\(res\)|dismissedAction/);
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
  // There were three entry points; one discarded the result and said "Your
  // account has been deleted" for a request that may never have left the
  // device. Since 2026-09-24 there is ONE flow — app/contractor/delete-account
  // — and the others route to it (behaviour: deleteAccountExportsFirst).
  const screen = read('app/contractor/delete-account.tsx');
  const at = screen.indexOf('await requestAccountDeletion(');

  it('checks that the request reached the server, and returns before claiming', () => {
    const block = screen.slice(at - 200, at + 700);
    expect(block).toMatch(/if \(!result\.success \|\| !result\.serverRequested\)/);
    const failure = block.slice(block.indexOf('if (!result.success'));
    expect(failure.slice(0, failure.indexOf('return;'))).toMatch(/accountDeletion\.failedTitle/);
  });

  it('claims a request, not a completed deletion', () => {
    const block = screen.slice(at, at + 900);
    expect(block).toMatch(/accountDeletion\.doneTitle/);
    expect(block).not.toMatch(/accountDeleted/);
  });

  it('the other entry points only route to it', () => {
    for (const f of ['app/(contractor)/ai.tsx', 'app/contractor/profile.tsx', 'app/contractor/legal.tsx']) {
      expect(read(f)).toMatch(/handleDeleteAccount = \(\) => router\.push\('\/contractor\/delete-account'/);
    }
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


describe('nothing states a cadence or a watch that does not exist', () => {
  // `reminderFrequency` is hardcoded 'every_2_days' at all three creation sites
  // and no scheduler reads it — no decision reminder has ever been sent — yet
  // the tracker card told the contractor (and their customer) "Reminders: every
  // 2 days". And the onboarding compliance step promised "Vasco monitors your
  // certifications and warns on expiry" while collecting only a NAME: no
  // number, no issuer, no expiry, and the Compliance screen reads a different
  // store entirely (sweep 2026-09-18).
  const tracker = read('src/components/contractor/DecisionTracker.tsx');

  it('the tracker no longer prints a reminder cadence', () => {
    expect(tracker).not.toMatch(/dt\.reminders'\)\}: \{tracker\.reminderFrequency/);
  });

  it('the cohort model is not fed a constant "no reminder response"', () => {
    const intel = read('src/intelligence/decisionIntelligence.ts');
    expect(intel).not.toMatch(/p_reminder_responsive: Boolean\(item\.isOverdue && \(item\.remindersSent \?\? 0\) > 0\)/);
    expect(intel).toMatch(/p_reminder_responsive: \(item\.remindersSent \?\? 0\) > 0 \? Boolean\(item\.isOverdue\) : null/);
  });

  it('onboarding does not promise a watch it cannot keep', () => {
    for (const loc of ['de', 'en', 'nl', 'fr', 'es', 'it']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));
      const info = dict.onboarding?.complianceInfo ?? '';
      expect(`${loc}: ${info}`).not.toMatch(/monitors your certifications|überwacht Ihre Zertifizierungen|bewaakt uw certificeringen/i);
      // …and it points at where the warning actually comes from.
      expect(`${loc}: ${info}`).toMatch(/Compliance|Conformité|Cumplimiento|Conformità/i);
    }
  });
});

describe('an exempt contractor exports no VAT', () => {
  // A line can carry a rate from before the scheme changed; exemption is a fact
  // about the SELLER and outranks it, or the books show 19% where the invoice
  // shows 0% (sweep 2026-09-18).
  const state = read('src/state/AppState.tsx');
  it('the Moneybird payload zeroes every line for §19 / KOR', () => {
    // The CALL, not the import at the top of the file (#342's trap).
    const at = state.indexOf('await exportInvoiceToMoneybird');
    expect(at).toBeGreaterThan(-1);
    const block = state.slice(Math.max(0, at - 1200), at);
    expect(block).toMatch(/isSmallBusinessExempt\(businessProfile\)\s*\n?\s*\? 0/);
  });
});
