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

  it("the builder drops another customer's handoff", () => {
    const builder = read('src/components/contractor/TieredQuoteBuilder.tsx');
    const at = builder.indexOf('await consumeHandoff()');
    expect(builder.slice(at, at + 300)).toMatch(/if \(h\.customerId && h\.customerId !== customer\?\.id\) return;/);
  });
});
