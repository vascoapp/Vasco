/**
 * Whether a project's P&L figures mean anything yet.
 *
 * `getProjectPnL` computes `grossProfit = revenue - totalCosts` and
 * `grossMargin = revenue > 0 ? … : 0`. Before the first invoice, revenue is 0,
 * so gross profit is simply costs-so-far negated: a project that had bought
 * € 201 of material and billed nothing reported "Winst € -201" in RED. That is
 * a loss reported on a job that is mid-flight and perfectly healthy — and it
 * is true of EVERY project until its first invoice, which trains the
 * contractor to ignore the number entirely.
 *
 * Margin was already guarded this way; profit was not, and the two sat in the
 * same card contradicting each other about how much the app claimed to know.
 * One predicate now drives both so they cannot drift apart again.
 *
 * The costs are NOT hidden by this — Materiaal and Arbeid are printed
 * alongside, and they are facts. It is the DERIVED figures that need revenue
 * before they say anything.
 */
export function isPnlReportable(pnl: { revenue: number } | null | undefined): boolean {
  return !!pnl && pnl.revenue > 0;
}
