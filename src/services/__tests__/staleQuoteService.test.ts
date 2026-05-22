import { findStaleQuotes, shouldAutoReject, DEFAULT_STALE_DAYS } from '../staleQuoteService';
import type { Quote } from '../../domain/documents';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-05-22T12:00:00Z').getTime();

function makeQuote(overrides: Partial<Quote>): Quote {
  return {
    id: `q-${Math.random().toString(36).slice(2, 9)}`,
    customer: 'cust-1',
    job: 'Test job',
    amount: 500,
    status: 'sent',
    lastUpdated: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('staleQuoteService', () => {
  describe('findStaleQuotes', () => {
    it('returns empty for no quotes', () => {
      expect(findStaleQuotes([])).toEqual({ staleIds: [], details: [] });
    });

    it('flags a sent quote older than 30 days', () => {
      const q = makeQuote({
        id: 'stale',
        sentAt: new Date(NOW - 31 * MS_PER_DAY).toISOString(),
      });
      const { staleIds, details } = findStaleQuotes([q], DEFAULT_STALE_DAYS, NOW);
      expect(staleIds).toEqual(['stale']);
      expect(details[0].daysStale).toBe(31);
    });

    it('ignores quotes younger than the threshold', () => {
      const q = makeQuote({ sentAt: new Date(NOW - 15 * MS_PER_DAY).toISOString() });
      expect(findStaleQuotes([q], 30, NOW).staleIds).toEqual([]);
    });

    it('ignores non-sent quotes regardless of age', () => {
      const old = new Date(NOW - 60 * MS_PER_DAY).toISOString();
      const quotes: Quote[] = [
        makeQuote({ id: 'draft', status: 'draft' as any, sentAt: old }),
        makeQuote({ id: 'accepted', status: 'accepted' as any, sentAt: old }),
        makeQuote({ id: 'rejected', status: 'rejected', sentAt: old }),
      ];
      expect(findStaleQuotes(quotes, 30, NOW).staleIds).toEqual([]);
    });

    it('ignores quotes without sentAt (legacy rows)', () => {
      const q = makeQuote({ sentAt: undefined });
      expect(findStaleQuotes([q], 30, NOW).staleIds).toEqual([]);
    });

    it('sorts results most-stale-first', () => {
      const quotes: Quote[] = [
        makeQuote({ id: 'a', sentAt: new Date(NOW - 40 * MS_PER_DAY).toISOString() }),
        makeQuote({ id: 'b', sentAt: new Date(NOW - 90 * MS_PER_DAY).toISOString() }),
        makeQuote({ id: 'c', sentAt: new Date(NOW - 35 * MS_PER_DAY).toISOString() }),
      ];
      const { staleIds } = findStaleQuotes(quotes, 30, NOW);
      expect(staleIds).toEqual(['b', 'a', 'c']);
    });

    it('respects custom threshold', () => {
      const q = makeQuote({ sentAt: new Date(NOW - 8 * MS_PER_DAY).toISOString() });
      expect(findStaleQuotes([q], 7, NOW).staleIds.length).toBe(1);
      expect(findStaleQuotes([q], 30, NOW).staleIds.length).toBe(0);
    });

    it('handles invalid sentAt timestamps gracefully', () => {
      const q = makeQuote({ sentAt: 'not-a-date' });
      expect(findStaleQuotes([q], 30, NOW).staleIds).toEqual([]);
    });

    it('returns customer + amount in details for callers', () => {
      const q = makeQuote({
        id: 'q1',
        customer: 'cust-99',
        amount: 1280,
        sentAt: new Date(NOW - 45 * MS_PER_DAY).toISOString(),
      });
      const { details } = findStaleQuotes([q], 30, NOW);
      expect(details[0]).toMatchObject({ id: 'q1', customerId: 'cust-99', amount: 1280 });
    });
  });

  describe('shouldAutoReject', () => {
    it('agrees with findStaleQuotes on the threshold', () => {
      const ripe = makeQuote({ sentAt: new Date(NOW - 31 * MS_PER_DAY).toISOString() });
      const fresh = makeQuote({ sentAt: new Date(NOW - 10 * MS_PER_DAY).toISOString() });
      expect(shouldAutoReject(ripe, 30, NOW)).toBe(true);
      expect(shouldAutoReject(fresh, 30, NOW)).toBe(false);
    });

    it('returns false for non-sent quotes', () => {
      const q = makeQuote({
        status: 'rejected',
        sentAt: new Date(NOW - 60 * MS_PER_DAY).toISOString(),
      });
      expect(shouldAutoReject(q, 30, NOW)).toBe(false);
    });

    it('returns false when sentAt missing', () => {
      expect(shouldAutoReject(makeQuote({ sentAt: undefined }), 30, NOW)).toBe(false);
    });
  });
});
