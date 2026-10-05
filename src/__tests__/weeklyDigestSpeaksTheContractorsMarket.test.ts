/**
 * @jest-environment node
 */
// The Monday digest (supabase/functions/_shared/weeklyDigestEmail.ts) is in the
// contractor's language and currency. Its first template had never run: rows
// always English, German "du", "€" without cents everywhere, the business name
// unescaped (2026-10-05).
import { renderWeeklyDigest, digestMoney } from '../../supabase/functions/_shared/weeklyDigestEmail';

const base = { businessName: 'Bau & Söhne <GmbH>', newJobs: 1, paidInvoices: 2, paidAmount: 1234.5, openInvoices: 1, openAmount: 99, quotesSent: 1, quotesAccepted: 0 };

it.each([
  ['NL', 'Jouw Vasco-week', /1 nieuwe klus\b/, /€\u00A01\.234,50/],
  ['DE', 'Ihre Vasco-Woche', /1 neuer Auftrag/, /€\u00A01\.234,50/],
  ['FR', 'Votre semaine Vasco', /1 nouveau chantier/, /€\u00A01[\u202F\u00A0 ]234,50/],
  ['ES', 'Su semana en Vasco', /1 trabajo nuevo/, /€\u00A01\.?234,50/],
  ['IT', 'La tua settimana Vasco', /1 nuovo lavoro/, /€\u00A01\.?234,50/],
  ['UK', 'Your Vasco week', /1 new job\b/, /£1,234\.50/],
])('%s: language, singular and currency', (country, subject, jobRow, money) => {
  const mail = renderWeeklyDigest({ ...base, country })!;
  expect(mail.subject).toBe(subject);
  expect(mail.html).toMatch(jobRow);
  expect(mail.html).toMatch(money);
});

it('German is Sie, never du', () => {
  const mail = renderWeeklyDigest({ ...base, country: 'DE' })!;
  expect(`${mail.subject} ${mail.html}`).not.toMatch(/\b(Deine|deine|Dein|dein|du)\b/);
  expect(mail.html).toMatch(/Ihnen/);
});

it('plural rows when the count is not 1', () => {
  const mail = renderWeeklyDigest({ ...base, country: 'NL', newJobs: 3, paidInvoices: 1 })!;
  expect(mail.html).toMatch(/3 nieuwe klussen/);
  expect(mail.html).toMatch(/1 factuur betaald/);
});

it('the business name is escaped into the HTML', () => {
  const html = renderWeeklyDigest({ ...base, country: 'DE' })!.html;
  expect(html).toMatch(/Bau &amp; Söhne &lt;GmbH&gt;/);
  expect(html).not.toMatch(/<GmbH>/);
});

it('an unknown market gets no email, never a guessed one', () => {
  expect(renderWeeklyDigest({ ...base, country: null })).toBeNull();
  expect(renderWeeklyDigest({ ...base, country: 'XX' })).toBeNull();
});

it('money keeps its cents and the sign before the amount', () => {
  expect(digestMoney(0.5, 'NL')).toBe('€\u00A00,50');
  // …identical to the app's own formatter (one rule: _shared/euroLeading.ts).
  const { formatCurrency } = require('../i18n/formatting');
  for (const c of ['NL', 'DE', 'FR', 'ES', 'IT', 'UK']) expect(digestMoney(1234.5, c)).toBe(formatCurrency(1234.5, c));
});
