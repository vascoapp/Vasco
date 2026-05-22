// =============================================================================
// STALE QUOTE SERVICE — Auto-mark sent-but-unanswered quotes as rejected
// =============================================================================
// R94 (companion to R81 auto-lead-from-rejected-estimate).
//
// Pre-R94 a sent quote that sat unanswered for 30+ days stayed in 'sent'
// status forever. The lead never landed in the pipeline as 'lost'.
// Contractors had to manually mark it rejected to surface it, which
// nobody actually does.
//
// This service finds quotes that crossed the staleness threshold and
// flips them to 'rejected' — which then triggers the existing R81
// auto-lead with source='rejected_estimate'. Lead lands in the
// Lost column of the Kanban with the quote backlink, contractor sees
// the loss + can re-engage.
//
// Caller: Vandaag tab cold-start (lazy, on focus) + optional daily
// cron sweep server-side. The current implementation is client-side
// only — the contractor's own data, their own client.
// =============================================================================

import type { Quote } from '../domain/documents';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Default staleness threshold. 30 days matches the EU 2011/7/EU
// late-payment recovery window + most contractor mental models
// ("if they haven't responded in a month, they're not buying").
export const DEFAULT_STALE_DAYS = 30;

export interface StaleQuoteSummary {
  staleIds: string[];
  // Most-stale-first ordering for prompt UX
  details: Array<{ id: string; customerId?: string; daysStale: number; amount: number }>;
}

/**
 * Identify quotes that crossed the staleness threshold.
 *
 * A quote is stale when:
 *   - status === 'sent'
 *   - sentAt is set (older codepaths may not have set it; skip those)
 *   - now - sentAt >= staleDays
 *
 * Quotes without `sentAt` are skipped — we can't tell when they were
 * sent so we don't auto-reject them. This guards against legacy quotes
 * that pre-date the R165 sentAt write.
 */
export function findStaleQuotes(
  quotes: Quote[],
  staleDays: number = DEFAULT_STALE_DAYS,
  now: number = Date.now(),
): StaleQuoteSummary {
  const thresholdMs = staleDays * MS_PER_DAY;
  const details: StaleQuoteSummary['details'] = [];

  for (const q of quotes) {
    if (q.status !== 'sent') continue;
    if (!q.sentAt) continue;
    const sentMs = new Date(q.sentAt).getTime();
    if (isNaN(sentMs)) continue;
    const daysStale = Math.floor((now - sentMs) / MS_PER_DAY);
    if (daysStale >= staleDays) {
      details.push({
        id: q.id,
        customerId: q.customer ?? undefined,
        daysStale,
        amount: q.amount,
      });
    }
  }

  details.sort((a, b) => b.daysStale - a.daysStale);
  return { staleIds: details.map((d) => d.id), details };
}

/**
 * Auto-reject stale quotes. Caller is the Vandaag cold-start sweep or
 * the daily cron. Returns the IDs that were flipped — caller logs +
 * the existing R81 hook in updateQuote auto-creates the 'lost' lead.
 *
 * Side-effect-free function: the caller orchestrates the actual
 * updateQuote calls so we don't import AppState here (avoids circular
 * deps + keeps this service pure for testing).
 */
export function shouldAutoReject(quote: Quote, staleDays: number = DEFAULT_STALE_DAYS, now: number = Date.now()): boolean {
  if (quote.status !== 'sent') return false;
  if (!quote.sentAt) return false;
  const sentMs = new Date(quote.sentAt).getTime();
  if (isNaN(sentMs)) return false;
  return (now - sentMs) / MS_PER_DAY >= staleDays;
}
