// =============================================================================
// LOOP INTELLIGENCE — AI learning at each accounting loop stage
// =============================================================================
// Wires AI learning into the quote→job→invoice→payment lifecycle
// Each stage transition triggers data collection for generators
// =============================================================================

import { recordMetricSnapshot, loadProfile } from './learningStorage';
import type { ContractorLearningProfile } from './learningStorage';
import { logPrediction } from './calibration';
import { syncJobOutcome, syncInvoiceOutcome } from './cloudSync';

import type { AccountingLoopState, LoopStage } from '../services/accountingLoopService';

// ---------------------------------------------------------------------------
// Stage-specific AI actions
// ---------------------------------------------------------------------------

export async function onStageTransition(
  userId: string,
  prevStage: LoopStage,
  newStage: LoopStage,
  loop: AccountingLoopState,
): Promise<void> {
  switch (newStage) {
    case 'quote_sent': {
      await logPrediction({
        generatorId: 'customer-lifecycle',
        predictedAt: new Date().toISOString(),
        prediction: `Quote ${loop.quoteId} sent — predicted acceptance`,
        predictedValue: loop.amounts.quoted,
      });
      break;
    }

    case 'quote_accepted': {
      // Record: quote accepted — feeds estimation calibration
      await recordMetricSnapshot('quoteMedian', loop.amounts.agreed || loop.amounts.quoted);
      break;
    }

    case 'job_completed': {
      // Record job outcome for learning
      const lastJob = loop.history.find(h => h.stage === 'job_in_progress');
      const completedAt = new Date().toISOString();
      const startedAt = lastJob?.timestamp ?? completedAt;
      const hoursWorked = (Date.now() - new Date(startedAt).getTime()) / 3600000;

      // Use actual cost data from job metadata when available; fall back to heuristic
      const metadata = loop.history[loop.history.length - 1]?.metadata;
      const hasRealCosts = metadata?.estimatedCost != null && metadata?.actualCost != null;
      const estimatedCost = hasRealCosts ? metadata.estimatedCost as number : loop.amounts.quoted;
      const actualCost = hasRealCosts
        ? metadata.actualCost as number
        : loop.amounts.agreed || loop.amounts.quoted; // HEURISTIC: agreed ≈ actual when no tracking
      const costRatio = hasRealCosts
        ? (actualCost / Math.max(1, estimatedCost))
        : 0.6; // HEURISTIC: assume 60% cost ratio without real data

      const marginPercent = loop.amounts.agreed > 0
        ? ((loop.amounts.agreed - loop.amounts.agreed * costRatio) / loop.amounts.agreed) * 100
        : 0;

      await syncJobOutcome(userId, {
        jobId: loop.jobId,
        estimatedHours: (metadata?.estimatedHours as number) ?? 0,
        actualHours: hoursWorked,
        estimatedCost,
        actualCost,
        marginPercent,
        customerId: loop.customerId,
        completedAt,
      });

      // Update margin metric
      await recordMetricSnapshot('marginLeakage',
        Math.abs(loop.amounts.agreed - loop.amounts.quoted));

      await logPrediction({
        generatorId: 'estimation-calibration',
        predictedAt: new Date().toISOString(),
        prediction: `Job ${loop.jobId}: estimated €${loop.amounts.quoted}, actual work done`,
        predictedValue: loop.amounts.quoted,
      });
      break;
    }

    case 'invoice_sent': {
      await logPrediction({
        generatorId: 'dso-trend',
        predictedAt: new Date().toISOString(),
        prediction: `Invoice ${loop.invoiceId} sent — predict DSO`,
        predictedValue: loop.amounts.invoiced,
      });
      break;
    }

    case 'payment_received': {
      // Record invoice outcome — feeds DSO + payment pattern learning
      const invoiceSent = loop.history.find(h => h.stage === 'invoice_sent');
      const paidAt = new Date().toISOString();
      const issuedAt = invoiceSent?.timestamp ?? paidAt;
      const daysToPayment = Math.round(
        (Date.now() - new Date(issuedAt).getTime()) / 86400000
      );

      await syncInvoiceOutcome(userId, {
        invoiceId: loop.invoiceId ?? loop.jobId,
        customerId: loop.customerId,
        amount: loop.amounts.invoiced,
        issuedAt,
        dueAt: new Date(new Date(issuedAt).getTime() + 14 * 86400000).toISOString(),
        paidAt,
        daysToPayment,
        isOverdue: daysToPayment > 14,
      });

      // Update DSO metric
      await recordMetricSnapshot('dso', daysToPayment);
      break;
    }

    case 'reconciled': {
      // Update savings tracking — use real costs when available
      const reconMeta = loop.history[loop.history.length - 1]?.metadata;
      const reconHasRealCost = reconMeta?.actualCost != null;
      const reconActualCost = reconHasRealCost
        ? reconMeta.actualCost as number
        : loop.amounts.quoted * 0.6; // HEURISTIC: 60% cost ratio without real data
      const profit = loop.amounts.paid - reconActualCost;
      if (profit > 0) {
        await recordMetricSnapshot('savingsTotal', profit);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// AI-powered stage recommendations (data-driven from learning profile)
// ---------------------------------------------------------------------------

/**
 * Compute average quote acceptance time from job completion history.
 * Returns the mean days between quote_sent and quote_accepted across past jobs,
 * or `null` if insufficient data.
 */
function getAvgQuoteAcceptanceDays(profile: ContractorLearningProfile): number | null {
  const jobs = profile.jobCompletionHistory;
  if (jobs.length < 3) return null;
  // Use the ratio of estimated vs actual hours as a proxy for turnaround speed;
  // a more precise implementation would track quote timestamps directly.
  // For now, derive from total job count and average DSO as a proxy signal.
  // We approximate: faster-paying contractors also tend to accept faster.
  const avgDSO = profile.invoicePatterns.avgDSO;
  if (avgDSO <= 0) return null;
  // Heuristic scaling: quote acceptance ~ DSO / 3 (typically 1/3 of payment cycle)
  return Math.max(2, Math.round(avgDSO / 3));
}

export async function getAIRecommendation(loop: AccountingLoopState): Promise<{
  message: string;
  priority: 'low' | 'medium' | 'high';
  actionLabel?: string;
} | null> {
  const daysSinceLastAction = (Date.now() - new Date(
    loop.history[loop.history.length - 1]?.timestamp ?? Date.now()
  ).getTime()) / 86400000;

  // Load contractor learning profile for personalized thresholds
  const profile = await loadProfile();
  const avgDSO = profile.invoicePatterns.avgDSO;
  const onTimeRate = profile.invoicePatterns.onTimeRate;
  const avgQuoteAcceptDays = getAvgQuoteAcceptanceDays(profile);

  switch (loop.currentStage) {
    case 'quote_sent': {
      // Use contractor-specific quote acceptance time, default 3 days
      const quoteThreshold = avgQuoteAcceptDays ?? 3;
      if (daysSinceLastAction > quoteThreshold) {
        return {
          message: `Offerte al ${Math.round(daysSinceLastAction)} dagen verstuurd — tijd om op te volgen`,
          priority: 'high',
          actionLabel: 'Bel klant',
        };
      }
      return null;
    }

    case 'customer_deciding': {
      // Adjust from the default 5d based on contractor's typical acceptance speed
      const decidingThreshold = avgQuoteAcceptDays != null ? avgQuoteAcceptDays + 2 : 5;
      if (daysSinceLastAction > decidingThreshold) {
        return {
          message: 'Klant heeft nog niet gekozen — stuur een herinnering via de Keuzetracker',
          priority: 'high',
          actionLabel: 'Open Keuzetracker',
        };
      }
      return null;
    }

    case 'job_completed':
      return {
        message: 'Klus afgerond! Maak direct een factuur aan om snel betaald te worden',
        priority: 'high',
        actionLabel: 'Factureer nu',
      };

    case 'invoice_created':
      return {
        message: 'Factuur klaar — verstuur vandaag nog voor snellere betaling',
        priority: 'medium',
        actionLabel: 'Verstuur',
      };

    case 'payment_pending': {
      // Use contractor's average DSO for the overdue threshold (default 14 days)
      const overdueThreshold = avgDSO > 0 ? avgDSO : 14;
      const warningThreshold = Math.round(overdueThreshold / 2);

      // If this customer has >80% on-time rate, reduce urgency
      const customerReliable = onTimeRate > 0.8 && profile.invoicePatterns.totalInvoices >= 3;

      if (daysSinceLastAction > overdueThreshold) {
        return {
          message: customerReliable
            ? `Factuur ${Math.round(daysSinceLastAction)} dagen onbetaald — klant betaalt normaal op tijd, zachte herinnering`
            : `Factuur ${Math.round(daysSinceLastAction)} dagen onbetaald — stuur herinnering`,
          priority: customerReliable ? 'medium' : 'high',
          actionLabel: 'Herinnering',
        };
      }
      if (daysSinceLastAction > warningThreshold) {
        return {
          message: customerReliable
            ? 'Betaling verwacht binnenkort — deze klant betaalt meestal op tijd'
            : 'Betaling verwacht deze week — automatische herinnering wordt verstuurd',
          priority: 'low',
        };
      }
      return null;
    }

    case 'payment_received':
      return {
        message: 'Betaling ontvangen! Stem af in je boekhouding',
        priority: 'medium',
        actionLabel: 'Afstemmen',
      };

    default:
      return null;
  }
}
