/**
 * Nothing stopped putting a schilder on a gas job: Worker.trade and Job.trade
 * both existed and were never compared.
 *
 * The trap this guards is the codebase's own inconsistency — trade is stored
 * as a slug on some rows and as a display name on others, so a naive string
 * compare fires a false warning on half the jobs. False warnings are worse
 * than none: they teach people to tap through the dialog.
 */
import { tradeMismatch } from '../crewAssignment';

// Mirrors makeEntityLabels: slug -> display, unknown values pass through.
const LABELS: Record<string, string> = {
  plumbing: 'Loodgieterij',
  painting: 'Schilderwerk',
  electrical: 'Elektra',
  'gas-hvac': 'Gas & CV',
};
const tradeLabel = (raw: string) => LABELS[raw] ?? raw;

const worker = (trade?: string) => ({ id: 'w1', name: 'Sanne', trade });

describe('tradeMismatch', () => {
  it('flags a painter put on a gas job', () => {
    const m = tradeMismatch(worker('painting'), { title: 'CV-ketel', trade: 'gas-hvac' }, tradeLabel);
    expect(m).not.toBeNull();
    expect(m!.workerName).toBe('Sanne');
    expect(m!.workerTrade).toBe('Schilderwerk');
    expect(m!.jobTrade).toBe('Gas & CV');
  });

  it('is quiet when the trades match', () => {
    expect(tradeMismatch(worker('plumbing'), { trade: 'plumbing' }, tradeLabel)).toBeNull();
  });

  it('does NOT warn when one side is a slug and the other its display name', () => {
    // The demo data alone carries both spellings. Comparing raw strings would
    // have warned on every one of these.
    expect(tradeMismatch(worker('plumbing'), { trade: 'Loodgieterij' }, tradeLabel)).toBeNull();
    expect(tradeMismatch(worker('Loodgieterij'), { trade: 'plumbing' }, tradeLabel)).toBeNull();
  });

  it('ignores case', () => {
    expect(tradeMismatch(worker('Plumbing'), { trade: 'plumbing' }, tradeLabel)).toBeNull();
  });

  it('stays silent when the worker has no trade recorded', () => {
    // A blank field is not evidence the person cannot do the work — same rule
    // the week-view staffing gaps use, so the two cannot disagree.
    expect(tradeMismatch(worker(undefined), { trade: 'gas-hvac' }, tradeLabel)).toBeNull();
    expect(tradeMismatch(worker('  '), { trade: 'gas-hvac' }, tradeLabel)).toBeNull();
  });

  it('stays silent when the job names no trade', () => {
    expect(tradeMismatch(worker('painting'), { trade: undefined }, tradeLabel)).toBeNull();
    expect(tradeMismatch(worker('painting'), {}, tradeLabel)).toBeNull();
  });

  it('handles a missing worker without throwing', () => {
    expect(tradeMismatch(undefined, { trade: 'painting' }, tradeLabel)).toBeNull();
    expect(tradeMismatch(null, null, tradeLabel)).toBeNull();
  });

  it('reports display labels, never raw slugs', () => {
    const m = tradeMismatch(worker('painting'), { trade: 'electrical' }, tradeLabel);
    expect(m!.workerTrade).not.toMatch(/-|_/);
    expect(m!.jobTrade).toBe('Elektra');
  });
});
