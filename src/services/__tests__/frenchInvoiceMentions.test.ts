/**
 * @jest-environment node
 */
// France's e-invoicing reform adds four mentions to every invoice from
// 1 September 2026. Three of them are facts the app never held, which is why
// this sat open: writing a PARTIAL legal block is worse than an absent one,
// because it looks complied-with (#339 L14).
//
//   the buyer's SIREN · the nature of the operation · the delivery address when
//   it differs · and a mention when the seller accounts for VAT on debits.
import { sirenFromFrenchVatId, frenchInvoiceMentions2026, legalMentions } from '../invoicePdfService';

describe('the buyer SIREN is derived, not stored twice', () => {
  // A French TVA number is FR + a 2-character key + the 9-digit SIREN, so the
  // number is already there whenever the customer's VAT id is. A second field
  // for a number the first one contains is two places to be wrong (#170).
  it('reads the SIREN out of a well-formed FR VAT number', () => {
    expect(sirenFromFrenchVatId('FR40303265045')).toBe('303265045');
    expect(sirenFromFrenchVatId('fr 40 303 265 045')).toBe('303265045');
  });

  it('refuses anything that is not one, rather than printing a half-mention', () => {
    expect(sirenFromFrenchVatId('DE123456789')).toBeNull();
    expect(sirenFromFrenchVatId('FR4030326504')).toBeNull(); // 8 digits
    expect(sirenFromFrenchVatId('')).toBeNull();
    expect(sirenFromFrenchVatId(undefined)).toBeNull();
  });
});

describe('each mention appears only when its fact exists', () => {
  it('prints nothing at all when nothing is known', () => {
    expect(frenchInvoiceMentions2026({})).toEqual([]);
  });

  it('prints the SIREN when the customer has a French VAT number', () => {
    expect(frenchInvoiceMentions2026({ buyerVatId: 'FR40303265045' })).toEqual(['SIREN du client : 303265045']);
  });

  it('names the nature the contractor stated, and never guesses one', () => {
    expect(frenchInvoiceMentions2026({ operationNature: 'services' })).toEqual(["Nature de l'opération : prestation de services."]);
    expect(frenchInvoiceMentions2026({ operationNature: 'goods' })).toEqual(["Nature de l'opération : livraison de biens."]);
    expect(frenchInvoiceMentions2026({ operationNature: 'mixed' })[0]).toContain('mixte');
    expect(frenchInvoiceMentions2026({ operationNature: null })).toEqual([]);
  });

  it('prints a delivery address only when one was given', () => {
    expect(frenchInvoiceMentions2026({ deliveryAddress: '  ' })).toEqual([]);
    expect(frenchInvoiceMentions2026({ deliveryAddress: '12 rue des Lilas, Lyon' }))
      .toEqual(['Adresse de livraison : 12 rue des Lilas, Lyon.']);
  });

  it('states the débits option only when the seller opted for it', () => {
    expect(frenchInvoiceMentions2026({ tvaSurLesDebits: false })).toEqual([]);
    expect(frenchInvoiceMentions2026({ tvaSurLesDebits: true }))
      .toEqual(["Option pour le paiement de la TVA d'après les débits."]);
  });

  it('carries all four when all four are known', () => {
    const out = frenchInvoiceMentions2026({
      buyerVatId: 'FR40303265045',
      operationNature: 'mixed',
      deliveryAddress: '12 rue des Lilas, Lyon',
      tvaSurLesDebits: true,
    });
    expect(out).toHaveLength(4);
  });
});

describe('the standing French mentions are unchanged', () => {
  it('still states the penalty rate as a rule and the 40 EUR indemnity', () => {
    const fr = legalMentions('FR');
    expect(fr.join(' ')).toMatch(/L441-10/);
    expect(fr.join(' ')).toMatch(/40 €/);
  });
});

describe('the invoice carries the facts end to end (rule #8)', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('../../utils/stripComments');
  const ROOT = path.resolve(__dirname, '../../..');
  const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

  it('domain, row type and read mapper agree', () => {
    expect(read('src/domain/documents.ts')).toMatch(/operationNature\?: 'goods' \| 'services' \| 'mixed'/);
    expect(read('src/lib/database.types.ts')).toMatch(/operation_nature: 'goods' \| 'services' \| 'mixed' \| null/);
    expect(read('src/lib/mappers.ts')).toMatch(/operationNature: row\.operation_nature \?\? undefined/);
    expect(read('src/lib/mappers.ts')).toMatch(/tvaSurLesDebits: row\.tva_sur_les_debits \?\? undefined/);
  });

  it('the write path persists both invoice fields', () => {
    const state = read('src/state/AppState.tsx');
    expect(state).toMatch(/dbUpdates\.operation_nature = updates\.operationNature \?\? null/);
    expect(state).toMatch(/dbUpdates\.delivery_address = updates\.deliveryAddress \|\| null/);
    expect(state).toMatch(/dbUpdates\.tva_sur_les_debits = updates\.tvaSurLesDebits \?\? null/);
  });

  it('the contractor can state them — France only', () => {
    const screen = read('app/invoices/[id].tsx');
    expect(screen).toMatch(/country === 'FR' && \(/);
    expect(screen).toMatch(/invoices\.operationNature/);
    expect(screen).toMatch(/invoices\.deliveryAddress/);
    const settings = read('app/contractor/vat-and-audit.tsx');
    expect(settings).toMatch(/tvaSurLesDebits/);
  });

  it('and the PDF is given them at every call site', () => {
    for (const rel of ['app/invoices/[id].tsx', 'app/(contractor)/facturen.tsx']) {
      expect({ rel, wired: /frMentions: \{/.test(read(rel)) }).toEqual({ rel, wired: true });
    }
  });

  it('the PDF prints them for FR and for nobody else', () => {
    const svc = read('src/services/invoicePdfService.ts');
    expect(svc).toMatch(/country === 'FR' \? frenchInvoiceMentions2026\(frMentions \?\? \{\}\) : \[\]/);
  });

  it('the migration is additive and CHECK-constrained', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260918000002_fr_invoice_mentions.sql'), 'utf8');
    expect(sql).toMatch(/operation_nature in \('goods', 'services', 'mixed'\)/);
    expect(sql).not.toMatch(/drop column/i);
  });
});

describe('the delivery address survives reopening the invoice', () => {
  // The invoice arrives after first render, so a useState initialiser captures
  // '' and a saved address looks empty when the screen is reopened — the same
  // reason `notes` is synced in an effect.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../../app/invoices/[id].tsx'), 'utf8');

  it('is filled from the loaded invoice, not at first render', () => {
    expect(src).toMatch(/setDeliveryAddress\(\(invoice as any\)\.deliveryAddress \?\? ''\)/);
    expect(src).not.toMatch(/useState<string>\(\(\(invoice as any\)\?\.deliveryAddress/);
  });
});

