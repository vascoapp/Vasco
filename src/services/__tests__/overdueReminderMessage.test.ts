// The reminder a contractor shares with a late-paying customer, rendered through
// the REAL catalogue in every locale. On a German device it named no invoice and
// no sender; NL/ES/IT addressed the customer informally.
//
// ⚠️ NOT `src/i18n/i18n`: jest.setup.ts mocks that module to return the
// defaultValue, so a test through it reads ENGLISH in every locale and passes
// on a broken catalogue. A real i18next instance over the real JSON instead.
import i18next from 'i18next';
import en from '../../i18n/locales/en.json';
import nl from '../../i18n/locales/nl.json';
import de from '../../i18n/locales/de.json';
import fr from '../../i18n/locales/fr.json';
import es from '../../i18n/locales/es.json';
import it_ from '../../i18n/locales/it.json';
import { overdueReminderMessage, daysPastDue } from '../overdueReminderMessage';

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.init({
    resources: {
      en: { translation: en }, nl: { translation: nl }, de: { translation: de },
      fr: { translation: fr }, es: { translation: es }, it: { translation: it_ },
    },
    lng: 'en',
    fallbackLng: false,
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
});

const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;

const input = {
  customer: 'Bäckerei Lindner GmbH',
  number: 'RE-2026-0087',
  amount: '€ 5.200,00',
  days: 15,
  business: 'Sanitär Becker GmbH',
};

describe('overdueReminderMessage', () => {
  it.each(LOCALES)('%s names the invoice, the amount, the days and the sender', async (lng) => {
    await i18n.changeLanguage(lng);
    const msg = overdueReminderMessage(i18n.t.bind(i18n), input);
    expect(msg).toContain('RE-2026-0087');
    expect(msg).toContain('€ 5.200,00');
    expect(msg).toContain('15');
    expect(msg).toContain('Bäckerei Lindner GmbH');
    expect(msg.trimEnd().endsWith('Sanitär Becker GmbH')).toBe(true);
    expect(msg).not.toMatch(/\{\{|\}\}/);
    // Proves the catalogue was read, not the English defaultValue.
    if (lng !== 'en') expect(msg).not.toContain('A friendly reminder');
  });

  it.each(LOCALES)('%s uses the singular for one day', async (lng) => {
    await i18n.changeLanguage(lng);
    const one = overdueReminderMessage(i18n.t.bind(i18n), { ...input, days: 1 });
    const many = overdueReminderMessage(i18n.t.bind(i18n), { ...input, days: 15 });
    // Same sentence with the number swapped would mean no singular form.
    expect(one.replace(' 1 ', ' 15 ')).not.toBe(many);
  });

  it('addresses the customer formally where the language distinguishes', async () => {
    const informal: Record<string, RegExp> = {
      nl: /\b(je|jouw|jij|Hoi|kun je)\b/i,
      de: /\b(du|dein|deine|dich|dir)\b/i,
      es: /\b(tú|tu|tus|podrías|te)\b/i,
      it: /\b(tua|tuo|tuoi|potresti|Ciao|puoi)\b/i,
      fr: /\b(tu|ton|ta|tes|toi)\b/i,
    };
    for (const [lng, re] of Object.entries(informal)) {
      await i18n.changeLanguage(lng);
      const msg = overdueReminderMessage(i18n.t.bind(i18n), { ...input, customer: 'X', business: 'Y' });
      expect({ lng, msg, informal: re.test(msg) }).toEqual({ lng, msg, informal: false });
    }
  });

  it('leaves no dangling sign-off when the business name is unknown', async () => {
    await i18n.changeLanguage('de');
    const msg = overdueReminderMessage(i18n.t.bind(i18n), { ...input, business: '' });
    expect(msg).toBe(msg.trimEnd());
    expect(msg.endsWith('Vielen Dank')).toBe(true);
  });
});

describe('daysPastDue', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  it('counts from the stored due date', () => {
    expect(daysPastDue({ dueDate: '2026-08-30T12:00:00Z' }, now)).toBe(15);
  });
  it('never returns NaN without a due date', () => {
    expect(daysPastDue({ dueInDays: -12 }, now)).toBe(12);
    expect(daysPastDue({}, now)).toBe(0);
  });
  it('is zero for an invoice not yet due', () => {
    expect(daysPastDue({ dueDate: '2026-09-20' }, now)).toBe(0);
  });
});
