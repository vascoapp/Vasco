/**
 * A contractor's scheduled pushes name the CUSTOMER. Both the quote follow-up
 * and the payment reminder passed the literal 'Klant', so a German contractor
 * read "Follow up with Klant" about every quote (sweep 2026-09-23, E3).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '../../utils/stripComments';
import { pushCustomerName } from '../AppState';

const CUSTOMERS = [{ id: 'c1', name: 'Familie Becker' }] as any;

describe('pushes name the customer', () => {
  it('by FK, by id in the name slot, and by name', () => {
    expect(pushCustomerName(CUSTOMERS, { customerId: 'c1' })).toBe('Familie Becker');
    expect(pushCustomerName(CUSTOMERS, { customer: 'c1' })).toBe('Familie Becker');
    expect(pushCustomerName(CUSTOMERS, { customer: 'Familie Becker' })).toBe('Familie Becker');
  });

  it('unknown → the localized word, never a Dutch literal', () => {
    expect(pushCustomerName(CUSTOMERS, { customerId: 'nope' })).not.toBe('Klant');
  });

  it('no scheduled push passes a literal customer name', () => {
    const src = stripComments(readFileSync(join(__dirname, '../AppState.tsx'), 'utf8'));
    expect(src).not.toMatch(/schedule\w+\(\{[^}]*customerName:\s*['"`]/);
    expect(src.match(/customerName: pushCustomerName\(/g)).toHaveLength(2);
  });
});

// E4: the inbox entries were English literals — "Job completed", "Quote for
// c-1787… sent" — stored as written for every market.
describe('inbox entries are copy, not literals', () => {
  const src = stripComments(readFileSync(join(__dirname, '../AppState.tsx'), 'utf8'));
  it('no fireNotification passes a literal title or body', () => {
    const calls = [...src.matchAll(/fireNotification\(\s*'[^']*',\s*'[^']*',\s*([^,]+),/g)].map((m) => m[1].trim());
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const title of calls) expect(title).not.toMatch(/^['"`]/);
    expect(src).not.toMatch(/fireNotification\([^;]*`[^`]*(marked as|Quote for|Share the PDF)/);
  });
  it('every inbox key exists in all six locales', () => {
    const keys = [...src.matchAll(/notifications\.log\.(\w+)/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThanOrEqual(6);
    for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
      const json = require(`../../i18n/locales/${loc}.json`);
      for (const k of keys) expect(`${loc}:${k}:${typeof json.notifications.log[k]}`).toBe(`${loc}:${k}:string`);
    }
  });
});
