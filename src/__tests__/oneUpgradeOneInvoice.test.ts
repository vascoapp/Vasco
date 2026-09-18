/**
 * @jest-environment node
 */
// Billing a customer's chosen upgrades stamps the decision tracker so the same
// choice cannot be billed twice — but the tracker is AsyncStorage, device-local
// by an explicit earlier decision, so the stamp does not travel. On a second
// device, or after a reinstall, the same upgrades billed again and the customer
// received two invoices for one decision (#339 D14).
//
// Invoices sync, so the de-dup key lives on the invoice
// (`documents.decision_item_ids`, migration 20260918000001).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the de-dup key is wired end to end (rule #8)', () => {
  it('the domain type carries it', () => {
    expect(read('src/domain/documents.ts')).toMatch(/decisionItemIds\?: string\[\]/);
  });

  it('the row type declares the column', () => {
    expect(read('src/lib/database.types.ts')).toMatch(/decision_item_ids: string\[\] \| null/);
  });

  it('the read mapper brings it back', () => {
    expect(read('src/lib/mappers.ts')).toMatch(/decisionItemIds: row\.decision_item_ids \?\? undefined/);
  });

  it('the write path stores it on the document', () => {
    expect(read('src/state/AppState.tsx')).toMatch(/decision_item_ids: decisionItemIds\?\.length \? decisionItemIds : null/);
  });

  it('the screen passes the items it just billed', () => {
    expect(read('app/(contractor)/decisions.tsx')).toMatch(/decisionItemIds: fresh\.map\(\(e\) => e\.itemId\)/);
  });

  it('the migration exists and is additive', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260918000001_decision_item_ids.sql'), 'utf8');
    expect(sql).toMatch(/add column if not exists decision_item_ids text\[\]/);
    expect(sql).not.toMatch(/drop column|not null/i);
  });
});

describe('the helper decides it, and is tested on behaviour', () => {
  // The static assertions below could not see a mutated CONDITION — asserting
  // that `invoices.find(` appears passed when the branch became `if (false)`.
  // The decision itself is a pure function now.
  const { invoiceAlreadyBillingDecisionItems } = require('../domain/documents');
  const inv = (id: string, items?: string[]) => ({ id, decisionItemIds: items });

  it('finds the invoice that billed one of these items', () => {
    const invoices = [inv('F-1'), inv('F-2', ['item_tap', 'item_tiles'])];
    expect(invoiceAlreadyBillingDecisionItems(invoices, ['item_tiles'])?.id).toBe('F-2');
  });

  it('passes when no invoice carries any of them', () => {
    const invoices = [inv('F-1', ['item_other'])];
    expect(invoiceAlreadyBillingDecisionItems(invoices, ['item_tap'])).toBeUndefined();
  });

  it('is a no-op when the caller passes no items', () => {
    const invoices = [inv('F-1', ['item_tap'])];
    expect(invoiceAlreadyBillingDecisionItems(invoices, [])).toBeUndefined();
    expect(invoiceAlreadyBillingDecisionItems(invoices, undefined)).toBeUndefined();
  });

  it('ignores invoices that were never raised from decisions', () => {
    expect(invoiceAlreadyBillingDecisionItems([inv('F-1')], ['item_tap'])).toBeUndefined();
  });
});

describe('the second attempt is refused', () => {
  const state = read('src/state/AppState.tsx');
  const at = state.indexOf('addInvoiceFromDecisionUpgrades: async');
  const body = state.slice(at, state.indexOf('const docNumber', at));

  it('checks existing INVOICES, not the tracker', () => {
    expect(at).toBeGreaterThan(-1);
    expect(body).toMatch(/invoiceAlreadyBillingDecisionItems\(invoices, decisionItemIds\)/);
    // The refusal must be GUARDED by that result, not merely mention it.
    expect(body).toMatch(/if \(alreadyBilled\) \{/);
  });

  it('throws, naming the invoice that already has them', () => {
    expect(body).toMatch(/decisions\.upgradesAlreadyBilled/);
    expect(body).toMatch(/documentNumber\(alreadyBilled\)/);
    expect(body).toMatch(/throw new Error/);
  });

  it('and says so in every shipped language', () => {
    for (const loc of ['de', 'en', 'nl', 'fr', 'es', 'it']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));
      const msg = dict.decisions?.upgradesAlreadyBilled ?? '';
      expect(`${loc}: ${msg}`).toContain('{{number}}');
    }
  });
});
