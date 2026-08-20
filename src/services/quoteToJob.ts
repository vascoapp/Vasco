import type { Job } from '../domain/jobs';
import type { Quote } from '../domain/documents';

/**
 * The quote → job field mapping, in ONE place.
 *
 * AppState had two of these. `convertQuoteToJob` is the real one; a second,
 * inline copy inside `updateQuote` fires when a quote's status flips to
 * 'accepted', introduced with the comment "replicates the same logic to avoid
 * circular reference issues". They had already drifted:
 *
 *   - different title fallbacks (one Dutch literal, one English literal),
 *   - different trade fallbacks (one had none, so the converted job matched no
 *     job form — learnings #109 all over again),
 *   - only one of them carried the customer's preferred date.
 *
 * And BOTH set `description: null`, so the scope of work the customer accepted
 * — the narrative the contractor wrote, the customer read, and the quote PDF
 * printed — stopped dead at acceptance. The job you then go and do had no
 * description at all.
 */
export function buildJobFromQuote(args: {
  quote: Quote;
  quoteId: string;
  id: string;
  now: string;
  /** Contractor's own trade, used when the quote does not name one. */
  tradeFallback?: string;
  /** Customer's preferred date, already validated by the caller. */
  scheduledDate?: string;
  /** Localized "Job from quote {{ref}}" — never a hardcoded literal. */
  titleFallback: string;
}): Job {
  const { quote, quoteId, id, now, tradeFallback, scheduledDate, titleFallback } = args;
  return {
    id,
    customerId: quote.customerId ?? quote.customer ?? null,
    quoteId,
    title: quote.job || titleFallback,
    description: quote.description ?? null,
    status: 'scheduled',
    quotedAmount: quote.amount,
    agreedAmount: quote.amount,
    trade: quote.trade ?? tradeFallback ?? undefined,
    priority: 'normal',
    photos: [],
    notes: [],
    timeEntries: [],
    materials: [],
    scheduledDate,
    createdAt: now,
    updatedAt: now,
  } as Job;
}
