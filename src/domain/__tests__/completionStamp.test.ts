// =============================================================================
// completionStampFor
// =============================================================================
// This pins a LEGAL field, not a convenience one. addInvoiceFromJob snapshots
// the invoice's leveringsdatum (NL Belastingdienst Art. 35 lid 1.b) from
// job.completedAt. Nothing wrote that field until 2026-08-04 — only the ten
// seeded jobs carried a value — so every invoice raised from a real contractor's
// job persisted delivery_date = null while the demo looked perfect.
// =============================================================================

import { completionStampFor } from '../jobs';

const NOW = '2026-08-04T20:00:00.000Z';
const now = () => NOW;

describe('completionStampFor', () => {
  it('stamps on the transition to completed', () => {
    expect(completionStampFor('completed', undefined, now)).toBe(NOW);
  });

  it('stamps nothing for any other status', () => {
    // Undefined rather than null so callers can spread it away entirely — a
    // null would overwrite a real date with an empty one.
    for (const status of ['draft', 'scheduled', 'in-progress', 'invoiced', 'cancelled'] as const) {
      expect(completionStampFor(status as never, undefined, now)).toBeUndefined();
    }
  });

  it('preserves an existing stamp instead of refreshing it', () => {
    // The date may already be on a filed invoice. Re-completing a job — a
    // correction, a reopened snag — must not move a reported delivery date.
    const original = '2026-06-01T09:30:00.000Z';
    expect(completionStampFor('completed', original, now)).toBe(original);
  });

  it('does not clear an existing stamp when moving off completed', () => {
    // Returns undefined, which the caller spreads away, leaving the stored
    // completedAt untouched. An invoiced job keeps the date it was delivered.
    expect(completionStampFor('invoiced' as never, '2026-06-01T09:30:00.000Z', now)).toBeUndefined();
  });
});
