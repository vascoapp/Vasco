// =============================================================================
// EVE LIVE ACTION GENERATOR — Unit Tests
// =============================================================================
// Two invariants this file guards:
//   1. No raw entity id ever reaches user- or customer-facing copy. The
//      preparedData.template strings are shared to customers over WhatsApp, so
//      a leaked "cust-003" is a defect the customer sees.
//
//      ⚠️ ONE EXCEPTION, and it is not an exception at all: a DOCUMENT's `id`
//      is its document number. `documentRowToInvoice` sets
//      `id: row.document_number ?? row.id`, so every invoice off the backend
//      carries the minted "I0042" there. `inv-seed-9` is what a demo FIXTURE
//      looks like, and this file used to reason from that fixture to "invoice
//      ids are meaningless" — which is how the EVE queue ended up telling a
//      customer "payment received for invoice Bakkerij Smit". See learnings
//      #230; the customer-id invariant is untouched.
//   2. Every string is resolved through i18n rather than hardcoded English —
//      the queue renders inside an otherwise-Dutch UI.
// =============================================================================

import { buildLiveActions } from '../eveLiveActionService';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const customers = [
  { id: 'cust-003', name: 'Bakkerij Smit', email: 'info@bakkerijsmit.nl' },
  { id: 'cust-005', name: 'Hotel NH', email: 'info@hotelnh.nl' },
];

/** Every string a contractor or their customer can read. */
function userFacingStrings(actions: any[]): string[] {
  return actions.flatMap((a) => [
    a.title,
    a.description,
    a.impact,
    a.actionLabel,
    a.preparedData?.template,
  ].filter((s): s is string => typeof s === 'string'));
}

describe('buildLiveActions — no raw entity ids in user-facing copy', () => {
  test('overdue invoice uses the invoice reference, not the row id', () => {
    const actions = buildLiveActions({
      jobs: [],
      quotes: [],
      invoices: [{
        id: 'inv-seed-1',
        reference: 'F-2026-014',
        customerId: 'cust-005',
        customer: 'Hotel NH',
        amount: 350,
        status: 'overdue',
        dueDate: iso(-15 * MS_PER_DAY),
      }],
      customers,
    });
    expect(actions).toHaveLength(1);
    const strings = userFacingStrings(actions);
    expect(strings.join(' ')).toContain('F-2026-014');
    expect(strings.join(' ')).not.toContain('inv-seed-1');
  });

  test('an invoice with no reference uses its document number — which is the id', () => {
    // `reference` is an override slot with no writer; the number the customer
    // recognises is minted server-side and lands on `id`. The slot the label
    // fills reads "invoice {{invoice}}", including in a template sent over
    // WhatsApp, so filling it with the customer's own name was the bug.
    const actions = buildLiveActions({
      jobs: [],
      quotes: [],
      invoices: [{
        id: 'I0042',
        customerId: 'cust-003',
        amount: 120,
        status: 'overdue',
        dueDate: iso(-3 * MS_PER_DAY),
      }],
      customers,
    });
    const joined = userFacingStrings(actions).join(' ');
    expect(joined).toContain('I0042');
    // The customer id invariant is unchanged and is the one that matters here.
    expect(joined).not.toContain('cust-003');
  });

  test('an invoice with no number at all still says something a human can read', () => {
    // Belt and braces: a row with neither a reference nor an id must not
    // render "invoice " with a hole in it. The customer name is the last
    // resort, not the default.
    const actions = buildLiveActions({
      jobs: [],
      quotes: [],
      invoices: [{
        id: '',
        customerId: 'cust-003',
        amount: 120,
        status: 'overdue',
        dueDate: iso(-3 * MS_PER_DAY),
      }],
      customers,
    });
    const joined = userFacingStrings(actions).join(' ');
    expect(joined).toContain('Bakkerij Smit');
    expect(joined).not.toContain('cust-003');
  });

  test('customer-facing job templates greet by name, never by customer id', () => {
    const actions = buildLiveActions({
      jobs: [{
        id: 'j-1',
        customerId: 'cust-003',
        title: 'Lekkage keuken',
        status: 'in-progress',
        updatedAt: iso(-60 * 60 * 1000),
      }],
      quotes: [],
      invoices: [],
      customers,
    });
    const template = actions[0]?.preparedData?.template as string;
    expect(template).toContain('Bakkerij Smit');
    expect(template).not.toContain('cust-003');
  });

  test('quote follow-up references the job title, not the quote id', () => {
    const actions = buildLiveActions({
      jobs: [],
      quotes: [{
        id: 'q-seed-2',
        customerId: 'cust-005',
        customer: 'Hotel NH',
        job: 'CV-ketel vervangen',
        amount: 1200,
        status: 'sent',
        sentAt: iso(-5 * MS_PER_DAY),
      }],
      invoices: [],
      customers,
    });
    const joined = userFacingStrings(actions).join(' ');
    expect(joined).toContain('CV-ketel vervangen');
    expect(joined).not.toContain('q-seed-2');
  });

  test('an unknown customer degrades to a generic noun rather than leaking an id', () => {
    const actions = buildLiveActions({
      jobs: [{
        id: 'j-2',
        customerId: 'cust-does-not-exist',
        title: 'Schilderwerk',
        status: 'in-progress',
        updatedAt: iso(-60 * 60 * 1000),
      }],
      quotes: [],
      invoices: [],
      customers,
    });
    const joined = userFacingStrings(actions).join(' ');
    expect(joined).not.toContain('cust-does-not-exist');
  });

  test('NO action of any type leaks an id-shaped token into user-facing copy', () => {
    const actions = buildLiveActions({
      jobs: [
        { id: 'j-seed-1', customerId: 'cust-003', title: 'Badkamer', status: 'completed', quotedAmount: 900, completedAt: iso(-2 * 60 * 60 * 1000) },
        { id: 'j-seed-2', customerId: 'cust-005', title: 'CV onderhoud', status: 'in-progress', updatedAt: iso(-60 * 60 * 1000) },
      ],
      quotes: [
        { id: 'q-seed-1', customerId: 'cust-003', customer: 'Bakkerij Smit', job: 'Keuken', amount: 800, status: 'sent', sentAt: iso(-60 * 60 * 1000) },
        { id: 'q-seed-3', customerId: 'cust-005', customer: 'Hotel NH', job: 'Dakgoot', amount: 400, status: 'accepted' },
      ],
      invoices: [
        { id: 'inv-seed-2', reference: 'F-2026-020', customerId: 'cust-005', customer: 'Hotel NH', amount: 500, status: 'paid', paidAt: iso(-2 * 60 * 60 * 1000) },
        { id: 'inv-seed-3', reference: 'F-2026-021', customerId: 'cust-003', customer: 'Bakkerij Smit', amount: 200, status: 'sent', sentAt: iso(-60 * 60 * 1000) },
      ],
      customers,
    });
    expect(actions.length).toBeGreaterThan(0);
    const joined = userFacingStrings(actions).join(' | ');
    // Seed-style ids (j-seed-1, q-seed-3, inv-seed-2, cust-005) must not appear.
    expect(joined).not.toMatch(/\b(?:j|q|inv|cust)-[a-z]*-?\d+\b/);
  });
});

