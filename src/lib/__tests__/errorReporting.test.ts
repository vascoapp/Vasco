/**
 * @jest-environment node
 *
 * R66r71: PII scrubbing in errorReporting. The privacy questionnaire
 * (docs/app-privacy-questionnaire.md) claims we don't ship email /
 * phone / IBAN / VAT / JWT to Sentry. These tests prove the claim.
 */

import { scrubPii } from '../errorReporting';

describe('scrubPii', () => {
  // ─── String input ────────────────────────────────────────────────────────
  describe('email', () => {
    test('replaces email with <email>', () => {
      expect(scrubPii('Failed to send to jan@example.com'))
        .toBe('Failed to send to <email>');
    });
    test('replaces multiple emails', () => {
      expect(scrubPii('cc: a@b.com, d@e.io, f@g.co.uk'))
        .toBe('cc: <email>, <email>, <email>');
    });
    test('handles plus addressing', () => {
      expect(scrubPii('user+tag@example.com sent it'))
        .toBe('<email> sent it');
    });
  });

  describe('IBAN', () => {
    test('replaces NL IBAN', () => {
      expect(scrubPii('Pay to NL91ABNA0417164300 today'))
        .toBe('Pay to <iban> today');
    });
    test('replaces DE IBAN with spaces', () => {
      expect(scrubPii('IBAN DE89 3704 0044 0532 0130 00 verified'))
        .toBe('IBAN <iban> verified');
    });
  });

  describe('VAT / BTW', () => {
    test('replaces NL BTW', () => {
      expect(scrubPii('Reverse charge: NL123456789B01'))
        .toBe('Reverse charge: <vat>');
    });
    test('replaces DE USt-IdNr', () => {
      expect(scrubPii('Customer DE123456789 invoice'))
        .toBe('Customer <vat> invoice');
    });
    test('replaces FR TVA', () => {
      expect(scrubPii('FR12345678901 is the issuer'))
        .toBe('<vat> is the issuer');
    });
  });

  describe('phone', () => {
    test('replaces +country phone', () => {
      expect(scrubPii('Call +31 20 123 4567 for support'))
        .toBe('Call <phone> for support');
    });
    test('replaces 00-prefix international', () => {
      expect(scrubPii('Dial 0049 30 12345678 first'))
        .toBe('Dial <phone> first');
    });
  });

  describe('JWT', () => {
    test('replaces Supabase JWT', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SignatureBitHere';
      expect(scrubPii(`Bearer ${jwt}`)).toBe('Bearer <jwt>');
    });
  });

  // ─── Object input (Sentry context.extra shape) ─────────────────────────
  describe('object', () => {
    test('scrubs string values inside an object', () => {
      const ctx = {
        customerEmail: 'jan@example.com',
        amount: 100,
        note: 'IBAN NL91ABNA0417164300 used',
      };
      expect(scrubPii(ctx)).toEqual({
        customerEmail: '<email>',
        amount: 100,
        note: 'IBAN <iban> used',
      });
    });
    test('recurses into nested objects', () => {
      const ctx = {
        customer: { email: 'a@b.io', name: 'Jan' },
        items: ['ok', 'phone +31201234567'],
      };
      expect(scrubPii(ctx)).toEqual({
        customer: { email: '<email>', name: 'Jan' },
        items: ['ok', 'phone <phone>'],
      });
    });
    test('preserves non-PII fields untouched', () => {
      const ctx = { route: '/contractor/job/abc', amount: 42, ok: true };
      expect(scrubPii(ctx)).toEqual(ctx);
    });
  });

  // ─── Error input (preserves type) ──────────────────────────────────────
  describe('Error', () => {
    test('returns a new Error with scrubbed message + stack', () => {
      const err = new Error('Send failed for jan@example.com (IBAN NL91ABNA0417164300)');
      const scrubbed = scrubPii(err);
      expect(scrubbed).toBeInstanceOf(Error);
      expect((scrubbed as Error).message).toBe('Send failed for <email> (IBAN <iban>)');
      // Stack contains the original message too — must also be scrubbed
      expect((scrubbed as Error).stack).not.toContain('jan@example.com');
      expect((scrubbed as Error).stack).not.toContain('NL91ABNA0417164300');
    });
    test('preserves Error name (e.g. TypeError)', () => {
      const err = new TypeError('Bad type for a@b.io');
      const scrubbed = scrubPii(err) as Error;
      expect(scrubbed.name).toBe('TypeError');
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('edge cases', () => {
    test('null / undefined pass through', () => {
      expect(scrubPii(null)).toBe(null);
      expect(scrubPii(undefined)).toBe(undefined);
    });
    test('numbers + booleans pass through', () => {
      expect(scrubPii(42)).toBe(42);
      expect(scrubPii(true)).toBe(true);
    });
    test('strings with no PII pass through unchanged', () => {
      expect(scrubPii('Quote total: 1234.56 EUR'))
        .toBe('Quote total: 1234.56 EUR');
    });
    test('empty string passes through', () => {
      expect(scrubPii('')).toBe('');
    });
  });

  // ─── Order matters: IBAN before phone ──────────────────────────────────
  describe('precedence', () => {
    test('IBAN scrubbed before phone regex could overmatch the digits', () => {
      const s = 'IBAN NL91ABNA0417164300 phone +31201234567';
      const out = scrubPii(s) as string;
      expect(out).toContain('<iban>');
      expect(out).toContain('<phone>');
      expect(out).not.toContain('NL91');
      expect(out).not.toContain('1234567');
    });
  });
});
