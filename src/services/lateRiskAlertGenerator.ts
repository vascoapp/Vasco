// =============================================================================
// LATE-PAYMENT RISK ALERT GENERATOR (R213)
// =============================================================================
// Mirror of lowWinAlertGenerator but for the invoice side. When an invoice
// transitions to 'sent' and the payment-timing predictor flags it as
// likely late with high risk, enqueue a VascoCard so the Analyst agent
// can propose an earlier reminder cadence / deposit ask / payment link.
//
// Wires R195 cohort DSO fallback through into the EVE queue: new
// contractors with no personal history benefit from cohort priors.
// =============================================================================

import { predictPaymentTiming } from '../intelligence/mlModels';
import i18n from '../i18n/i18n';
import type { QueueItem } from './aiActionQueueService';
import { formatMoney } from '../i18n/formatting';

type QueueItemDraft = Omit<QueueItem, 'id' | 'status' | 'createdAt'>;

export interface LateRiskAlertInput {
  invoiceId: string;
  customerName: string | null;
  customerId?: string;
  country: string;
  amount: number;
  customerType?: string | null;
}

// Thresholds: >30-day predicted DSO AND 'high' categorical risk. Keeps
// the alert rare — mediocre DSO invoices don't need nagging.
const DAYS_THRESHOLD = 30;

export async function generateLateRiskAlert(
  input: LateRiskAlertInput,
): Promise<QueueItemDraft | null> {
  let prediction;
  try {
    prediction = await predictPaymentTiming({
      customerId: input.customerId,
      amount: input.amount,
      country: input.country,
      customerType: input.customerType ?? undefined,
    });
  } catch {
    return null;
  }

  if (!prediction) return null;
  if (prediction.predictedDays <= DAYS_THRESHOLD) return null;
  if (prediction.risk !== 'high') return null;

  const t = i18n.t.bind(i18n);
  const customer = input.customerName ?? t('common.customer', 'Customer');

  return {
    type: 'late_payment_risk_alert',
    title: t('queue.lateRiskTitle', 'Late-payment risk · {{customer}}', { customer }),
    description: t('queue.lateRiskDescription', 'Model predicts ~{{days}}-day payment ({{conf}}% conf). Send an early reminder or request a deposit on the next invoice.', {
      days: prediction.predictedDays,
      conf: Math.round(prediction.confidence * 100),
    }),
    preparedData: {
      invoiceId: input.invoiceId,
      predictedDays: prediction.predictedDays,
      confidence: prediction.confidence,
      probability30d: prediction.probability30d,
      probability60d: prediction.probability60d,
      risk: prediction.risk,
    },
    actionLabel: t('queue.lateRiskAction', 'Plan early reminder'),
    estimatedImpact: t('queue.lateRiskImpact', '~{{value}} at risk of delay', {
      value: formatMoney(input.amount),
    }),
    sourceGeneratorId: 'lateRiskAlertGenerator',
    entityKey: `late_risk:${input.invoiceId}`,
  };
}

export const __internal = { DAYS_THRESHOLD };
