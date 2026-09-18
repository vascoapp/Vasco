/**
 * @jest-environment node
 */
// `businessProfile.defaultPaymentTerms` had a column, a write mapper, a read
// mapper and a display line in IntegratedPayments — and NO screen could set it,
// while seven mutators in AppState each did `dueDate.setDate(getDate() + 14)`.
// So a contractor who works on 30-day terms issued every invoice at 14, and the
// dunning ladder, the late-fee interest and the DSO all counted from the wrong
// day (#208's shape — a field with readers and no writer; sweep 2026-09-18).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const STATE = read('src/state/AppState.tsx');

describe('a due date is computed from the contractor terms', () => {
  it('no mutator hardcodes a fourteen-day term any more', () => {
    expect(STATE).not.toMatch(/dueDate\.setDate\(dueDate\.getDate\(\) \+ 14\)/);
    expect(STATE).not.toMatch(/sentDue\.setDate\(sentDue\.getDate\(\) \+ 14\)/);
  });

  it('they all go through one helper', () => {
    const uses = STATE.match(/dueDateOnTerms\(/g) ?? [];
    // Six invoice-creating mutators plus the definition.
    expect(uses.length).toBeGreaterThanOrEqual(6);
  });

  it('the helper reads the profile and keeps 14 as the fallback', () => {
    const at = STATE.indexOf('const dueDateOnTerms');
    expect(at).toBeGreaterThan(-1);
    const body = STATE.slice(at, STATE.indexOf('}, [businessProfile', at));
    expect(body).toMatch(/businessProfile\?\.defaultPaymentTerms/);
    expect(body).toMatch(/: 14/);
    // A zero or negative term must not mean "due today".
    expect(body).toMatch(/days > 0/);
  });
});

describe('the contractor can set the term', () => {
  const screen = read('app/(modals)/business-settings.tsx');

  it('business settings offers the field', () => {
    expect(screen).toMatch(/settings\.paymentTerms/);
    expect(screen).toMatch(/const \[paymentTerms, setPaymentTerms\]/);
  });

  it('and saves it, refusing junk rather than writing a zero term', () => {
    const at = screen.indexOf('defaultPaymentTerms:');
    expect(at).toBeGreaterThan(-1);
    const block = screen.slice(at, at + 240);
    expect(block).toMatch(/parseInt/);
    expect(block).toMatch(/n > 0 \? n : undefined/);
  });

  it('is in the save dependency list, so a typed value is not stale', () => {
    expect(screen).toMatch(/bankAccountNumber, paymentTerms, country/);
  });
});
