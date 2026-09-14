/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { slot, splitSentence } from '../LinkedSentence';

describe('splitSentence', () => {
  it('separates text from link slots, in order', () => {
    const s = `Continuando accetti i nostri ${slot('terms')} e l'${slot('privacy')}.`;
    expect(splitSentence(s)).toEqual([
      { text: 'Continuando accetti i nostri ' },
      { slot: 'terms' },
      { text: " e l'" },
      { slot: 'privacy' },
      { text: '.' },
    ]);
  });

  it('never shreds a sentence into characters', () => {
    const parts = splitSentence(`By continuing you agree to our ${slot('terms')} and ${slot('privacy')}.`);
    expect(parts.length).toBe(5);
  });
});

// A locale that drops a slot would silently drop a legally required link.
describe('consent sentences keep both links in every locale', () => {
  const dir = path.join(__dirname, '../../../i18n/locales');
  for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
    it(loc, () => {
      const d = JSON.parse(fs.readFileSync(path.join(dir, `${loc}.json`), 'utf8'));
      for (const s of [d.auth.consentSentence, d.signup.acceptSentence]) {
        expect(s).toContain('{{terms}}');
        expect(s).toContain('{{privacy}}');
        expect(s).not.toMatch(/&/);
      }
    });
  }
});
