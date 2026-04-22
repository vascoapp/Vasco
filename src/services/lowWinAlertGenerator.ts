// =============================================================================
// LOW-WIN-PROBABILITY ALERT GENERATOR (R209)
// =============================================================================
// Wires the cohort-trained quote-win model (R191/R208) into the EVE queue.
// When a newly-sent quote scores low probability with high confidence,
// enqueue a VascoCard nudging the contractor to follow up faster or
// consider a price adjustment — turning a passive prediction into an
// action the Analyst agent can propose.
//
// The generator intentionally returns `null` when the signal is weak
// (low confidence, high probability, or model unavailable) so the queue
// stays quiet during normal operation.
// =============================================================================

import { predictQuoteWin } from '../intelligence/mlModels';
import i18n from '../i18n/i18n';
import type { QueueItem } from './aiActionQueueService';

type QueueItemDraft = Omit<QueueItem, 'id' | 'status' | 'createdAt'>;

export interface LowWinAlertInput {
  quoteId: string;
  customerName: string | null;
  trade: string;
  country: string;
  amount: number;
  customerType?: string | null;
}

// Thresholds chosen to keep the signal rare enough to be worth showing.
// <35% win probability AND ≥60% confidence filters out cold-start noise
// where the model hasn't been trained yet or has too thin a sample.
const WIN_PROB_THRESHOLD = 0.35;
const MIN_CONFIDENCE = 0.6;

export async function generateLowWinAlert(
  input: LowWinAlertInput,
): Promise<QueueItemDraft | null> {
  let prediction;
  try {
    prediction = await predictQuoteWin({
      trade: input.trade,
      country: input.country,
      amount: input.amount,
      customerType: input.customerType ?? undefined,
    });
  } catch {
    return null;
  }

  if (!prediction) return null;
  if (prediction.probability >= WIN_PROB_THRESHOLD) return null;
  if (prediction.confidence < MIN_CONFIDENCE) return null;

  const t = i18n.t.bind(i18n);
  const pct = Math.round(prediction.probability * 100);
  const customer = input.customerName ?? t('common.customer', 'Customer');

  return {
    type: 'low_win_alert',
    title: t('queue.lowWinTitle', 'Low win chance · {{customer}}', { customer }),
    description: t('queue.lowWinDescription', 'Model predicts {{pct}}% acceptance. Consider a follow-up call or a small discount.', { pct }),
    preparedData: {
      quoteId: input.quoteId,
      probability: prediction.probability,
      confidence: prediction.confidence,
      suggestedPriceRange: prediction.suggestedPriceRange,
      recommendation: prediction.recommendation,
    },
    actionLabel: t('queue.lowWinAction', 'Plan follow-up'),
    estimatedImpact: t('queue.lowWinImpact', '~€{{value}} at stake', {
      value: Math.round(input.amount),
    }),
    sourceGeneratorId: 'lowWinAlertGenerator',
    entityKey: `low_win:${input.quoteId}`,
  };
}

export const __internal = { WIN_PROB_THRESHOLD, MIN_CONFIDENCE };
