import { buildJobFromQuote } from '../quoteToJob';
import type { Quote } from '../../domain/documents';

const quote: Quote = {
  id: 'Q-260001',
  customer: 'cust-003',
  customerId: 'cust-003',
  job: 'Badsanierung Hoffmann',
  description: 'Inbegriffen: Demontage der alten Sanitärobjekte…\nAusgeschlossen: Fliesenarbeiten.\nGewährleistung: 2 Jahre.',
  amount: 9400,
  status: 'sent',
  trade: 'plumbing',
  lastUpdated: 'just now',
};

const base = {
  quote,
  quoteId: 'Q-260001',
  id: 'j-1',
  now: '2026-08-20T10:00:00.000Z',
  titleFallback: 'Auftrag aus Angebot Q-260001',
};

describe('buildJobFromQuote', () => {
  it('carries the accepted scope of work onto the job', () => {
    // Both former copies hardcoded `description: null`, so the narrative the
    // customer agreed to never reached the job it describes.
    expect(buildJobFromQuote(base).description).toBe(quote.description);
  });

  it('keeps the link back to the quote and the agreed amounts', () => {
    const job = buildJobFromQuote(base);
    expect(job.quoteId).toBe('Q-260001');
    expect(job.quotedAmount).toBe(9400);
    expect(job.agreedAmount).toBe(9400);
  });

  it('prefers the quote customer id over the display field', () => {
    const job = buildJobFromQuote({ ...base, quote: { ...quote, customer: 'Anja Hoffmann', customerId: 'cust-003' } });
    expect(job.customerId).toBe('cust-003');
  });

  it('falls back to the localized title, never a hardcoded literal', () => {
    const job = buildJobFromQuote({ ...base, quote: { ...quote, job: '' } });
    expect(job.title).toBe('Auftrag aus Angebot Q-260001');
    expect(job.title).not.toMatch(/Klus van offerte/);
  });

  it('takes the contractor trade when the quote names none — a job with no trade matches no job form', () => {
    const job = buildJobFromQuote({ ...base, quote: { ...quote, trade: undefined }, tradeFallback: 'electrical' });
    expect(job.trade).toBe('electrical');
  });

  it('keeps the quote trade when it has one', () => {
    expect(buildJobFromQuote({ ...base, tradeFallback: 'electrical' }).trade).toBe('plumbing');
  });

  it('carries the customer preferred date through', () => {
    const job = buildJobFromQuote({ ...base, scheduledDate: '2026-09-01T00:00:00.000Z' });
    expect(job.scheduledDate).toBe('2026-09-01T00:00:00.000Z');
  });

  it('starts the job scheduled, with empty logs rather than undefined ones', () => {
    const job = buildJobFromQuote(base);
    expect(job.status).toBe('scheduled');
    expect(job.timeEntries).toEqual([]);
    expect(job.photos).toEqual([]);
  });

  it('has no description when the quote never had one', () => {
    expect(buildJobFromQuote({ ...base, quote: { ...quote, description: undefined } }).description).toBeNull();
  });
});
