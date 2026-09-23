/**
 * A photo → quote handoff only lands on ITS customer's quote.
 *
 * Review, 2026-09-22: the new "who is this quote for?" step runs before the
 * builder reads the handoff. A contractor who tapped "Draft quote from photos"
 * for customer A and backed out at that question left A's handoff stashed for
 * an hour — and the next quote, for customer B, opened prefilled with A's
 * photo lines and "Prefilled from photos sent by A".
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '../utils/stripComments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '../..', rel), 'utf8'));

describe('the photo handoff stays with its customer', () => {
  it('the panel hands the known customer to the quote screen', () => {
    const panel = read('src/components/contractor/PhotoSubmissionsPanel.tsx');
    const stash = panel.slice(panel.indexOf('stashHandoff({'), panel.indexOf('});', panel.indexOf('stashHandoff({')));
    expect(stash).toMatch(/\bcustomerId\b/);
    expect(panel).toMatch(/tiered-quote\?customerId=\$\{encodeURIComponent\(customerId\)\}/);
  });

  it('the decisions screen passes the tracker customer, never the placeholder "new"', () => {
    const screen = read('app/(contractor)/decisions.tsx');
    const at = screen.indexOf('<PhotoSubmissionsPanel');
    expect(screen.slice(at, at + 400)).toMatch(/customerId=\{selectedTracker\.customerId && selectedTracker\.customerId !== 'new'/);
  });

  it("the builder checks whose photos they are BEFORE taking them", () => {
    const builder = read('src/components/contractor/TieredQuoteBuilder.tsx');
    const peek = builder.indexOf('await peekHandoff()');
    const consume = builder.indexOf('await consumeHandoff()');
    expect(peek).toBeGreaterThan(-1);
    expect(consume).toBeGreaterThan(peek);
    // The customer check sits between the look and the take.
    expect(builder.slice(peek, consume)).toMatch(/peeked\.customerId !== customer\?\.id\) return;/);
  });
});

describe('peeking does not consume (behaviour, not source shape)', () => {
  const { stashHandoff, peekHandoff, consumeHandoff } = require('../services/photoQuoteHandoffService');
  it("another customer's handoff survives a look and is still there for its own quote", async () => {
    await stashHandoff({ customerId: 'cust-A', customerName: 'A', photoUrls: ['x'], result: { detectedItems: [] } });
    const first = await peekHandoff();
    expect(first?.customerId).toBe('cust-A');
    const again = await peekHandoff();
    expect(again?.customerId).toBe('cust-A');       // still there
    const taken = await consumeHandoff();
    expect(taken?.customerId).toBe('cust-A');
    expect(await peekHandoff()).toBeNull();          // consumed now
  });
});
