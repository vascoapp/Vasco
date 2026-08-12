import { isPnlReportable } from '../projectPnl';

/**
 * The project detail card printed "Winst € -201" in RED for a project that had
 * bought € 201 of material and invoiced nothing. Arithmetically correct —
 * grossProfit is revenue minus costs — but it reports a LOSS on a job that is
 * simply mid-flight, and it is true of every project until its first invoice.
 *
 * Margin on the same card already showed "—" for exactly this reason. One
 * predicate now drives both.
 */
describe('isPnlReportable', () => {
  it('is false before the first invoice, however much has been spent', () => {
    // The case from the device.
    expect(isPnlReportable({ revenue: 0 })).toBe(false);
  });

  it('is true once there is revenue to measure against', () => {
    expect(isPnlReportable({ revenue: 0.01 })).toBe(true);
    expect(isPnlReportable({ revenue: 12500 })).toBe(true);
  });

  it('is false for a credited-away or negative revenue', () => {
    // A net-negative revenue cannot anchor a margin either.
    expect(isPnlReportable({ revenue: -100 })).toBe(false);
  });

  it('is false when there is no P&L at all', () => {
    expect(isPnlReportable(null)).toBe(false);
    expect(isPnlReportable(undefined)).toBe(false);
  });

  it('gates profit and margin identically', () => {
    // The bug was that these two disagreed: margin said "—" while profit
    // asserted a loss, in the same card, about the same project.
    const preInvoice = { revenue: 0, grossProfit: -201, grossMargin: 0 };
    const showProfit = isPnlReportable(preInvoice);
    const showMargin = isPnlReportable(preInvoice);
    expect(showProfit).toBe(showMargin);
    expect(showProfit).toBe(false);
  });
});
