/**
 * @jest-environment node
 */
// Found on a device, German posture: the invoice and quote filter sheets on
// the money tab listed their options as ALL / OVERDUE / SENT / PAID / DRAFT —
// the raw enum keys — inside a sheet whose own title ("RECHNUNGEN FILTERN"),
// subtitle ("SORTIEREN NACH") and sort rows ("WERT", "DATUM") were all
// properly translated. `{status}` was rendered directly.
//
// The translation path already existed in the same file: `invoiceStatusLabel`
// and `quoteStatusLabel`, three hundred lines above, used by the list rows
// that print "· Überfällig" and "· Entwurf". The neighbour defended against
// the hazard and this one did not (#173's shape).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const SRC = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../../app/(contractor)/geld.tsx'), 'utf8'),
);

describe('the filter sheets speak the contractor’s language', () => {
  it('neither sheet renders a raw enum key', () => {
    expect(SRC).not.toMatch(/>\{status\}<\/DKLabel>/);
    expect(SRC).not.toMatch(/>\{status\}<\/Text>/);
  });

  it('both use the label helpers the list rows already use', () => {
    expect(SRC).toMatch(/\{status === 'all' \? t\('common\.all', 'All'\) : invoiceStatusLabel\(status\)\}/);
    expect(SRC).toMatch(/\{status === 'all' \? t\('common\.all', 'All'\) : quoteStatusLabel\(status\)\}/);
  });

  it('every status offered by a filter has a translation', () => {
    const locales = ['en', 'nl', 'de', 'fr', 'es', 'it'];
    const invoiceStatuses = ['overdue', 'sent', 'paid', 'draft'];
    const quoteStatuses = ['sent', 'accepted', 'draft'];
    for (const loc of locales) {
      const dict = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${loc}.json`), 'utf8'),
      );
      expect({ loc, all: typeof dict.common?.all }).toEqual({ loc, all: 'string' });
      for (const s of invoiceStatuses) {
        expect({ loc, s, has: typeof dict.invoices?.status?.[s] })
          .toEqual({ loc, s, has: 'string' });
      }
      for (const s of quoteStatuses) {
        expect({ loc, s, has: typeof dict.quotes?.status?.[s] })
          .toEqual({ loc, s, has: 'string' });
      }
    }
  });
});
