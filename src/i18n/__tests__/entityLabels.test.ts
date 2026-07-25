import { makeEntityLabels, humanizeEnum } from '../entityLabels';

// A `t` that resolves only the keys we assert exist, and otherwise returns the
// defaultValue — same contract as i18next's missing-key fallback.
const KNOWN: Record<string, string> = {
  'jobs.status.inProgress': 'Bezig',
  'jobs.status.completed': 'Afgerond',
  'jobs.status.quote': 'Offerte',
  'quotes.status.accepted': 'Geaccepteerd',
  'invoices.status.overdue': 'Achterstallig',
  'onboarding.trades.plumbing': 'Loodgieterij',
};
const t = (key: string, def?: string) => KNOWN[key] ?? def ?? key;
const labels = makeEntityLabels(t);

describe('entityLabels', () => {
  it('remaps the domain enums whose locale key differs', () => {
    // JobStatus is `in-progress`/`quoted`; the keys are `inProgress`/`quote`.
    expect(labels.jobStatusLabel('in-progress')).toBe('Bezig');
    expect(labels.jobStatusLabel('in_progress')).toBe('Bezig');
    expect(labels.jobStatusLabel('quoted')).toBe('Offerte');
    expect(labels.jobStatusLabel('completed')).toBe('Afgerond');
  });

  it('localises quote and invoice statuses', () => {
    expect(labels.quoteStatusLabel('accepted')).toBe('Geaccepteerd');
    expect(labels.invoiceStatusLabel('overdue')).toBe('Achterstallig');
  });

  it('localises a trade slug and leaves an already-display name alone', () => {
    expect(labels.tradeLabel('plumbing')).toBe('Loodgieterij');
    // Some rows persist the display name rather than the slug.
    expect(labels.tradeLabel('Loodgieterij')).toBe('Loodgieterij');
  });

  it('never leaks a raw underscore/hyphen key when the locale key is missing', () => {
    // The whole point of the class: no `on_hold` or `in-progress` on screen.
    for (const raw of ['cancelled', 'on_hold', 'awaiting-parts']) {
      const out = labels.jobStatusLabel(raw);
      expect(out).not.toMatch(/[-_]/);
      expect(out[0]).toBe(out[0].toUpperCase());
    }
    expect(labels.jobStatusLabel('on_hold')).toBe('On Hold');
  });

  it('humanizeEnum title-cases every word', () => {
    expect(humanizeEnum('awaiting_customer_reply')).toBe('Awaiting Customer Reply');
  });
});
