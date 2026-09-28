import { TEMPLATE_TOKENS, tokensToWords, wordsToTokens } from '../templateTokens';
import nl from '../../i18n/locales/nl.json';
import de from '../../i18n/locales/de.json';
import en from '../../i18n/locales/en.json';
import fr from '../../i18n/locales/fr.json';
import es from '../../i18n/locales/es.json';
import itLocale from '../../i18n/locales/it.json';

const cats = { nl, de, en, fr, es, it: itLocale } as Record<string, any>;
const body = 'Hi {{customer}}, invoice {{invoiceId}} of {{amount}} is {{daysOverdue}} days late ({{date}}, {{jobTitle}}). — {{contractorName}}';

describe.each(Object.keys(cats))('template tokens (%s)', (lang) => {
  const label = (k: any) => cats[lang].templates.token[k];

  it('has a word for every token', () => {
    for (const k of TEMPLATE_TOKENS) expect(typeof label(k)).toBe('string');
  });

  it('shows words, no braces, and round-trips back to the stored tokens', () => {
    const shown = tokensToWords(body, label);
    expect(shown).not.toMatch(/\{\{|\}\}/);
    expect(shown).toContain(`[${label('customer')}]`);
    expect(wordsToTokens(shown, label)).toBe(body);
  });

  it('words must be distinct, or saving could not tell them apart', () => {
    const words = TEMPLATE_TOKENS.map((k) => label(k).toLowerCase());
    expect(new Set(words).size).toBe(words.length);
  });
});

it('leaves other brackets alone', () => {
  const label = (k: any) => (nl as any).templates.token[k];
  expect(wordsToTokens('[let op] [KLANT]', label)).toBe('[let op] {{customer}}');
});
