// =============================================================================
// A billing problem in the contractor's language.
// =============================================================================
// progressBillingService explains every refusal (schedule, change order,
// retention) in English — right for logs and tests, wrong on a Dutch screen:
// '"Extra stopcontacten keuken" is approved but has no record of the price
// warning (art. 7:755 BW)' showed verbatim to an aannemer (walk, 2026-09-29).
// Each problem now carries a stable `i18nKey` + raw `params`; this renders it
// under `billingProblem.*`, formatting money and percentages for the
// contractor's market. Falls back to the English message.
// =============================================================================
import appI18n from '../i18n/i18n';
import { formatCurrency, formatPercentValue } from '../i18n/formatting';
import type { BillingProblemParams } from './progressBillingService';
import { statuteSuffix } from '../domain/extraWorkLaw';
import { getCurrentCountry } from '../lib/currentUser';

const MONEY = new Set(['fixed', 'value']);
const PERCENT = new Set(['percent']);

export function billingProblemText(problem: {
  i18nKey?: string;
  params?: BillingProblemParams;
  message?: string;
  reason?: string;
}): string {
  const fallback = problem.message ?? problem.reason ?? '';
  if (!problem.i18nKey) return fallback;
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(problem.params ?? {})) {
    params[k] = typeof v === 'number' && MONEY.has(k) ? formatCurrency(v)
      : typeof v === 'number' && PERCENT.has(k) ? formatPercentValue(v)
      : v;
  }
  // The extra-work statute is the CONTRACTOR's country's — " (art. 7:755 BW)",
  // " (§ 650b/650c BGB)", or nothing where none applies (extraWorkLaw.ts).
  const statute = statuteSuffix(getCurrentCountry());
  return appI18n.t(`billingProblem.${problem.i18nKey}`, { statute, ...params, defaultValue: fallback });
}
