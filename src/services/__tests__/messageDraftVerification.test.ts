// =============================================================================
// MESSAGE DRAFT VERIFICATION
// =============================================================================
// Tier 4 is the only tier where the model handles real customer data and real
// figures, and it is safe only because the EVE queue never auto-sends. This
// machine check sits UNDER that human gate and targets the one failure a human
// skimming on a phone reliably misses: a wrong number.
// =============================================================================

import {
  verifyMessageDraft,
  extractNumbers,
  normaliseNumber,
  summariseDraftVerification,
} from '../messageDraftVerification';

const FACTS = {
  allowedValues: ['€ 1.234,50', '14', '2026-08-19'],
  allowedNames: ['Fam. de Vries'],
  tokens: ['[CUSTOMER_NAME]', '[BUSINESS_NAME]'],
};

describe('number normalisation across locales', () => {
  it.each([
    ['1.234,50', '1234.5'],
    ['1234.50', '1234.5'],
    ['1 234,50', '1234.5'],
    ['1234,5', '1234.5'],
    ['12,00', '12'],
    ['007', '7'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normaliseNumber(input)).toBe(expected);
  });

  it('treats a 3-digit group as thousands, symmetrically on both sides', () => {
    expect(normaliseNumber('1.234')).toBe(normaliseNumber('1234'));
  });

  it('pulls every number out of a sentence', () => {
    expect(extractNumbers('3 facturen, € 1.234,50, 14 dagen')).toEqual(['3', '1234.5', '14']);
  });
});

describe('the core rule: no invented figures', () => {
  it('accepts a draft using only supplied numbers', () => {
    const r = verifyMessageDraft(
      'Beste Fam. de Vries, uw factuur van € 1.234,50 staat 14 dagen open. Kunt u deze voldoen?',
      FACTS,
    );
    expect(r.ok).toBe(true);
    expect(r.unsupportedNumbers).toEqual([]);
    expect(summariseDraftVerification(r)).toMatch(/ready/i);
  });

  // THE test. A plausible message with a wrong amount is what a human skimming
  // on a phone will not catch.
  it('rejects an invented amount', () => {
    const r = verifyMessageDraft('Uw factuur van € 2.500,00 staat open.', FACTS);
    expect(r.ok).toBe(false);
    expect(r.unsupportedNumbers).toContain('2500');
    // Assert the ISSUE CODE too, not only the convenience array — a consumer
    // branching on `issues[].code` had no coverage until a sweep found it.
    expect(r.issues.some((i) => i.code === 'unsupported_number' && i.severity === 'fatal')).toBe(true);
    expect(summariseDraftVerification(r)).toMatch(/rejected/i);
  });

  it('rejects an invented deadline', () => {
    const r = verifyMessageDraft('Graag betalen voor 30 dagen na de factuurdatum.', FACTS);
    expect(r.ok).toBe(false);
  });

  it('accepts the same amount written a different way', () => {
    // Model renders it as 1234.50 rather than € 1.234,50 — same number.
    const r = verifyMessageDraft('Het openstaande bedrag is 1234.50 euro na 14 dagen.', FACTS);
    expect(r.ok).toBe(true);
  });

  it('allows omitting facts — the model may select, just not originate', () => {
    const r = verifyMessageDraft('Beste Fam. de Vries, uw factuur staat nog open.', FACTS);
    expect(r.ok).toBe(true);
  });

  it('reports every unsupported number, not just the first', () => {
    const r = verifyMessageDraft('99 facturen van € 5.000,00 sinds 77 dagen.', FACTS);
    expect(new Set(r.unsupportedNumbers)).toEqual(new Set(['99', '5000', '77']));
  });
});