describe('buildLiveActions — customerPhone resolution', () => {
  // VascoCard renders the one-tap WhatsApp button ONLY when
  // preparedData.customerPhone is set. It used to come solely from
  // Job.sitePhone, which no production path writes — so the button appeared in
  // demo (fixtures set it) and never in the field. These pin the fallback.
  const withPhones = [
    { id: 'cust-003', name: 'Bakkerij Smit', phone: '+31612345678' },
    { id: 'cust-005', name: 'Hotel NH', phone: '+31687654321' },
  ];

  test("falls back to the customer's number when the job has no sitePhone", () => {
    const actions = buildLiveActions({
      jobs: [{
        id: 'j-1', title: 'Lekkage keuken', status: 'in-progress',
        customerId: 'cust-003', updatedAt: iso(-60 * 60 * 1000),
      }],
      quotes: [], invoices: [], customers: withPhones,
    });
    const started = actions.find((a) => a.title.includes('Lekkage'));
    expect(started?.preparedData?.customerPhone).toBe('+31612345678');
  });

  test('sitePhone still wins where it exists — it is the number for THIS site', () => {
    const actions = buildLiveActions({
      jobs: [{
        id: 'j-1', title: 'Lekkage keuken', status: 'in-progress',
        customerId: 'cust-003', sitePhone: '+31600000000',
        updatedAt: iso(-60 * 60 * 1000),
      }],
      quotes: [], invoices: [], customers: withPhones,
    });
    const started = actions.find((a) => a.title.includes('Lekkage'));
    expect(started?.preparedData?.customerPhone).toBe('+31600000000');
  });

  test('resolves by customer NAME when the document carries no id', () => {
    // Quotes and invoices reference the customer as a bare name on some paths.
    const actions = buildLiveActions({
      jobs: [],
      quotes: [{
        id: 'q-1', job: 'Badkamer', customer: 'Hotel NH', amount: 2400,
        status: 'sent', sentAt: iso(-5 * MS_PER_DAY),
      }],
      invoices: [], customers: withPhones,
    });
    const followUp = actions.find((a) => a.type === 'draft_followup');
    expect(followUp?.preparedData?.customerPhone).toBe('+31687654321');
  });

  test('stays undefined — never empty string — when no number is known', () => {
    // '' is truthy enough for the card's `&&` gate to render a button that
    // dials nothing, which is worse than showing no button at all.
    const actions = buildLiveActions({
      jobs: [{
        id: 'j-1', title: 'Lekkage keuken', status: 'in-progress',
        customerId: 'cust-999', updatedAt: iso(-60 * 60 * 1000),
      }],
      quotes: [], invoices: [],
      customers: [{ id: 'cust-999', name: 'Onbekend', phone: '   ' }],
    });
    const started = actions.find((a) => a.title.includes('Lekkage'));
    expect(started?.preparedData?.customerPhone).toBeUndefined();
  });
});

describe('buildLiveActions — i18n', () => {
  test('strings resolve through i18n, not hardcoded literals with raw keys', () => {
    const actions = buildLiveActions({
      jobs: [],
      quotes: [],
      invoices: [{
        id: 'inv-1', reference: 'F-1', customerId: 'cust-003',
        amount: 350, status: 'overdue', dueDate: iso(-15 * MS_PER_DAY),
      }],
      customers,
    });
    for (const s of userFacingStrings(actions)) {
      // An unresolved i18n lookup would surface the key itself.
      expect(s).not.toContain('eve.live.');
      // An un-interpolated placeholder means a param name mismatch.
      expect(s).not.toMatch(/\{\{\w+\}\}/);
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });

  test('interpolated amounts and day counts actually render', () => {
    const actions = buildLiveActions({
      jobs: [],
      quotes: [],
      invoices: [{
        id: 'inv-1', reference: 'F-1', customerId: 'cust-003',
        amount: 350, status: 'overdue', dueDate: iso(-15 * MS_PER_DAY),
      }],
      customers,
    });
    const joined = userFacingStrings(actions).join(' ');
    expect(joined).toContain('350');
    expect(joined).toContain('15');
  });
});