describe('PII round-trip failures are fatal', () => {
  it('rejects an unrehydrated placeholder', () => {
    const r = verifyMessageDraft('Beste [CUSTOMER_NAME], uw factuur staat open.', FACTS);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'unrehydrated_token')).toBe(true);
  });

  it('catches any bracketed all-caps placeholder, not just the known ones', () => {
    const r = verifyMessageDraft('Beste [KLANT_NAAM], uw factuur staat open.', FACTS);
    expect(r.ok).toBe(false);
  });

  it('does not false-flag ordinary bracketed text', () => {
    const r = verifyMessageDraft('Beste Fam. de Vries, [zie bijlage] voor details.', FACTS);
    expect(r.issues.some((i) => i.code === 'unrehydrated_token')).toBe(false);
  });
});

describe('shape checks', () => {
  it('rejects an empty or whitespace draft', () => {
    expect(verifyMessageDraft('', FACTS).ok).toBe(false);
    expect(verifyMessageDraft('   ', FACTS).ok).toBe(false);
    expect(verifyMessageDraft(null, FACTS).ok).toBe(false);
  });

  it('rejects a stub', () => {
    expect(verifyMessageDraft('Hoi', FACTS).ok).toBe(false);
  });

  it('rejects an essay', () => {
    expect(verifyMessageDraft('a'.repeat(1300), FACTS).ok).toBe(false);
  });

  it('warns on HTML but does not block', () => {
    const r = verifyMessageDraft('Beste Fam. de Vries, <b>betaal</b> alstublieft.', FACTS);
    expect(r.issues.some((i) => i.code === 'markup')).toBe(true);
    expect(r.ok).toBe(true);
  });

  // A model that answers the prompt instead of writing the message.
  it.each([
    'Here is a draft reminder for you:',
    'Betreft: openstaande factuur van uw klant',
    'Voici le message que vous pouvez envoyer',
  ])('warns on a meta preamble: %s', (text) => {
    const r = verifyMessageDraft(`${text} ... rest of the message here`, FACTS);
    expect(r.issues.some((i) => i.code === 'meta_preamble')).toBe(true);
  });

  it('handles empty facts without throwing', () => {
    expect(() => verifyMessageDraft('Beste klant, graag contact opnemen.', { allowedValues: [] })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// REGRESSION — "0.500" was read as thousands and became 500
// ---------------------------------------------------------------------------
describe('a zero integer part is always a decimal, never thousands', () => {
  it.each([
    ['0.500', '0.5'],
    ['0,750', '0.75'],
    ['0.125', '0.125'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normaliseNumber(input)).toBe(expected);
  });

  it('still treats a non-zero 3-digit group as thousands', () => {
    expect(normaliseNumber('1.234')).toBe('1234');
    expect(normaliseNumber('12.000')).toBe('12000');
  });

  // The bug in user terms: a fact of 0.500 would have allowed a draft to say 500.
  it('does not let a fractional fact authorise a thousand-times larger figure', () => {
    const r = verifyMessageDraft('Het tarief is 500 euro per uur zoals afgesproken.', {
      allowedValues: ['0.500'],
    });
    expect(r.ok).toBe(false);
    expect(r.unsupportedNumbers).toContain('500');
  });

  it('matches the same fractional value written either way', () => {
    expect(verifyMessageDraft('Korting van 0,5 procent toegepast op het totaal.', {
      allowedValues: ['0.500'],
    }).ok).toBe(true);
  });
});

// Pinned deliberately: see the DraftFacts.allowedValues doc comment. Stripping
// date components would reject a draft that legitimately writes "voor 19
// augustus", and a false positive that blocks a correct message is worse than a
// false negative that still reaches a human reviewer.
describe('date components widen the allowlist — documented, not accidental', () => {
  it('lets a number from a date satisfy the gate', () => {
    const r = verifyMessageDraft('Wij verwachten betaling binnen 19 dagen na vandaag.', {
      allowedValues: ['2026-08-19'],
    });
    expect(r.ok).toBe(true);
  });

  it('still rejects a number that appears nowhere, date or otherwise', () => {
    expect(verifyMessageDraft('Wij verwachten betaling binnen 45 dagen.', {
      allowedValues: ['2026-08-19'],
    }).ok).toBe(false);
  });
});
